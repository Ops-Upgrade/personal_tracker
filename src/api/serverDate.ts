"use client";

/**
 * Returns today's date in IST as a YYYY-MM-DD string, formatted entirely
 * client-side via Intl.DateTimeFormat (no database RPC required).
 *
 * The result is cached for the lifetime of the page session.
 */

let cachedDate: string | null = null;

/** Format a Date into YYYY-MM-DD in Asia/Kolkata timezone. */
function toISTDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function getServerDateIST(): Promise<string> {
  if (cachedDate !== null) return cachedDate;

  cachedDate = toISTDateString(new Date());
  return cachedDate;
}

/** Reset the cached date (useful if the app stays open across midnight). */
export function resetServerDateCache(): void {
  cachedDate = null;
}

// ---------------------------------------------------------------------------
// Helpers that parse the cached/fetched IST date string
// ---------------------------------------------------------------------------

export function parseISTDate(dateStr: string) {
  // dateStr is "YYYY-MM-DD"
  const [y, m, d] = dateStr.split("-").map(Number);
  return { year: y, month: m - 1, day: d }; // month 0-based
}

const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
] as const;

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** Format the IST date string into a user-friendly display string, e.g. "Monday, 06 Jul 2026". */
export function formatISTDisplay(dateStr: string): string {
  const { year, month, day } = parseISTDate(dateStr);
  const date = new Date(year, month, day);
  const dayName = DAY_NAMES[date.getDay()];
  const dd = String(day).padStart(2, "0");
  const mon = MONTH_ABBR[month];
  return `${dayName}, ${dd} ${mon} ${year}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export function getMonthName(month0: number): string {
  return MONTH_NAMES[month0] ?? "";
}