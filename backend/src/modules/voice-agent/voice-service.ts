import { ZodError } from "zod";
import { NotFoundError } from "../../shared/middleware/error-handler";
import { parseSpokenDate } from "../../shared/utils/date-parser";
import { logger } from "../../config/logger";
import { createPatientSchema, updatePatientSchema } from "../patient/patient-schema";
import { createPatient, findPatientByPhoneNumber, updatePatient } from "../patient/patient-service";
import { createTranscriptSchema } from "../transcript/transcript-schema";
import { createTranscript } from "../transcript/transcript-service";
import { createAppointmentSchema } from "../appointment/appointment-schema";
import { createAppointment } from "../appointment/appointment-service";
import {
  buildKnownCallerContext,
  buildReturningCallerFirstMessage,
  DEFAULT_FIRST_MESSAGE,
  REGISTRATION_SYSTEM_PROMPT,
  VOICE_AGENT_TOOLS,
} from "./prompt-templates";

/**
 * Turns a ZodError into a short, speakable sentence naming the specific field(s) that
 * need to be re-collected - this is what lets the voice agent "re-prompt specifically
 * for that field" per the spec, instead of reading back a raw validation error.
 */
function describeValidationError(error: ZodError): string {
  const issues = error.issues.map((issue) => {
    const field = issue.path.join(".") || "a field";
    return `${field}: ${issue.message}`;
  });
  return `I couldn't save that because of the following: ${issues.join("; ")}. Could you repeat that information?`;
}

/** Pre-processes the raw tool-call arguments coming from Vapi before they hit Zod. */
function normalizeVoiceInput(raw: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...raw };
  // Both date_of_birth (create/update_patient) and preferred_date (schedule_appointment) use
  // the same spoken-date-to-MM/DD/YYYY normalization before their respective strict Zod checks.
  for (const dateField of ["date_of_birth", "preferred_date"]) {
    if (typeof normalized[dateField] === "string") {
      const parsed = parseSpokenDate(normalized[dateField] as string);
      // Leave the raw value in place if we couldn't parse it - the strict Zod regex will then
      // reject it with a clear "not a valid MM/DD/YYYY date" message for the voice agent to relay.
      if (parsed) normalized[dateField] = parsed;
    }
  }
  return normalized;
}

/**
 * Duplicate-detection bonus: called as soon as the caller's phone number is known, before the
 * rest of registration. Returns a speakable result that also carries the patient_id in plain
 * text so the model can reuse it in a later update_patient call - Vapi tool results are plain
 * strings read back into the conversation, not structured data, so this is the only channel
 * available for the model to "remember" the id.
 */
export async function handleLookupPatientByPhoneTool(rawArgs: Record<string, unknown>): Promise<string> {
  const phoneNumber = rawArgs.phone_number;
  if (typeof phoneNumber !== "string" || phoneNumber.trim().length === 0) {
    return "No phone number was provided to look up.";
  }
  try {
    const patient = await findPatientByPhoneNumber(phoneNumber);
    if (!patient) {
      return "No existing record found for that phone number. Proceed with a new registration.";
    }
    return `An existing record was found for ${patient.first_name} ${patient.last_name}, patient ID ${patient.patient_id}. Ask the caller if they'd like to update this record instead of creating a new one.`;
  } catch (error) {
    logger.error({ err: error }, "voice_lookup_patient_failed");
    return "The lookup couldn't be completed right now. Proceed with a new registration.";
  }
}

export interface DynamicAssistantConfig {
  name: string;
  firstMessage: string;
  model: {
    provider: string;
    model: string;
    messages: Array<{ role: "system"; content: string }>;
    tools: typeof VOICE_AGENT_TOOLS;
  };
}

/**
 * Call-start duplicate detection: builds the assistant config Vapi should use for THIS call,
 * based on the caller's phone number (ANI) if one was provided in the inbound call payload -
 * before the caller has said a single word. This is what makes "Welcome back, Jane!" possible
 * as the very first thing the caller hears, instead of only after they've spoken their phone
 * number and the model has called lookup_patient_by_phone mid-conversation.
 *
 * IMPORTANT (documented honestly): this powers Vapi's "assistant-request" webhook flow, which
 * requires the phone number's inbound-call setting to point at this server instead of a
 * statically-assigned assistant. That dashboard change has NOT been made/verified live in this
 * project - the existing statically-assigned assistant (using REGISTRATION_SYSTEM_PROMPT /
 * VOICE_AGENT_TOOLS directly, with in-conversation lookup_patient_by_phone) is what was actually
 * tested against a real phone call. This function is additive and inert unless that dashboard
 * setting is switched - see README "Known limitations" for what to verify before relying on it.
 * The model/provider below are placeholders matching the setup guide's suggested default and
 * should be confirmed against whatever the Vapi assistant is actually configured to use.
 */
export async function buildAssistantConfigForCall(callerPhoneNumber: string | null | undefined): Promise<DynamicAssistantConfig> {
  const base: DynamicAssistantConfig = {
    name: "patient-registration-agent",
    firstMessage: DEFAULT_FIRST_MESSAGE,
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: REGISTRATION_SYSTEM_PROMPT }],
      tools: VOICE_AGENT_TOOLS,
    },
  };

  if (!callerPhoneNumber || callerPhoneNumber.trim().length === 0) {
    return base;
  }

  try {
    const patient = await findPatientByPhoneNumber(callerPhoneNumber);
    if (!patient) {
      return base;
    }
    logger.info(
      { patient_id: patient.patient_id, first_name: patient.first_name },
      "returning_caller_detected_at_call_start",
    );
    return {
      ...base,
      firstMessage: buildReturningCallerFirstMessage(patient.first_name),
      model: {
        ...base.model,
        messages: [
          {
            role: "system",
            content: REGISTRATION_SYSTEM_PROMPT + buildKnownCallerContext(patient.patient_id, patient.first_name, patient.last_name),
          },
        ],
      },
    };
  } catch (error) {
    // Never let a lookup failure block call setup - fall back to the default, generic assistant.
    logger.error({ err: error }, "call_start_lookup_failed");
    return base;
  }
}

interface VapiEndOfCallReportMessage {
  call?: {
    id?: string;
    customer?: { number?: string };
  };
  summary?: string;
  transcript?: string;
  recordingUrl?: string;
  durationSeconds?: number;
}

/**
 * Call transcripts & analytics: persists Vapi's end-of-call-report webhook payload to the
 * transcripts table. Links to a patient by looking up the caller's ANI (same phone number used
 * for duplicate detection) - if it doesn't match anyone (call ended before registering, or no
 * ANI at all), the transcript is still saved with a null patient_id rather than dropped, per
 * the "optional for anonymous calls" requirement.
 *
 * Never throws: a transcript-persistence failure must never surface as a webhook error back to
 * Vapi (there's nothing Vapi could do with that error anyway - the call has already ended).
 */
export async function handleEndOfCallReport(message: VapiEndOfCallReportMessage): Promise<void> {
  try {
    const vapiCallId = message.call?.id;
    if (!vapiCallId) {
      logger.warn({}, "end_of_call_report_missing_call_id");
      return;
    }

    let patientId: string | null = null;
    const callerNumber = message.call?.customer?.number;
    if (callerNumber) {
      const patient = await findPatientByPhoneNumber(callerNumber);
      if (patient) patientId = patient.patient_id;
    }

    const input = createTranscriptSchema.parse({
      patient_id: patientId,
      vapi_call_id: vapiCallId,
      summary: typeof message.summary === "string" && message.summary.length > 0 ? message.summary : null,
      transcript_text: typeof message.transcript === "string" ? message.transcript : null,
      recording_url: typeof message.recordingUrl === "string" ? message.recordingUrl : null,
      duration_seconds:
        typeof message.durationSeconds === "number" ? Math.round(message.durationSeconds) : null,
    });

    const transcript = await createTranscript(input);
    logger.info(
      { transcript_id: transcript.id, patient_id: transcript.patient_id, vapi_call_id: transcript.vapi_call_id },
      "call_transcript_saved",
    );
  } catch (error) {
    logger.error({ err: error }, "end_of_call_report_persist_failed");
  }
}

export async function handleCreatePatientTool(rawArgs: Record<string, unknown>): Promise<string> {
  try {
    const input = createPatientSchema.parse(normalizeVoiceInput(rawArgs));
    const patient = await createPatient(input);
    // Full payload logged intentionally - required "final collected data payload" log (see
    // pii-sanitizer.ts for why this is unmasked while ambient logs are still redacted).
    logger.info({ patient }, "patient_registered_via_voice_agent");
    return `Registration saved successfully for ${patient.first_name} ${patient.last_name}. Their patient ID is ${patient.patient_id}.`;
  } catch (error) {
    if (error instanceof ZodError) {
      return describeValidationError(error);
    }
    logger.error({ err: error }, "voice_create_patient_failed");
    return "I'm sorry, I ran into a problem saving your registration. Could we try that last step again?";
  }
}

/**
 * Appointment scheduling bonus: offered once, right after a successful new registration. A
 * mock booking - no real calendar/provider assignment - just records what the caller asked for.
 */
export async function handleScheduleAppointmentTool(rawArgs: Record<string, unknown>): Promise<string> {
  const patientId = rawArgs.patient_id;
  if (typeof patientId !== "string") {
    return "I don't have a patient record to schedule an appointment for yet - let's finish registration first.";
  }
  try {
    const input = createAppointmentSchema.parse(normalizeVoiceInput(rawArgs));
    const appointment = await createAppointment(input);
    logger.info(
      { appointment_id: appointment.id, patient_id: appointment.patient_id },
      "appointment_scheduled_via_voice_agent",
    );
    return `Your initial consultation is booked for ${appointment.preferred_date}, ${appointment.preferred_time_slot}. We'll follow up to confirm the exact time.`;
  } catch (error) {
    if (error instanceof ZodError) {
      return describeValidationError(error);
    }
    if (error instanceof NotFoundError) {
      return "I couldn't find that patient record to schedule an appointment for.";
    }
    logger.error({ err: error }, "voice_schedule_appointment_failed");
    return "I'm sorry, I ran into a problem booking that appointment. Could we try that last step again?";
  }
}

export async function handleUpdatePatientTool(rawArgs: Record<string, unknown>): Promise<string> {
  const { patient_id: patientId, ...fields } = rawArgs;
  if (typeof patientId !== "string") {
    return "I don't have a patient record to update yet - let's complete your registration first.";
  }
  try {
    const input = updatePatientSchema.parse(normalizeVoiceInput(fields));
    const patient = await updatePatient(patientId, input);
    logger.info({ patient }, "patient_updated_via_voice_agent");
    return `Your information has been updated, ${patient.first_name}.`;
  } catch (error) {
    if (error instanceof ZodError) {
      return describeValidationError(error);
    }
    if (error instanceof NotFoundError) {
      return "I couldn't find that patient record to update.";
    }
    logger.error({ err: error }, "voice_update_patient_failed");
    return "I'm sorry, I ran into a problem updating your record. Could we try that last step again?";
  }
}
