import type { ApiEnvelope, Patient } from "../types/patient";

/**
 * Requests are relative ("/patients") so the Vite dev-server proxy (vite.config.ts) forwards
 * them to the backend on :3000 in development, and the same relative path works unmodified if
 * this build is ever served from behind the same origin/reverse proxy as the API in production.
 */
export async function fetchPatients(): Promise<Patient[]> {
  const res = await fetch("/patients");
  const body = (await res.json()) as ApiEnvelope<Patient[]>;
  if (!res.ok || body.error) {
    throw new Error(body.error?.message ?? `Request failed with status ${res.status}`);
  }
  return body.data ?? [];
}
