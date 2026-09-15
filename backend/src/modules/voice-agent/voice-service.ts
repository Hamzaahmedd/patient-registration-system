import { ZodError } from "zod";
import { NotFoundError } from "../../shared/middleware/error-handler";
import { parseSpokenDate } from "../../shared/utils/date-parser";
import { logger } from "../../config/logger";
import { createPatientSchema, updatePatientSchema } from "../patient/patient-schema";
import { createPatient, updatePatient } from "../patient/patient-service";

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
  if (typeof normalized.date_of_birth === "string") {
    const parsed = parseSpokenDate(normalized.date_of_birth);
    // Leave the raw value in place if we couldn't parse it - the strict Zod regex will
    // then reject it with a clear "not a valid MM/DD/YYYY date" message for the voice agent to relay.
    if (parsed) normalized.date_of_birth = parsed;
  }
  return normalized;
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
