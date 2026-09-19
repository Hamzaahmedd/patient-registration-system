import type { Transcript } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { NotFoundError } from "../../shared/middleware/error-handler";
import { logger } from "../../config/logger";
import type { CreateTranscriptInput, TranscriptDTO } from "./transcript-types";

function toDTO(transcript: Transcript): TranscriptDTO {
  return {
    id: transcript.id,
    patient_id: transcript.patient_id,
    vapi_call_id: transcript.vapi_call_id,
    summary: transcript.summary,
    transcript_text: transcript.transcript_text,
    recording_url: transcript.recording_url,
    duration_seconds: transcript.duration_seconds,
    created_at: transcript.created_at.toISOString(),
  };
}

/**
 * Upserted on `vapi_call_id` rather than always-create: Vapi can redeliver the
 * end-of-call-report webhook (e.g. if our response is slow), and this must stay idempotent -
 * a retried delivery updates the same row instead of producing a duplicate transcript.
 */
export async function createTranscript(input: CreateTranscriptInput): Promise<TranscriptDTO> {
  const data = {
    patient_id: input.patient_id,
    summary: input.summary ?? null,
    transcript_text: input.transcript_text ?? null,
    recording_url: input.recording_url ?? null,
    duration_seconds: input.duration_seconds ?? null,
  };
  const transcript = await prisma.transcript.upsert({
    where: { vapi_call_id: input.vapi_call_id },
    create: { vapi_call_id: input.vapi_call_id, ...data },
    update: data,
  });
  return toDTO(transcript);
}

export async function listTranscriptsForPatient(patientId: string): Promise<TranscriptDTO[]> {
  const transcripts = await prisma.transcript.findMany({
    where: { patient_id: patientId },
    orderBy: { created_at: "desc" },
  });
  return transcripts.map(toDTO);
}

export async function listAllTranscripts(): Promise<TranscriptDTO[]> {
  const transcripts = await prisma.transcript.findMany({
    orderBy: { created_at: "desc" },
  });
  return transcripts.map(toDTO);
}

export async function getTranscriptById(id: string): Promise<TranscriptDTO> {
  const transcript = await prisma.transcript.findUnique({ where: { id } });
  if (!transcript) throw new NotFoundError(`No transcript found with id ${id}.`);
  return toDTO(transcript);
}

/**
 * Resolves a playable recording URL for a transcript by calling Vapi's authenticated recording
 * endpoint server-side (the private API key never reaches the browser - see Vapi's own docs on
 * this: "Never expose your Private API Key in client-side code"). Vapi responds with a 302 to a
 * short-lived signed URL; we return that Location so the caller (transcript-controller.ts) can
 * redirect the browser straight to it - the browser then fetches the audio directly from
 * Cloudflare, no proxying of the actual audio bytes through our server.
 */
export async function resolveRecordingRedirectUrl(vapiCallId: string): Promise<string> {
  if (!env.vapi.apiKey) {
    throw new Error("VAPI_API_KEY is not configured - cannot resolve an authenticated recording URL.");
  }

  const response = await fetch(`https://api.vapi.ai/call/${vapiCallId}/stereo-recording`, {
    headers: { Authorization: `Bearer ${env.vapi.apiKey}` },
    redirect: "manual",
  });

  const location = response.headers.get("location");
  if (!location) {
    logger.warn(
      { vapiCallId, status: response.status },
      "vapi_recording_redirect_missing",
    );
    throw new NotFoundError("No recording is available for this call.");
  }
  return location;
}
