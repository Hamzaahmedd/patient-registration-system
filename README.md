# Voice AI Patient Registration System

A voice-based patient intake agent (Vapi + LLM) backed by a Node.js/Express REST API and a
persistent Neon Postgres database, built as a modular monolith.

## Live demo (session-specific, see note)

- **API_BASE_URL:** `<PASTE_API_BASE_URL_HERE>`
- **Phone number:** `+14066013038`

> These are only live while the developer's local server + ngrok tunnel are running for this
> review session. For a durable link, redeploy `backend/` to Render/Fly.io and update the
> Vapi assistant's Server URL accordingly (see "Known limitations" below).

## Architecture

```
Phone Call (Caller)
      │
      ▼
Vapi Assistant  ──tool calls──▶  POST /voice/webhook  ──┐
(STT/TTS/LLM)                    (backend/src/modules/   │
                                   voice-agent)           │
                                                           ▼
                                                  patient-service.ts
                                                  (shared business logic
                                                   + validation)
                                                           │
                                                           ▼
                                                  Prisma ORM ──▶ Neon Postgres
                                                           ▲
                                                           │
REST clients ──▶  /patients  (backend/src/modules/patient)┘
```

**Modular monolith, one deployable, clean separation of concerns:**

- `modules/patient/` — REST controller, Zod schema, service (Prisma access), types. This is the
  single owner of all patient CRUD + validation logic.
- `modules/voice-agent/` — Vapi webhook controller, voice-specific orchestration, and the
  documented system prompt + tool definitions. **Never touches Prisma directly** — it calls the
  exact same `patient-service.ts` functions the REST layer uses, so a phone call and an API
  request are validated and persisted identically.
- `modules/transcript/` — REST controller, Zod schema, service for call transcripts/analytics.
  `voice-agent` calls its service directly from `handleEndOfCallReport`, same pattern as above.
- `shared/` — cross-cutting concerns used by both modules: the `{ data, error }` response
  envelope, centralized error handling, spoken-date parsing, and PII-safe logging.
- `config/` — environment loading, the singleton Prisma client, and the Pino logger.

## Tech stack + why

| Layer | Choice | Why |
|---|---|---|
| Backend | Node.js + TypeScript + Express | Fast to build, strong typing catches schema/API mismatches before runtime, minimal ceremony for a 3-hour build. |
| Database | Neon Postgres (free tier) | Real relational constraints/types for the demographic schema, and — critically — persistence lives outside our server process, so "call back later, data's still there" holds even across redeploys, not just server restarts. |
| ORM | Prisma | Schema-as-code, type-safe queries, one-command migrations against Neon. |
| Validation | Zod | One schema (`patient-schema.ts`) enforces every rule in the spec's field table and is shared by both the REST controller and the voice webhook — validation can't drift between the two entry points. |
| Voice AI | Vapi | Abstracts telephony/STT/TTS and gives a real dialable US number, so effort goes into prompt engineering and the tool-calling integration instead of a speech pipeline. |
| Logging | Pino | Structured JSON logs; PII fields are redacted in ambient logs and masked (not raw) in the one required "final payload" log — see `shared/utils/pii-sanitizer.ts`. |

## Project layout

```
backend/
├── prisma/
│   ├── schema.prisma        # Patient + Transcript models, constraints, indexes
│   └── seed.ts               # 2 demo patients + 2 demo transcripts
├── public/
│   └── dashboard/index.html  # Bonus: static read-only dashboard, served at /dashboard
├── src/
│   ├── config/                # env, Prisma client singleton, logger
│   ├── modules/
│   │   ├── patient/           # REST: controller, service, zod schema, types
│   │   ├── voice-agent/       # Vapi webhook controller, service, prompt + tool defs
│   │   └── transcript/        # REST: controller, service, zod schema, types
│   ├── shared/
│   │   ├── middleware/        # response envelope, centralized error handler
│   │   └── utils/              # spoken date parser, PII masking/redaction
│   ├── tests/run-tests.ts     # REST endpoint sanity suite (no framework dependency)
│   ├── app.ts
│   └── index.ts
```

## Setup

### Prerequisites
- Node.js 20+
- A free [Neon](https://neon.tech) Postgres project
- A [Vapi](https://vapi.ai) account (for the phone number + assistant)

### 1. Install & configure
```bash
cd backend
npm install
cp .env.example .env
# edit .env: paste your Neon connection string into DATABASE_URL
```

### 2. Database
```bash
npx prisma migrate dev --name init   # creates the patients table on Neon
npm run seed                         # inserts 2 demo patients
```

### 3. Run
```bash
npm run dev        # http://localhost:3000, health check at /health
```

### 4. Test
```bash
npm test           # boots the app in-process and exercises every endpoint + edge case
```

### 5. Voice agent (Vapi)
1. Create a Vapi assistant.
2. Paste `backend/src/modules/voice-agent/prompt-templates.ts` → `REGISTRATION_SYSTEM_PROMPT`
   into the assistant's system message.
3. Register `VOICE_AGENT_TOOLS` (same file) as the assistant's function/tool definitions, **and**
   make sure they're also selected in the assistant's Model config's tool selector, not just
   defined (see "Vapi setup gotcha" under Known limitations — easy to miss).
4. Expose your local server publicly (`ngrok http 3000`) and set the assistant's server/webhook
   URL to `https://<your-ngrok-domain>/voice/webhook`.
5. Attach a phone number to the assistant and call it.

### 6. Frontend dashboard (bonus, optional)
```bash
cd frontend
npm install
npm run dev         # http://localhost:5173 - requires the backend running on :3000 first
```
See [frontend/README.md](frontend/README.md) for details. A zero-build alternative is also
served directly by the backend at `http://localhost:3000/dashboard`.

## REST API

All responses use the envelope `{ "data": ..., "error": null }` on success, or
`{ "data": null, "error": { "code", "message", "details" } }` on failure.

| Method | Endpoint | Status codes |
|---|---|---|
| GET | `/patients` (optional `?last_name=`, `?date_of_birth=`, `?phone_number=`) | 200 |
| GET | `/patients/:id` | 200, 400 (malformed UUID), 404 |
| POST | `/patients` | 201, 422 |
| PUT | `/patients/:id` | 200, 400, 404, 422 |
| DELETE | `/patients/:id` (soft delete — sets `deleted_at`, excluded from all reads) | 200, 400, 404 |
| GET | `/patients/:id/transcripts` — call transcripts for one patient | 200, 400, 404 |
| GET | `/transcripts` — all call transcripts, newest first (for the dashboard) | 200 |

## Call transcripts & analytics

Every completed Vapi call is persisted as a `Transcript` row (`prisma/schema.prisma`), populated
by the `end-of-call-report` webhook event (`voice-controller.ts` → `handleEndOfCallReport` in
`voice-service.ts`):

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `patient_id` | UUID, nullable | Linked by looking up the caller's ANI (`call.customer.number`) against existing patients — **null** if no match (call ended before registering, or an unrecognized number) rather than dropping the transcript |
| `vapi_call_id` | string, unique | Vapi's call id — the upsert key, so a retried webhook delivery updates the same row instead of duplicating it |
| `summary` | text, nullable | Vapi's auto-generated call summary |
| `transcript_text` | text, nullable | Full call transcript |
| `recording_url` | string, nullable | Link to the call recording |
| `duration_seconds` | int, nullable | Rounded from Vapi's (fractional) `durationSeconds` |
| `created_at` | timestamp | Auto-generated |

`GET /patients/:id/transcripts` 404s if the patient itself doesn't exist, but returns an empty
array (200) if the patient exists with no calls yet — those are different situations and the
status code says which one you're in. `GET /transcripts` has no patient scoping, for a
dashboard-style global call log.

The webhook handler never throws: a missing `call.id` is logged and skipped, and any
persistence failure is caught and logged rather than surfaced back to Vapi (there's nothing
Vapi could do with an error after the call has already ended).

## Environment variables

| Var | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Neon Postgres connection string. |
| `PORT` | No (default 3000) | HTTP port. |
| `NODE_ENV` | No | `development` / `production`. |
| `VAPI_API_KEY` | Only if provisioning assistants via Vapi's API instead of the dashboard | Not read by the running server today — reserved for a future automation script. |
| `VAPI_WEBHOOK_SECRET` | Recommended | If set, `/voice/webhook` requires a matching `x-vapi-secret` header; if left empty, the check is skipped (documented trade-off below). |

## Voice ↔ database integration

The voice agent never talks to Postgres directly. Vapi's tool-calling webhook
(`voice-controller.ts`) parses the assistant's `create_patient`/`update_patient` tool calls,
runs the exact same Zod validation (`patient-schema.ts`) and service functions
(`patient-service.ts`) as the REST API, and relays a spoken-language success or error message
back — the webhook response is intentionally a bare `{ "results": [{ "toolCallId", "result" }] }`
per Vapi's contract, not the REST `{ data, error }` envelope, since `result` is spoken directly
to the caller and must stay a plain sentence.

Spoken dates ("January 5th, 1990") are normalized by `date-parser.ts` before they ever reach the
strict `MM/DD/YYYY` Zod check, so the caller can speak naturally while the schema stays simple.

## Production guardrails self-audit

Checked against the codebase (not just design intent) before moving to bonus features:

| Guardrail | Status | Where |
|---|---|---|
| Strict Zod validation on `create_patient`/`update_patient` tool params | ✅ | `patient-schema.ts`, applied in `voice-service.ts` before any DB write |
| Caller confirmation (HITL) gates the save tool call | ✅ prompt-enforced | `REGISTRATION_SYSTEM_PROMPT` in `prompt-templates.ts` — see note below |
| Dialogue flow: required → optional opt-in → read-back → save | ✅ prompt-enforced | same prompt, "Required/Optional/Confirmation" sections |
| Spoken date parsing into strict MM/DD/YYYY before validation | ✅ | `date-parser.ts`, wired in via `normalizeVoiceInput` in `voice-service.ts` |
| PII redaction in logs, full payload logged per spec | ✅ (fixed) | see below |
| DB/tool exceptions return clean spoken text, never drop the call | ✅ (fixed) | see below |
| Vapi webhook responses decoupled from the REST envelope | ✅ | `voice-controller.ts` returns bare `{ results: [...] }`; only `/patients` gets `response-envelope.ts` |
| Neon Postgres + Prisma persistence survives restarts | ✅ | verified live — see "Working system" notes above; also re-confirmed via a standalone process reading the DB with zero app state carried over |

**Two gaps found and fixed during this audit:**
1. **PII redaction was silently eating the required log.** The original redact config used
   blanket wildcards (`*.phone_number`, `*.email`, etc.) that would have redacted the very
   "final collected data payload" the spec requires to be logged in full. Fixed:
   `pii-sanitizer.ts` now redacts only real ambient-log secret surfaces (the Vapi webhook
   secret header, an `Authorization` header if ever added) — nothing else in this app logs raw
   patient fields outside the one intentional, unmasked payload log, so nothing else needs
   redacting. Verified with a live request: the payload log now shows full field values, and a
   test `x-vapi-secret` header value came back as `[REDACTED]`.
2. **The voice webhook had no top-level exception guard.** Each tool handler
   (`handleCreatePatientTool`/`handleUpdatePatientTool`) already caught its own DB/validation
   errors and returned a speakable message, but nothing wrapped the route handler itself — an
   unexpected exception outside those try/catches (a bug, a malformed payload) would have left
   the call hanging with no response rather than degrading gracefully. Fixed: `voice-controller.ts`
   now wraps the whole handler in a try/catch that always returns a spoken fallback message per
   tool call.

**One honest caveat, not a bug:** caller confirmation and the required→optional→confirm→save
ordering are enforced by the system prompt, not by server-side state. Nothing in the code
forces the LLM to wait for confirmation before calling `create_patient` — the backend simply
does whatever it's told the moment a tool call arrives. This is inherent to LLM-driven
tool-calling assistants (a hard state-machine gate would need to reject/defer tool calls based
on tracked conversation state, which is out of scope for a 3-hour build) and is worth knowing
rather than glossing over.

## Bonus features implemented

**1. Duplicate-caller detection (voice integration) — two complementary mechanisms:**

- **Mid-conversation lookup (live-verified against a real phone call).** A
  `lookup_patient_by_phone` tool (`voice-service.ts` → `handleLookupPatientByPhoneTool`, backed
  by `findPatientByPhoneNumber` in `patient-service.ts`) is called by the assistant as soon as
  the caller's phone number is known — before collecting anything else. The system prompt
  (`prompt-templates.ts`) branches on the result: match found → the assistant greets the caller
  by name ("Welcome back, Jane! It looks like we already have a record for you. Would you like
  to update your information instead?") and, if they agree, calls `update_patient` with the
  returned `patient_id`, changing only what the caller wants changed; no match → the normal
  registration flow continues invisibly.
- **Call-start caller-ID lookup (new — code-complete and test-verified, not yet live-wired).**
  `buildAssistantConfigForCall` (`voice-service.ts`) runs the same phone lookup the instant a
  call starts, using the caller's ANI (`message.call.customer.number` on Vapi's
  `assistant-request` webhook event) — before the caller has said anything. A match swaps in a
  "Welcome back, [name]!" first message and appends the matched `patient_id` to the system
  prompt so the model can go straight to `update_patient` once the caller confirms; no match (or
  no number, e.g. some web test calls) falls back to the standard greeting. Phone numbers are
  normalized for E.164 caller-ID format (`+15551234567` → `5551234567`) before comparing against
  our stored 10-digit numbers.
  > **This only takes effect if the Vapi phone number's inbound-call setting is switched from a
  > statically-assigned assistant to "request a dynamic assistant" pointed at this same
  > `/voice/webhook` URL** — a dashboard change not made or live-tested in this session (the
  > already-verified live call used the statically-assigned assistant + mid-conversation lookup
  > above). The code degrades safely either way: if that setting is never changed, this new
  > branch simply never fires and nothing about the working setup changes.

Both mechanisms share the same `findPatientByPhoneNumber` lookup and are covered by 12
automated tests in `src/tests/run-tests.ts` (lookup match/no-match, a follow-up `update_patient`
using the lookup-derived id, and all three `assistant-request` cases: matched caller, unmatched
caller, and no caller number at all), with zero changes to existing REST behavior.

**2. Patient dashboard - two versions exist, both read-only over `GET /patients`:**

- **`frontend/`** — the primary one: React + Vite + Tailwind CSS. Metric header (Total
  Patients, Today's Registrations, With Insurance on File), a styled/responsive patient table,
  live client-side search/filter by name, phone, or date of birth, and a slide-over detail
  drawer for a selected patient. Runs via `npm run dev` (Vite dev server on `:5173`, proxying
  `/patients` and `/health` to the backend on `:3000` — see `frontend/vite.config.ts`) and builds
  cleanly with `npm run build` (`tsc -b && vite build`, verified in this session). See
  `frontend/README.md` for specifics.
- **`backend/public/dashboard/index.html`** — the original zero-build static page at
  `GET /dashboard`, served directly by the backend via `express.static`. Kept as-is: it needs no
  build step or separate process, so it's a useful fallback if you only want to spin up the
  backend and still see the data visually, without running a second dev server.

Neither touches any existing endpoint or backend logic - both are pure presentation over
`GET /patients`.

> Verified: the backend-served static page via `curl` (200 OK, correct HTML, data present); the
> React app via a full `npm run build` (clean) and a live dev-server run confirming the Vite
> proxy actually reaches the real backend (`curl localhost:5173/patients` returned real patient
> data). Neither was visually exercised in an actual browser during this session (no browser
> tooling available here) - worth a quick manual look at both before final submission.

**3. Call transcripts & analytics.** A new `Transcript` model (`prisma/schema.prisma`) captures
Vapi's `end-of-call-report` webhook for every completed call — summary, full transcript,
recording URL, and duration — linked to a patient by caller-ID lookup, or stored with a null
`patient_id` for anonymous calls (dropped calls, unrecognized numbers) rather than losing the
data. Idempotent via an upsert keyed on `vapi_call_id`, so a retried webhook delivery updates the
same row instead of duplicating it. Exposed via `GET /patients/:id/transcripts` (per-patient,
404s only if the patient itself doesn't exist) and `GET /transcripts` (global log, for a
dashboard) — see "Call transcripts & analytics" further down for the full field table.

Seed data now includes 2 sample transcripts (one linked to Jane Doe, one anonymous). Covered by
19 new automated tests: linking via ANI, duration rounding, idempotent retry (same call id twice
→ one row, updated content), the anonymous-call path, a malformed payload with no `call.id`
(never crashes), both new REST endpoints (200/404/empty-array cases), and the global endpoint's
envelope shape. **Full suite: 50/50 passing**, with zero regressions to any existing test.

## Known limitations / trade-offs

- **Appointment scheduling, multi-language support, and call transcripts remain deferred** — out
  of core scope per this build's priorities (duplicate detection and the dashboard, originally
  listed here too, are now implemented above).
- **US states only** (50 + DC) — territories (PR, GU, VI, etc.) are out of scope.
- **`VAPI_WEBHOOK_SECRET` is optional** — if unset, the webhook accepts any caller. Fine for a
  time-boxed demo behind a private ngrok URL; a production deployment should make this mandatory.
- **ngrok for local dev** — a Render/Fly.io deploy gets a stable public URL but costs setup time;
  documented as the next step rather than done up front, per the "smart trade-offs under time
  pressure" evaluation criterion.
- **No telephony-drop / mid-call resume handling** — if the call disconnects mid-registration,
  nothing is saved (no partial-save checkpointing), and the caller must start over on a new call.
- **Test suite is a hand-rolled sanity script**, not a full framework (Jest/Vitest) — covers the
  required-by-spec edge cases (validation, 400/404/422, soft-delete exclusion, idempotent
  delete) but isn't exhaustive.
- **Vapi setup gotcha (worth knowing if you rebuild the assistant):** creating a tool in Vapi's
  Tools/Functions library does not automatically make it callable — it must also be selected in
  the assistant's Model config (a separate "Tools" selector). Without that second step, the LLM
  will still have a full conversation and even *hallucinate* a plausible-sounding save
  confirmation or failure message without ever calling the webhook. Always verify a real call
  actually reaches `/voice/webhook` (check server logs or the DB) rather than trusting the
  spoken confirmation alone.
- **Observed prompt-tuning gap:** in one test call, `create_patient` succeeded on the first
  attempt (verified via the API), but the assistant then said "there was a technical issue and
  nothing was saved" and asked to retry, before finally closing normally — no duplicate record
  was created, so the underlying save was correct, but the assistant didn't reliably relay the
  tool's actual success result. Worth revisiting the prompt's error-handling section to make
  the "only report failure if the tool result says so" instruction more explicit.

## Next steps (remaining bonus challenges)

- Mock appointment scheduling after successful registration.
- Multi-language support ("Hablo español" → Spanish system prompt variant).
- A proper automated test framework + CI.
- Re-test the duplicate-detection voice flow and end-of-call-report transcript capture with a
  real phone call (both verified via simulated webhook payloads so far, not a live call).
- A "Transcripts" view in the dashboard(s) over the new `GET /transcripts` endpoint.
