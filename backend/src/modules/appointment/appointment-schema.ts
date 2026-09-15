import { z } from "zod";

const MM_DD_YYYY_REGEX = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(\d{4})$/;

/** Midnight today, for the "not in the past" comparison below - never allows yesterday's date. */
function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * preferred_date arrives already normalized to MM/DD/YYYY by date-parser.ts (same spoken-date
 * handling used for date_of_birth). Unlike a date of birth, an appointment date must NOT be in
 * the past - the opposite direction of that check.
 */
const preferredDateSchema = z
  .string()
  .regex(MM_DD_YYYY_REGEX, "preferred_date must be a valid MM/DD/YYYY date.")
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
    { message: "preferred_date is not a real calendar date." },
  )
  .refine(
    (value) => {
      const [mm, dd, yyyy] = value.split("/").map(Number);
      const date = new Date(Date.UTC(yyyy, mm - 1, dd));
      return date.getTime() >= startOfToday().getTime();
    },
    { message: "preferred_date cannot be in the past." },
  );

export const createAppointmentSchema = z
  .object({
    patient_id: z.string().uuid(),
    preferred_date: preferredDateSchema,
    preferred_time_slot: z.string().trim().min(1).max(50),
  })
  .strict();
