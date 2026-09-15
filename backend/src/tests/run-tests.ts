/**
 * Minimal REST endpoint sanity test suite (no test framework dependency, to stay
 * time/dependency-light for the 3-hour build). Boots the real Express app in-process
 * against whatever DATABASE_URL is configured, exercises every endpoint + the required
 * edge cases, and exits non-zero on first failure.
 *
 * Run with: npm test
 */
import type { AddressInfo } from "node:net";
import { createApp } from "../app";
import { disconnectDatabase, prisma } from "../config/database";

let passed = 0;
let failed = 0;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    failed += 1;
    console.error(`FAIL: ${message}`);
  } else {
    passed += 1;
    console.log(`PASS: ${message}`);
  }
}

async function main() {
  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  async function req(method: string, path: string, body?: unknown) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => null)) as any;
    return { status: res.status, json };
  }

  const validPatient = {
    first_name: "Test",
    last_name: "Patient",
    date_of_birth: "05/14/1990",
    sex: "Female",
    phone_number: "5551112222",
    email: "test.patient@example.com",
    address_line_1: "1 Test Way",
    city: "Testville",
    state: "CA",
    zip_code: "90210",
  };

  // 1. Create
  const created = await req("POST", "/patients", validPatient);
  assert(created.status === 201, `POST /patients returns 201 (got ${created.status})`);
  assert(created.json?.error === null, "POST /patients envelope has error: null");
  const patientId = created.json?.data?.patient_id;
  assert(typeof patientId === "string" && patientId.length > 0, "POST /patients returns a patient_id");

  // 2. Get by id
  const fetched = await req("GET", `/patients/${patientId}`);
  assert(fetched.status === 200, `GET /patients/:id returns 200 (got ${fetched.status})`);
  assert(fetched.json?.data?.last_name === "Patient", "GET /patients/:id returns the created record");

  // 3. List with filter
  const listed = await req("GET", "/patients?last_name=Patient");
  assert(listed.status === 200, "GET /patients?last_name= returns 200");
  assert(
    Array.isArray(listed.json?.data) && listed.json.data.some((p: any) => p.patient_id === patientId),
    "GET /patients?last_name= includes the created record",
  );

  // 4. Update (partial)
  const updated = await req("PUT", `/patients/${patientId}`, { city: "Newtown" });
  assert(updated.status === 200, `PUT /patients/:id returns 200 (got ${updated.status})`);
  assert(updated.json?.data?.city === "Newtown", "PUT /patients/:id applies partial update");
  assert(updated.json?.data?.last_name === "Patient", "PUT /patients/:id leaves untouched fields intact");

  // 5. Validation: future date of birth -> 422
  const futureDob = await req("POST", "/patients", { ...validPatient, date_of_birth: "01/01/2099" });
  assert(futureDob.status === 422, `POST with future DOB returns 422 (got ${futureDob.status})`);

  // 6. Validation: bad phone number -> 422
  const badPhone = await req("POST", "/patients", { ...validPatient, phone_number: "123" });
  assert(badPhone.status === 422, `POST with 3-digit phone returns 422 (got ${badPhone.status})`);

  // 7. Validation: missing required field -> 422
  const { first_name, ...missingFirstName } = validPatient;
  const missingField = await req("POST", "/patients", missingFirstName);
  assert(missingField.status === 422, `POST missing required field returns 422 (got ${missingField.status})`);

  // 8. Malformed id -> 400
  const malformedId = await req("GET", "/patients/not-a-uuid");
  assert(malformedId.status === 400, `GET /patients/not-a-uuid returns 400 (got ${malformedId.status})`);

  // 9. Unknown id -> 404
  const unknownId = await req("GET", "/patients/00000000-0000-0000-0000-000000000000");
  assert(unknownId.status === 404, `GET /patients/<unknown-uuid> returns 404 (got ${unknownId.status})`);

  // 10. Soft delete + exclusion from reads + idempotent 404 on second delete
  const deleted = await req("DELETE", `/patients/${patientId}`);
  assert(deleted.status === 200, `DELETE /patients/:id returns 200 (got ${deleted.status})`);

  const afterDelete = await req("GET", `/patients/${patientId}`);
  assert(afterDelete.status === 404, "Soft-deleted patient no longer retrievable via GET");

  const afterDeleteList = await req("GET", "/patients?last_name=Patient");
  assert(
    !afterDeleteList.json?.data?.some((p: any) => p.patient_id === patientId),
    "Soft-deleted patient excluded from list results",
  );

  const secondDelete = await req("DELETE", `/patients/${patientId}`);
  assert(secondDelete.status === 404, `Deleting an already-deleted patient returns 404 (got ${secondDelete.status})`);

  // ---------------------------------------------------------------------------------------
  // Duplicate-caller detection (voice agent)
  // ---------------------------------------------------------------------------------------
  const dupPatient = {
    first_name: "Dana",
    last_name: "Whitfield",
    date_of_birth: "03/03/1985",
    sex: "Other",
    phone_number: "5557778888",
    address_line_1: "9 Duplicate Ln",
    city: "Dupeton",
    state: "NY",
    zip_code: "10001",
  };
  const dupCreated = await req("POST", "/patients", dupPatient);
  assert(dupCreated.status === 201, "Duplicate-detection fixture patient created");
  const dupPatientId: string = dupCreated.json?.data?.patient_id;

  // 11. Mid-conversation lookup via the lookup_patient_by_phone tool call
  const lookupMatch = await req("POST", "/voice/webhook", {
    message: {
      type: "tool-calls",
      toolCallList: [
        { id: "call_a", function: { name: "lookup_patient_by_phone", arguments: { phone_number: "555-777-8888" } } },
      ],
    },
  });
  assert(lookupMatch.status === 200, "lookup_patient_by_phone tool-call returns 200");
  const lookupMatchResult: string = lookupMatch.json?.results?.[0]?.result ?? "";
  assert(
    lookupMatchResult.includes("Dana") && lookupMatchResult.includes(dupPatientId),
    "lookup_patient_by_phone finds the existing record by name and id",
  );

  const lookupNoMatch = await req("POST", "/voice/webhook", {
    message: {
      type: "tool-calls",
      toolCallList: [
        { id: "call_b", function: { name: "lookup_patient_by_phone", arguments: { phone_number: "9999999999" } } },
      ],
    },
  });
  const lookupNoMatchResult: string = lookupNoMatch.json?.results?.[0]?.result ?? "";
  assert(
    lookupNoMatchResult.toLowerCase().includes("no existing record"),
    "lookup_patient_by_phone reports no match for an unknown number",
  );

  // Follow-up update using the patient_id the lookup returned - proves the model could actually
  // route a confirmed "yes, update me" into a real update_patient call.
  const dupVoiceUpdate = await req("POST", "/voice/webhook", {
    message: {
      type: "tool-calls",
      toolCallList: [
        {
          id: "call_c",
          function: { name: "update_patient", arguments: { patient_id: dupPatientId, city: "Updateville" } },
        },
      ],
    },
  });
  const dupVoiceUpdateResult: string = dupVoiceUpdate.json?.results?.[0]?.result ?? "";
  assert(dupVoiceUpdateResult.includes("Dana"), "update_patient tool-call succeeds using the lookup-derived patient_id");
  const afterVoiceUpdate = await req("GET", `/patients/${dupPatientId}`);
  assert(afterVoiceUpdate.json?.data?.city === "Updateville", "update_patient tool-call actually persisted the change");

  // 12. Call-start caller-ID lookup (assistant-request path) - see voice-service.ts buildAssistantConfigForCall
  const assistantRequestMatch = await req("POST", "/voice/webhook", {
    message: {
      type: "assistant-request",
      call: { customer: { number: "+15557778888" } }, // E.164 with country code, as Vapi provides
    },
  });
  assert(assistantRequestMatch.status === 200, "assistant-request returns 200 for a recognized caller");
  const matchedFirstMessage: string = assistantRequestMatch.json?.assistant?.firstMessage ?? "";
  assert(
    matchedFirstMessage.includes("Welcome back") && matchedFirstMessage.includes("Dana"),
    "assistant-request greets a recognized caller by name before they've said anything",
  );
  const matchedSystemPrompt: string = assistantRequestMatch.json?.assistant?.model?.messages?.[0]?.content ?? "";
  assert(
    matchedSystemPrompt.includes(dupPatientId),
    "assistant-request's system prompt carries the matched patient_id for a follow-up update_patient call",
  );

  const assistantRequestNoMatch = await req("POST", "/voice/webhook", {
    message: {
      type: "assistant-request",
      call: { customer: { number: "+19998887777" } },
    },
  });
  assert(assistantRequestNoMatch.status === 200, "assistant-request returns 200 for an unrecognized caller");
  const unmatchedFirstMessage: string = assistantRequestNoMatch.json?.assistant?.firstMessage ?? "";
  assert(
    !unmatchedFirstMessage.includes("Welcome back"),
    "assistant-request uses the generic greeting for an unrecognized caller",
  );

  const assistantRequestNoNumber = await req("POST", "/voice/webhook", {
    message: { type: "assistant-request" },
  });
  assert(
    assistantRequestNoNumber.status === 200,
    "assistant-request with no customer number still returns 200 (never blocks call setup)",
  );

  await req("DELETE", `/patients/${dupPatientId}`);

  // ---------------------------------------------------------------------------------------
  // Call transcripts & analytics
  // ---------------------------------------------------------------------------------------
  const transcriptFixturePatient = {
    first_name: "Priya",
    last_name: "Nandan",
    date_of_birth: "07/11/1992",
    sex: "Female",
    phone_number: "5554443333",
    address_line_1: "42 Transcript Way",
    city: "Callburg",
    state: "WA",
    zip_code: "98101",
  };
  const transcriptPatientCreated = await req("POST", "/patients", transcriptFixturePatient);
  assert(transcriptPatientCreated.status === 201, "Transcript-detection fixture patient created");
  const transcriptPatientId: string = transcriptPatientCreated.json?.data?.patient_id;

  // 13. No transcripts yet -> empty array, 200 (not 404 - patient exists, just has no calls)
  const emptyTranscripts = await req("GET", `/patients/${transcriptPatientId}/transcripts`);
  assert(emptyTranscripts.status === 200, "GET /patients/:id/transcripts returns 200 before any calls exist");
  assert(
    Array.isArray(emptyTranscripts.json?.data) && emptyTranscripts.json.data.length === 0,
    "GET /patients/:id/transcripts returns an empty array before any calls exist",
  );

  // 14. GET transcripts for a nonexistent patient -> 404
  const transcriptsUnknownPatient = await req(
    "GET",
    "/patients/00000000-0000-0000-0000-000000000000/transcripts",
  );
  assert(
    transcriptsUnknownPatient.status === 404,
    `GET /patients/<unknown-uuid>/transcripts returns 404 (got ${transcriptsUnknownPatient.status})`,
  );

  // 15. end-of-call-report links a transcript to the patient via caller-ID (ANI) lookup
  const eocrLinked = await req("POST", "/voice/webhook", {
    message: {
      type: "end-of-call-report",
      call: { id: "test-call-priya-1", customer: { number: "+15554443333" } },
      summary: "Priya completed registration successfully.",
      transcript: "AI: Hello.\nUser: Hi, this is Priya.",
      recordingUrl: "https://example.com/recordings/test-call-priya-1.mp3",
      durationSeconds: 61.4,
    },
  });
  assert(eocrLinked.status === 200, "end-of-call-report returns 200 for a linked call");

  const linkedTranscripts = await req("GET", `/patients/${transcriptPatientId}/transcripts`);
  assert(linkedTranscripts.json?.data?.length === 1, "Linked transcript now appears under the patient");
  const linkedTranscript = linkedTranscripts.json?.data?.[0];
  assert(linkedTranscript?.vapi_call_id === "test-call-priya-1", "Linked transcript has the right vapi_call_id");
  assert(linkedTranscript?.duration_seconds === 61, "duration_seconds is rounded to the nearest integer");
  assert(
    linkedTranscript?.summary === "Priya completed registration successfully.",
    "Linked transcript stores the call summary",
  );
  assert(
    linkedTranscript?.recording_url === "https://example.com/recordings/test-call-priya-1.mp3",
    "Linked transcript stores the recording URL",
  );

  // 16. Retried webhook delivery (same vapi_call_id) upserts instead of duplicating
  await req("POST", "/voice/webhook", {
    message: {
      type: "end-of-call-report",
      call: { id: "test-call-priya-1", customer: { number: "+15554443333" } },
      summary: "UPDATED - retried delivery.",
      durationSeconds: 61.4,
    },
  });
  const afterRetryTranscripts = await req("GET", `/patients/${transcriptPatientId}/transcripts`);
  assert(
    afterRetryTranscripts.json?.data?.length === 1,
    "Retried end-of-call-report delivery does not create a duplicate transcript",
  );
  assert(
    afterRetryTranscripts.json?.data?.[0]?.summary === "UPDATED - retried delivery.",
    "Retried end-of-call-report delivery updates the existing transcript",
  );

  // 17. end-of-call-report from an unrecognized number is stored as an anonymous transcript
  const eocrAnonymous = await req("POST", "/voice/webhook", {
    message: {
      type: "end-of-call-report",
      call: { id: "test-call-anon-1", customer: { number: "+19990001111" } },
      summary: "Anonymous caller, no match.",
      durationSeconds: 8,
    },
  });
  assert(eocrAnonymous.status === 200, "end-of-call-report returns 200 for an unrecognized caller");

  // 18. end-of-call-report with no call id is safely ignored (never crashes the webhook)
  const eocrNoCallId = await req("POST", "/voice/webhook", {
    message: { type: "end-of-call-report", summary: "Missing call id." },
  });
  assert(
    eocrNoCallId.status === 200,
    "end-of-call-report with no call.id still returns 200 (never blocks/crashes)",
  );

  // 19. Global GET /transcripts includes both the linked and anonymous transcripts
  const globalTranscripts = await req("GET", "/transcripts");
  assert(globalTranscripts.status === 200, "GET /transcripts returns 200");
  assert(globalTranscripts.json?.error === null, "GET /transcripts envelope has error: null");
  const globalCallIds: string[] = (globalTranscripts.json?.data ?? []).map((t: any) => t.vapi_call_id);
  assert(globalCallIds.includes("test-call-priya-1"), "GET /transcripts includes the linked test transcript");
  assert(globalCallIds.includes("test-call-anon-1"), "GET /transcripts includes the anonymous test transcript");
  const anonEntry = (globalTranscripts.json?.data ?? []).find((t: any) => t.vapi_call_id === "test-call-anon-1");
  assert(anonEntry?.patient_id === null, "Anonymous transcript has a null patient_id");

  // Cleanup: remove test transcripts (no DELETE endpoint exists for transcripts by design -
  // hard-delete directly, same as any other test-only fixture data) and soft-delete the fixture patient.
  await prisma.transcript.deleteMany({
    where: { vapi_call_id: { in: ["test-call-priya-1", "test-call-anon-1"] } },
  });
  await req("DELETE", `/patients/${transcriptPatientId}`);

  server.close();
  await disconnectDatabase();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
