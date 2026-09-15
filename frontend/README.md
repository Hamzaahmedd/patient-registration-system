# Patient Intake Dashboard (frontend)

React + Vite + Tailwind CSS dashboard over the backend's `GET /patients`, `GET /transcripts`,
and `GET /patients/:id/transcripts` endpoints. See the root [README.md](../README.md) for the
full project (backend, voice agent, setup).

## Run locally

The backend must be running on `http://localhost:3000` first (see `../backend`).

```bash
npm install
npm run dev      # http://localhost:5173, proxies /patients, /transcripts, /health to :3000
```

## Build

```bash
npm run build    # tsc -b && vite build -> dist/
npm run preview  # serve the production build locally
```

## Talking to a backend that isn't behind the Vite proxy

By default, requests are relative (`/patients`) and go through the Vite dev-server proxy
(`vite.config.ts`) to `http://localhost:3000`. If you're serving this build from somewhere that
can't proxy to the backend, set `VITE_API_BASE_URL` (copy `.env.example` to `.env`) to the
backend's full URL instead — requests will go there directly. This requires the backend's
`CORS_ORIGINS` (see `../backend/.env.example`) to include this frontend's origin.

## What's here

- `src/api/client.ts` — shared fetch wrapper: unwraps the backend's `{ data, error }` envelope,
  prefixes requests with `VITE_API_BASE_URL` if set.
- `src/api/patients.ts`, `src/api/transcripts.ts`, `src/api/health.ts` — one function per endpoint.
- `src/components/MetricHeader.tsx` — Total Patients / Total Call Transcripts / System Health.
- `src/components/SearchBar.tsx` — live client-side filter by name, phone, or date of birth,
  plus the "Show deleted" toggle (calls `GET /patients?include_deleted=true`).
- `src/components/PatientTable.tsx` — the main data table (demographics, address, insurance,
  active/deleted status, created date).
- `src/components/PatientDetailDrawer.tsx` — slide-over detail panel with two tabs: Details and
  Call History (lazily fetches `GET /patients/:id/transcripts` when that tab is opened).
- `src/components/GlobalTranscriptsView.tsx` — the "Call Transcripts" tab: all calls across all
  callers, from `GET /transcripts`, each caller resolved to a patient name where possible.
- `src/components/TranscriptListItem.tsx` — shared call card (summary, duration, recording
  player/link, expandable full transcript) used by both of the above.
- `vite.config.ts` — dev-server proxy to the backend, and the Tailwind v4 Vite plugin.

No state management library, no routing - a two-tab dashboard doesn't need either.

## Known limitation

Seeded/test recording URLs (`https://storage.example.com/...`) are placeholders, not real
audio files — the `<audio>` player will show controls but won't actually play anything for
those specific records. A transcript saved from a real Vapi call will have Vapi's real
recording URL and should play normally.
