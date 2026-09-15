import { API_BASE } from "./client";

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) return false;
    const body = await res.json();
    return body?.data?.status === "ok";
  } catch {
    return false;
  }
}
