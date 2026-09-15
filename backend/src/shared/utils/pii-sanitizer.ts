/**
 * Central place for PII-handling policy in logs.
 *
 * The spec requires logging "at minimum, the final collected data payload" on every completed
 * registration - that log is REQUIRED to contain the real values (see patient-controller.ts /
 * voice-service.ts "patient_registered_*" and "patient_updated_*" log lines), so it is
 * deliberately NOT masked or redacted.
 *
 * What Pino's `redact` option (config/logger.ts) protects instead is everything else: any
 * secret credential that could otherwise leak into ambient logs (the Vapi webhook shared
 * secret header, an Authorization header if one is ever added). No other code path in this
 * app logs raw patient fields, so there is no other ambient PII surface to redact today - this
 * list is a deliberate, narrow allowlist rather than a blanket wildcard, specifically so it
 * cannot accidentally strip the one log the spec requires to be complete.
 */
export const PINO_REDACT_PATHS = [
  'req.headers["x-vapi-secret"]',
  "req.headers.authorization",
];
