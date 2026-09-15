import { apiGet } from "./client";
import type { Transcript } from "../types/transcript";

export async function fetchPatientTranscripts(patientId: string): Promise<Transcript[]> {
  return apiGet<Transcript[]>(`/patients/${patientId}/transcripts`);
}

export async function fetchAllTranscripts(): Promise<Transcript[]> {
  return apiGet<Transcript[]>("/transcripts");
}
