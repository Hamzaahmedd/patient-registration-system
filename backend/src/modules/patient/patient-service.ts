import type { Patient, Sex } from "@prisma/client";
import { prisma } from "../../config/database";
import { NotFoundError } from "../../shared/middleware/error-handler";
import { parseSpokenDate } from "../../shared/utils/date-parser";
import type {
  CreatePatientInput,
  ListPatientsQuery,
  PatientDTO,
  SexDisplayValue,
  UpdatePatientInput,
} from "./patient-types";

const SEX_TO_PRISMA: Record<SexDisplayValue, Sex> = {
  Male: "MALE",
  Female: "FEMALE",
  Other: "OTHER",
  "Decline to Answer": "DECLINE_TO_ANSWER",
};

const SEX_TO_DISPLAY: Record<Sex, SexDisplayValue> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
  DECLINE_TO_ANSWER: "Decline to Answer",
};

/** MM/DD/YYYY -> UTC Date (midnight), matching how the column is stored. */
function mmddyyyyToDate(value: string): Date {
  const [mm, dd, yyyy] = value.split("/").map(Number);
  return new Date(Date.UTC(yyyy, mm - 1, dd));
}

function dateToMmddyyyy(date: Date): string {
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(
    date.getUTCDate(),
  ).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

function toDTO(patient: Patient): PatientDTO {
  return {
    patient_id: patient.patient_id,
    first_name: patient.first_name,
    last_name: patient.last_name,
    date_of_birth: dateToMmddyyyy(patient.date_of_birth),
    sex: SEX_TO_DISPLAY[patient.sex],
    phone_number: patient.phone_number,
    email: patient.email,
    address_line_1: patient.address_line_1,
    address_line_2: patient.address_line_2,
    city: patient.city,
    state: patient.state,
    zip_code: patient.zip_code,
    insurance_provider: patient.insurance_provider,
    insurance_member_id: patient.insurance_member_id,
    preferred_language: patient.preferred_language,
    emergency_contact_name: patient.emergency_contact_name,
    emergency_contact_phone: patient.emergency_contact_phone,
    created_at: patient.created_at.toISOString(),
    updated_at: patient.updated_at.toISOString(),
  };
}

export async function createPatient(input: CreatePatientInput): Promise<PatientDTO> {
  const created = await prisma.patient.create({
    data: {
      first_name: input.first_name,
      last_name: input.last_name,
      date_of_birth: mmddyyyyToDate(input.date_of_birth),
      sex: SEX_TO_PRISMA[input.sex],
      phone_number: input.phone_number,
      email: input.email ?? null,
      address_line_1: input.address_line_1,
      address_line_2: input.address_line_2 ?? null,
      city: input.city,
      state: input.state,
      zip_code: input.zip_code,
      insurance_provider: input.insurance_provider ?? null,
      insurance_member_id: input.insurance_member_id ?? null,
      preferred_language: input.preferred_language ?? "English",
      emergency_contact_name: input.emergency_contact_name ?? null,
      emergency_contact_phone: input.emergency_contact_phone ?? null,
    },
  });
  return toDTO(created);
}

export async function getPatientById(patientId: string): Promise<PatientDTO> {
  const patient = await prisma.patient.findFirst({
    where: { patient_id: patientId, deleted_at: null },
  });
  if (!patient) throw new NotFoundError(`No patient found with id ${patientId}.`);
  return toDTO(patient);
}

/**
 * Normalizes a phone number for lookup against our stored 10-digit U.S. format. Caller-ID/ANI
 * numbers (e.g. from a Vapi call's `customer.number`) commonly arrive in E.164 form with a
 * leading "+1" country code ("+15551234567"), which strips to 11 digits - drop the leading "1"
 * so it still matches the 10-digit number a caller spoke and had validated at registration time.
 */
function normalizePhoneForLookup(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

/** Returns null instead of throwing - used internally by the voice module's lookup flow. */
export async function findPatientByPhoneNumber(phoneNumber: string): Promise<PatientDTO | null> {
  const digits = normalizePhoneForLookup(phoneNumber);
  const patient = await prisma.patient.findFirst({
    where: { phone_number: digits, deleted_at: null },
  });
  return patient ? toDTO(patient) : null;
}

export async function listPatients(filters: ListPatientsQuery): Promise<PatientDTO[]> {
  const where: Record<string, unknown> = { deleted_at: null };

  if (filters.last_name) {
    where.last_name = { equals: filters.last_name, mode: "insensitive" };
  }
  if (filters.phone_number) {
    where.phone_number = filters.phone_number.replace(/\D/g, "");
  }
  if (filters.date_of_birth) {
    const normalized = parseSpokenDate(filters.date_of_birth) ?? filters.date_of_birth;
    const asDate = mmddyyyyToDate(normalized);
    if (!Number.isNaN(asDate.getTime())) {
      where.date_of_birth = asDate;
    }
  }

  const patients = await prisma.patient.findMany({ where, orderBy: { created_at: "desc" } });
  return patients.map(toDTO);
}

export async function updatePatient(
  patientId: string,
  input: UpdatePatientInput,
): Promise<PatientDTO> {
  const existing = await prisma.patient.findFirst({
    where: { patient_id: patientId, deleted_at: null },
  });
  if (!existing) throw new NotFoundError(`No patient found with id ${patientId}.`);

  const data: Record<string, unknown> = {};
  if (input.first_name !== undefined) data.first_name = input.first_name;
  if (input.last_name !== undefined) data.last_name = input.last_name;
  if (input.date_of_birth !== undefined) data.date_of_birth = mmddyyyyToDate(input.date_of_birth);
  if (input.sex !== undefined) data.sex = SEX_TO_PRISMA[input.sex];
  if (input.phone_number !== undefined) data.phone_number = input.phone_number;
  if (input.email !== undefined) data.email = input.email;
  if (input.address_line_1 !== undefined) data.address_line_1 = input.address_line_1;
  if (input.address_line_2 !== undefined) data.address_line_2 = input.address_line_2;
  if (input.city !== undefined) data.city = input.city;
  if (input.state !== undefined) data.state = input.state;
  if (input.zip_code !== undefined) data.zip_code = input.zip_code;
  if (input.insurance_provider !== undefined) data.insurance_provider = input.insurance_provider;
  if (input.insurance_member_id !== undefined) data.insurance_member_id = input.insurance_member_id;
  if (input.preferred_language !== undefined) data.preferred_language = input.preferred_language;
  if (input.emergency_contact_name !== undefined) data.emergency_contact_name = input.emergency_contact_name;
  if (input.emergency_contact_phone !== undefined) data.emergency_contact_phone = input.emergency_contact_phone;

  const updated = await prisma.patient.update({ where: { patient_id: patientId }, data });
  return toDTO(updated);
}

export async function softDeletePatient(patientId: string): Promise<void> {
  const existing = await prisma.patient.findFirst({
    where: { patient_id: patientId, deleted_at: null },
  });
  if (!existing) throw new NotFoundError(`No patient found with id ${patientId}.`);

  await prisma.patient.update({
    where: { patient_id: patientId },
    data: { deleted_at: new Date() },
  });
}
