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

  server.close();
  await disconnectDatabase();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
