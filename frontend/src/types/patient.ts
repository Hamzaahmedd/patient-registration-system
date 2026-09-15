// Mirrors backend/src/modules/patient/patient-types.ts (PatientDTO) - kept in sync by hand
// since the frontend and backend are separate deployables in this build.
export type SexDisplayValue = "Male" | "Female" | "Other" | "Decline to Answer";

export interface Patient {
  patient_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string; // MM/DD/YYYY
  sex: SexDisplayValue;
  phone_number: string;
  email: string | null;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  zip_code: string;
  insurance_provider: string | null;
  insurance_member_id: string | null;
  preferred_language: string;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ApiEnvelope<T> {
  data: T | null;
  error: { code: string; message: string; details?: unknown } | null;
}
