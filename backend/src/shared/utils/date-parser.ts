/**
 * Converts spoken or loosely-formatted dates of birth into a strict "MM/DD/YYYY" string,
 * before the value ever reaches Zod validation. This is where all the "did the caller
 * actually say a real date" leniency lives - patient-schema.ts stays strict and dumb.
 *
 * Returns null (never throws) when the input can't be confidently parsed, so the caller
 * (voice-service / patient-controller) can re-prompt instead of silently guessing.
 */

const MONTHS: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** "1st" / "2nd" / "3rd" / "4th" -> 1 / 2 / 3 / 4 */
function stripOrdinal(token: string): number {
  return parseInt(token.replace(/(st|nd|rd|th)$/i, ""), 10);
}

/**
 * Resolves a 2-digit year to a 4-digit one. A DOB can never be in the future, so any
 * 2-digit year "close" to the current year's tail is assumed 1900s, not 2000s - e.g. in
 * 2026, "26" -> 2026 is fine (a 0-year-old wouldn't call in, but we don't reject it here;
 * the schema's not-in-future/plausible-age checks handle that), while "95" -> 1995.
 */
function resolveTwoDigitYear(yy: number): number {
  const currentYear = new Date().getUTCFullYear();
  const currentCentury = Math.floor(currentYear / 100) * 100;
  const candidate = currentCentury + yy;
  return candidate > currentYear ? candidate - 100 : candidate;
}

function isValidCalendarDate(month: number, day: number, year: number): boolean {
  if (month < 1 || month > 12) return false;
  if (year < 1900 || year > 9999) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= daysInMonth;
}

function format(month: number, day: number, year: number): string | null {
  if (!isValidCalendarDate(month, day, year)) return null;
  return `${pad2(month)}/${pad2(day)}/${year}`;
}

export function parseSpokenDate(rawInput: string): string | null {
  if (!rawInput || typeof rawInput !== "string") return null;
  const input = rawInput.trim().toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ");
  if (!input) return null;

  // 1. ISO: YYYY-MM-DD
  let m = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return format(parseInt(mo, 10), parseInt(d, 10), parseInt(y, 10));
  }

  // 2. Numeric with slashes/dashes: MM/DD/YYYY or MM/DD/YY (also accepts "-")
  m = input.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/);
  if (m) {
    const [, mo, d, y] = m;
    const year = y.length <= 2 ? resolveTwoDigitYear(parseInt(y, 10)) : parseInt(y, 10);
    return format(parseInt(mo, 10), parseInt(d, 10), year);
  }

  // 3. "January 5th 1990" / "jan 5 1990"
  m = input.match(
    /^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\d{2,4})$/,
  );
  if (m) {
    const [, monthWord, dayStr, y] = m;
    const month = MONTHS[monthWord];
    if (!month) return null;
    const year = y.length <= 2 ? resolveTwoDigitYear(parseInt(y, 10)) : parseInt(y, 10);
    return format(month, stripOrdinal(dayStr), year);
  }

  // 4. "5th of January 1990" / "the 5th of january, 1990"
  m = input.match(
    /^(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+of\s+([a-z]+)\s+(\d{2,4})$/,
  );
  if (m) {
    const [, dayStr, monthWord, y] = m;
    const month = MONTHS[monthWord];
    if (!month) return null;
    const year = y.length <= 2 ? resolveTwoDigitYear(parseInt(y, 10)) : parseInt(y, 10);
    return format(month, stripOrdinal(dayStr), year);
  }

  // 5. Already-correct strict MM/DD/YYYY (fast path, also re-validates calendar correctness)
  m = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const [, mo, d, y] = m;
    return format(parseInt(mo, 10), parseInt(d, 10), parseInt(y, 10));
  }

  return null;
}
