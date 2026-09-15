// Mirrors backend/src/modules/transcript/transcript-types.ts (TranscriptDTO).
export interface Transcript {
  id: string;
  patient_id: string | null;
  vapi_call_id: string;
  summary: string | null;
  transcript_text: string | null;
  recording_url: string | null;
  duration_seconds: number | null;
  created_at: string;
}
