# Voice AI Patient Registration System

A voice-based patient intake agent (Vapi + LLM) backed by a Node.js/Express REST API and a
persistent Neon Postgres database, built as a modular monolith.

## Live demo

- **Phone number:** `+14066013038`
- **API base URL:** `https://patient-registration-system-iv00.onrender.com`
- **Dashboard:** `https://voxintake.vercel.app`

> Render's free tier spins down when idle — the first request after inactivity can take
> 30–60s to wake up. If a call seems unresponsive at first, that's likely why.

## Architecture

```
Phone Call ──▶ Vapi Assistant ──tool calls──▶ POST /voice/webhook ──▶ patient-service.ts ──▶ Prisma ──▶ Neon Postgres
                                                                              ▲
REST clients ──────────────────────────────▶ GET/POST/PUT/DELETE /patients ──┘
```

Modular monolith, one deployable, clear separation of concerns:

- **`modules/patient/`** — REST controller, Zod schema, service (all Prisma access). Owns all
  patient CRUD + validation.
- **`modules/voice-agent/`** — Vapi webhook controller, prompt + tool definitions. Never touches
  Prisma directly — calls the same `patient-service.ts` the REST layer uses, so a phone call and
  an API request are validated and persisted identically.
- **`modules/transcript/`**, **`modules/appointment/`** — same pattern, for the two call-related
  bonus features.
- **`shared/`** — response envelope, error handling, spoken-date parsing, PII-safe logging.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Backend | Node.js + TypeScript + Express | Fast to build, strong typing catches mismatches before runtime |
| Database | Neon Postgres | Real constraints/types, and persistence lives outside the server process — survives restarts and redeploys |
| ORM | Prisma | Schema-as-code, type-safe queries, one-command migrations |
| Validation | Zod | One schema per model, shared by both the REST controller and the voice webhook — validation can't drift between entry points |
| Voice AI | Vapi | Abstracts telephony/STT/TTS + gives a real US number, so effort goes into prompt engineering and tool-calling |
| Logging | Pino | Structured JSON; PII redacted in ambient logs, full payload logged for the one required audit line |

## Setup

**Prerequisites:** Node 20+, a [Neon](https://neon.tech) Postgres project, a [Vapi](https://vapi.ai) account.

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env        # fill in DATABASE_URL
npx prisma migrate deploy   # applies all migrations
npm run seed                # 2 demo patients + 2 demo transcripts
npm run dev                 # http://localhost:3000

# 2. Test
npm test                    # 71 tests, exercises every endpoint + edge case

# 3. Frontend (optional)
cd ../frontend
npm install
npm run dev                 # http://localhost:5173
```
See [frontend/README.md](frontend/README.md) for frontend-specific details.

**Voice agent (Vapi):**
1. Create a Vapi assistant. Paste `REGISTRATION_SYSTEM_PROMPT` from
   `backend/src/modules/voice-agent/prompt-templates.ts` as its system message.
2. Register `VOICE_AGENT_TOOLS` (same file) as its tools — **and** select them in the assistant's
   Model config tool selector too (creating a tool alone doesn't make it callable — easy to miss).
3. Set the Server URL to `https://<your-backend>/voice/webhook`.
4. Optional: set `VAPI_WEBHOOK_SECRET` and configure a matching HMAC credential in Vapi's Server
   Configuration screen (see below) for signed webhook verification.
5. Attach a phone number and call it.

## REST API

Every response uses `{ "data": ..., "error": null }` on success, or
`{ "data": null, "error": { "code", "message", "details" } }` on failure.

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/patients` | Filters: `?last_name=`, `?date_of_birth=`, `?phone_number=`, `?include_deleted=true` |
| GET | `/patients/:id` | 404 if missing |
| POST | `/patients` | 422 on validation failure |
| PUT | `/patients/:id` | Partial updates |
| DELETE | `/patients/:id` | Soft delete (`deleted_at`), never hard-deletes |
| GET | `/patients/:id/transcripts` | Per-patient call history |
| GET | `/transcripts` | Global call log |
| GET | `/patients/:id/appointments` | Per-patient mock bookings |
| GET | `/transcripts/:id/recording` | 302-redirects to a short-lived, playable recording URL (not JSON) |

## Data model

**Patient** — all 17 fields from the spec (name, DOB, sex, contact, address, insurance,
emergency contact, timestamps, soft-delete), validated by one shared Zod schema.

**Transcript** — `patient_id` (nullable — a call can end before a caller is identified),
`vapi_call_id` (unique, upserted so a retried webhook never duplicates), `summary`,
`transcript_text`, `recording_url`, `duration_seconds`. Populated automatically from Vapi's
`end-of-call-report` webhook event.

`recording_url` is the raw URL Vapi sends, which is **not directly playable** — Vapi moved
recording storage behind an authenticated API. `GET /transcripts/:id/recording` resolves an
actual playable URL server-side (calling Vapi's API with a private key that never reaches the
browser) and 302-redirects to it; the dashboard's audio player points at this endpoint, not the
stored `recording_url` directly.

**Appointment** — `patient_id` (required — can't exist before the patient does), `preferred_date`,
`preferred_time_slot`. Mock booking, no real calendar logic. Populated by the `schedule_appointment`
voice tool.

## Environment variables

**Backend** (`backend/.env.example`): `DATABASE_URL` (required), `PORT`, `NODE_ENV`,
`CORS_ORIGINS` (comma-separated allowed origins for the frontend), `VAPI_WEBHOOK_SECRET`
(optional — see below), `VAPI_API_KEY` (private key from Vapi's dashboard — needed only to
resolve playable recording URLs; never exposed to the frontend).

**Frontend** (`frontend/.env.example`): `VITE_API_BASE_URL` — set to the backend's URL for a
deployed build; leave unset for local dev (uses the Vite proxy instead).

## Webhook signature verification

`/voice/webhook` verifies an HMAC-SHA256 signature when `VAPI_WEBHOOK_SECRET` is set, matching
Vapi's **Server Configuration → Custom Credential** screen:

| Field | Value |
|---|---|
| Secret Key | same as `VAPI_WEBHOOK_SECRET` |
| Algorithm | SHA256 |
| Signature Header | `x-signature` |
| Timestamp Header | `x-timestamp` |
| Payload Format | `{timestamp}.{body}` |
| Signature Encoding | Hex |
| Secret Is Base64 | off |

Verified end-to-end (locally and against the deployed Render instance): an unsigned request gets
`401`, a correctly signed one gets `200`. If unset, verification is skipped — fine for a private
demo, not for anything beyond that.

## Bonus features implemented

All 6 from the spec:

1. **Duplicate-caller detection** — `lookup_patient_by_phone` tool, called as soon as the phone
   number is known; the assistant offers to update instead of re-registering. A second mechanism
   (`buildAssistantConfigForCall`) does the same lookup at call-start via caller ID, before the
   caller says anything — this one requires switching the Vapi number to a dynamic-assistant
   Server URL, not yet done.
2. **Dashboard** — `frontend/` (React + Vite + Tailwind): metrics, searchable patient table,
   soft-delete toggle, per-patient detail drawer with call history, global transcripts tab. Plus a
   zero-build static fallback at `backend/public/dashboard`.
3. **Call transcripts** — see Data model above.
4. **Appointment scheduling** — offered right after a successful new registration; see Data
   model above.
5. **Multi-language (Spanish)** — prompt-level: detects a language switch and conducts the entire
   conversation in Spanish, while keeping tool-call arguments in their required English format
   (e.g. `sex` stays `"Male"`/`"Female"`/etc., never translated). Not yet tested on a real call.
6. **Automated tests** — 71 tests in `backend/src/tests/run-tests.ts`, run via `npm test`. Boots
   the real app in-process and hits every endpoint and webhook path with real HTTP calls. Not a
   framework like Jest (no CI, no isolated test DB) — a hand-rolled script, by design, to stay
   dependency-light.

## Known limitations

- US states only (50 + DC), no territories.
- No mid-call resume — a dropped call loses in-progress (unsaved) registration data.
- HITL confirmation and the required→optional→confirm→save order are prompt-enforced, not
  code-enforced — nothing server-side stops the LLM from calling `create_patient` early.
- The Vapi credential's live attachment hasn't been confirmed with a real phone call this session
  (the HMAC math itself is verified thoroughly — see above).
- Vapi gotcha: a tool must be *selected* in the assistant's Model config, not just defined, or
  the LLM will hold a full conversation and hallucinate a save confirmation without ever calling
  the webhook.

## Next steps

- Migrate the test script to Jest/Vitest with CI.
- Confirm the Vapi HMAC credential, the Spanish switch, appointment scheduling, and the
  call-start duplicate-detection variant against a real call (mid-conversation duplicate
  detection is already confirmed working on a real call).
- Surface `GET /patients/:id/appointments` in the dashboard (transcripts are already there).
