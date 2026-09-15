import { Clock, FileText } from "lucide-react";
import type { Transcript } from "../types/transcript";
import { formatDateTime, formatDuration } from "../utils/format";

interface TranscriptListItemProps {
  transcript: Transcript;
  /** Shown above the summary when rendering in a context without an implicit patient (the global view). */
  callerLabel?: string;
}

export function TranscriptListItem({ transcript, callerLabel }: TranscriptListItemProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {callerLabel && <span className="text-sm font-medium text-slate-800">{callerLabel}</span>}
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Clock size={13} />
            {formatDuration(transcript.duration_seconds)}
          </span>
          <span>{formatDateTime(transcript.created_at)}</span>
        </div>
      </div>

      <p className="mt-2 flex items-start gap-2 text-sm text-slate-700">
        <FileText size={14} className="mt-0.5 shrink-0 text-slate-400" />
        {transcript.summary || <span className="text-slate-400">No summary available.</span>}
      </p>

      {transcript.recording_url && (
        <div className="mt-3">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- call recordings have no captions to provide */}
          <audio controls src={transcript.recording_url} className="h-9 w-full max-w-sm" />
          <a
            href={transcript.recording_url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-xs text-indigo-600 hover:underline"
          >
            Open recording in new tab
          </a>
        </div>
      )}

      {transcript.transcript_text && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">
            View full transcript
          </summary>
          <pre className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs text-slate-600">
            {transcript.transcript_text}
          </pre>
        </details>
      )}
    </div>
  );
}
