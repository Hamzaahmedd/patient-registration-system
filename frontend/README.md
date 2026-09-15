# Patient Intake Dashboard (frontend)

React + Vite + Tailwind CSS dashboard over the backend's `GET /patients` endpoint. See the
root [README.md](../README.md) for the full project (backend, voice agent, setup).

## Run locally

The backend must be running on `http://localhost:3000` first (see `../backend`).

```bash
npm install
npm run dev      # http://localhost:5173, proxies /patients + /health to :3000
```

## Build

```bash
npm run build    # tsc -b && vite build -> dist/
npm run preview  # serve the production build locally
```

## What's here

- `src/api/patients.ts` — fetch wrapper unwrapping the backend's `{ data, error }` envelope.
- `src/components/MetricHeader.tsx` — Total Patients / Today's Registrations / With Insurance.
- `src/components/SearchBar.tsx` — live client-side filter by name, phone, or date of birth.
- `src/components/PatientTable.tsx` — the main data table.
- `src/components/PatientDetailDrawer.tsx` — slide-over detail panel for a selected patient.
- `vite.config.ts` — dev-server proxy to the backend, and the Tailwind v4 Vite plugin.

No state management library, no routing - a single dashboard view doesn't need either.
