import { apiGet } from "./client";
import type { Patient } from "../types/patient";

export async function fetchPatients(includeDeleted = false): Promise<Patient[]> {
  const query = includeDeleted ? "?include_deleted=true" : "";
  return apiGet<Patient[]>(`/patients${query}`);
}
