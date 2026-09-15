/**
 * Central place for PII-handling policy in logs.
 *
 * Two different needs from the spec pull in opposite directions:
 *  - Observability requirement: "log the final collected data payload" for every completed call.
 *  - General good practice (and your instruction): don't let PII leak into ambient request/error logs.
 *
 * Resolution: ambient logs (HTTP access log, error log) redact PII fields outright via Pino's
 * `redact` option. The one required "final payload" log uses `maskPatientForLog` below, which keeps
 * enough shape to debug a failed call (e.g. "phone ends in 1234") without printing raw values.
 */

// Paths Pino redacts wherever they appear in logged objects (request bodies, error contexts, etc).
export const PINO_REDACT_PATHS = [
  "req.body.phone_number",
  "req.body.email",
  "req.body.date_of_birth",
  "req.body.insurance_member_id",
  "req.body.emergency_contact_phone",
  "req.body.emergency_contact_name",
  "req.body.address_line_1",
  "req.body.address_line_2",
  "*.phone_number",
  "*.email",
  "*.insurance_member_id",
  "*.emergency_contact_phone",
];

function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***-***-${digits.slice(-4)}`;
}

function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}

function maskDob(dob: string | Date | null | undefined): string | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return "***";
  // Keep only year - enough to confirm "did we save the right decade" without full DOB in logs.
  return `**/**/${d.getUTCFullYear()}`;
}

/**
 * Produces a log-safe summary of a patient record for the required
 * "final collected data payload" observability log.
 */
export function maskPatientForLog(patient: Record<string, unknown>) {
  return {
    patient_id: patient.patient_id,
    first_name: patient.first_name,
    last_name: patient.last_name,
    date_of_birth: maskDob(patient.date_of_birth as string),
    sex: patient.sex,
    phone_number: maskPhone(patient.phone_number as string),
    email: maskEmail(patient.email as string | undefined),
    city: patient.city,
    state: patient.state,
    zip_code: patient.zip_code,
    has_insurance: Boolean(patient.insurance_provider),
    has_emergency_contact: Boolean(patient.emergency_contact_name),
    preferred_language: patient.preferred_language,
  };
}
