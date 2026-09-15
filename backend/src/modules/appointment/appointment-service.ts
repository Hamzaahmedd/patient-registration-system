import type { Appointment } from "@prisma/client";
import { prisma } from "../../config/database";
import { getPatientById } from "../patient/patient-service";
import type { AppointmentDTO, CreateAppointmentInput } from "./appointment-types";

function mmddyyyyToDate(value: string): Date {
  const [mm, dd, yyyy] = value.split("/").map(Number);
  return new Date(Date.UTC(yyyy, mm - 1, dd));
}

function dateToMmddyyyy(date: Date): string {
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(
    date.getUTCDate(),
  ).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

function toDTO(appointment: Appointment): AppointmentDTO {
  return {
    id: appointment.id,
    patient_id: appointment.patient_id,
    preferred_date: dateToMmddyyyy(appointment.preferred_date),
    preferred_time_slot: appointment.preferred_time_slot,
    created_at: appointment.created_at.toISOString(),
  };
}

/**
 * Mock booking - no real calendar/provider/conflict logic, just records what the caller asked
 * for. Confirms the patient actually exists first (getPatientById throws NotFoundError if not),
 * turning what would otherwise be an opaque foreign-key constraint failure into the same clean
 * "no such patient" error the rest of the app already handles consistently.
 */
export async function createAppointment(input: CreateAppointmentInput): Promise<AppointmentDTO> {
  await getPatientById(input.patient_id);

  const appointment = await prisma.appointment.create({
    data: {
      patient_id: input.patient_id,
      preferred_date: mmddyyyyToDate(input.preferred_date),
      preferred_time_slot: input.preferred_time_slot,
    },
  });
  return toDTO(appointment);
}

export async function listAppointmentsForPatient(patientId: string): Promise<AppointmentDTO[]> {
  const appointments = await prisma.appointment.findMany({
    where: { patient_id: patientId },
    orderBy: { created_at: "desc" },
  });
  return appointments.map(toDTO);
}
