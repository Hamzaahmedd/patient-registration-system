import type { ApiEnvelope } from "../types/patient";

/**
 * Empty by default: requests stay relative ("/patients") and go through the Vite dev-server
 * proxy (vite.config.ts) to the backend on :3000. Set VITE_API_BASE_URL (frontend/.env) to call
 * the backend directly instead - needed for a production build that isn't served from the same
 * origin as the API, which is why the backend has CORS configured for this frontend's origin.
 */
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  const body = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok || body.error) {
    throw new Error(body.error?.message ?? `Request failed with status ${res.status}`);
  }
  return body.data as T;
}
