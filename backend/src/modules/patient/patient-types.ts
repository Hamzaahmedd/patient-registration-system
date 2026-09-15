import { z } from "zod";
import type {
  createPatientSchema,
  listPatientsQuerySchema,
  updatePatientSchema,
} from "./patient-schema";

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type ListPatientsQuery = z.infer<typeof listPatientsQuerySchema>;

// Human-facing sex values, used at every boundary (API + voice agent).
// Mapped to/from the Prisma `Sex` enum only inside patient-service.ts.
export const SEX_DISPLAY_VALUES = ["Male", "Female", "Other", "Decline to Answer"] as const;
export type SexDisplayValue = (typeof SEX_DISPLAY_VALUES)[number];

export interface PatientDTO {
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
