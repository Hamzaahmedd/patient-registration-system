import type { z } from "zod";
import type { createTranscriptSchema } from "./transcript-schema";

export type CreateTranscriptInput = z.infer<typeof createTranscriptSchema>;

export interface TranscriptDTO {
  id: string;
  patient_id: string | null;
  vapi_call_id: string;
  summary: string | null;
  transcript_text: string | null;
  recording_url: string | null;
  duration_seconds: number | null;
  created_at: string;
}
