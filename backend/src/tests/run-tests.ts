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
import { disconnectDatabase } from "../config/database";

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

  server.close();
  await disconnectDatabase();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
