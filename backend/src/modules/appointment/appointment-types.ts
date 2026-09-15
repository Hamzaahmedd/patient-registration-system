import type { z } from "zod";
import type { createAppointmentSchema } from "./appointment-schema";

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export interface AppointmentDTO {
  id: string;
  patient_id: string;
  preferred_date: string; // MM/DD/YYYY
  preferred_time_slot: string;
  created_at: string;
}
