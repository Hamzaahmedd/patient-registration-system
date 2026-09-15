import { AlertCircle } from "lucide-react";
import type { Patient } from "../types/patient";
import type { Transcript } from "../types/transcript";
import { TranscriptListItem } from "./TranscriptListItem";

interface GlobalTranscriptsViewProps {
  transcripts: Transcript[];
  state: "loading" | "ready" | "error";
  errorMessage: string;
  /** Used to resolve a transcript's patient_id into a display name - already loaded by App. */
  patients: Patient[];
}

function callerLabelFor(transcript: Transcript, patients: Patient[]): string {
  if (!transcript.patient_id) return "Anonymous caller";
  const patient = patients.find((p) => p.patient_id === transcript.patient_id);
  return patient ? `${patient.first_name} ${patient.last_name}` : "Unknown patient";
}

export function GlobalTranscriptsView({ transcripts, state, errorMessage, patients }: GlobalTranscriptsViewProps) {
  if (state === "loading") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500">
        Loading call transcripts...
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
        <AlertCircle size={18} />
        <span>Couldn't load transcripts: {errorMessage}</span>
      </div>
    );
  }

  if (transcripts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">
        No calls recorded yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        <span className="font-medium text-slate-700">{transcripts.length}</span> call
        {transcripts.length === 1 ? "" : "s"} across all callers
      </p>
      {transcripts.map((t) => (
        <TranscriptListItem key={t.id} transcript={t} callerLabel={callerLabelFor(t, patients)} />
      ))}
    </div>
  );
}
