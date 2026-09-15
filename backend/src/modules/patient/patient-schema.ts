import { z } from "zod";
import { SEX_DISPLAY_VALUES } from "./patient-types";

// All 50 states + DC. Territories omitted deliberately - out of scope for this assessment;
// documented as a known limitation in the README.
const US_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN",
  "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
  "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT",
  "VT", "VA", "WA", "WV", "WI", "WY",
]);

const NAME_REGEX = /^[A-Za-z'-]{1,50}$/;
const ZIP_REGEX = /^\d{5}(-\d{4})?$/;
const MM_DD_YYYY_REGEX = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(\d{4})$/;

/** Strips everything but digits - accepts "(555) 123-4567", "555-123-4567", "5551234567", etc. */
function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

const usPhoneSchema = z
  .string()
  .transform(normalizePhoneDigits)
  .refine((digits) => digits.length === 10, {
    message: "Phone number must be a valid U.S. 10-digit number.",
  });

/**
 * date_of_birth arrives already normalized to MM/DD/YYYY by date-parser.ts (voice path) or is
 * expected in that format directly from REST clients. This schema is the strict final gate:
 * valid calendar date, not in the future.
 */
const dateOfBirthSchema = z
  .string()
  .regex(MM_DD_YYYY_REGEX, "date_of_birth must be a valid MM/DD/YYYY date.")
  .refine(
    (value) => {
      const [mm, dd, yyyy] = value.split("/").map(Number);
      const date = new Date(Date.UTC(yyyy, mm - 1, dd));
      return (
        date.getUTCFullYear() === yyyy &&
        date.getUTCMonth() === mm - 1 &&
        date.getUTCDate() === dd
      );
    },
    { message: "date_of_birth is not a real calendar date." },
  )
  .refine(
    (value) => {
      const [mm, dd, yyyy] = value.split("/").map(Number);
      const date = new Date(Date.UTC(yyyy, mm - 1, dd));
      return date.getTime() <= Date.now();
    },
    { message: "date_of_birth cannot be in the future." },
  );

const nameSchema = z
  .string()
  .trim()
  .regex(NAME_REGEX, "Must be 1-50 alphabetic characters (hyphens/apostrophes allowed).");

const stateSchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(2, "state must be a 2-letter U.S. state abbreviation.")
  .refine((value) => US_STATE_CODES.has(value), {
    message: "state must be a valid U.S. state abbreviation.",
  });

const basePatientFields = {
  first_name: nameSchema,
  last_name: nameSchema,
  date_of_birth: dateOfBirthSchema,
  sex: z.enum(SEX_DISPLAY_VALUES),
  phone_number: usPhoneSchema,
  email: z.string().trim().email("Invalid email format.").optional().nullable(),
  address_line_1: z.string().trim().min(1).max(200),
  address_line_2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(1).max(100),
  state: stateSchema,
  zip_code: z.string().trim().regex(ZIP_REGEX, "zip_code must be 5-digit or ZIP+4 U.S. format."),
  insurance_provider: z.string().trim().max(150).optional().nullable(),
  insurance_member_id: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]+$/, "insurance_member_id must be alphanumeric.")
    .max(50)
    .optional()
    .nullable(),
  preferred_language: z.string().trim().min(1).max(50).optional(),
  emergency_contact_name: z.string().trim().max(100).optional().nullable(),
  emergency_contact_phone: usPhoneSchema.optional().nullable(),
};

export const createPatientSchema = z.object(basePatientFields).strict();

export const updatePatientSchema = z.object(basePatientFields).partial().strict();

export const listPatientsQuerySchema = z
  .object({
    last_name: z.string().trim().min(1).optional(),
    date_of_birth: z.string().trim().optional(),
    phone_number: z.string().trim().optional(),
    // Not in the original spec's filter list - added for the dashboard's soft-delete filter
    // toggle. Defaults to excluding soft-deleted records (unchanged prior behavior) unless
    // explicitly set to "true".
    include_deleted: z.enum(["true", "false"]).optional(),
  })
  .strict();
