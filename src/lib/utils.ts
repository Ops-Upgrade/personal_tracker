import { type ClassValue, clsx } from "clsx";

/**
 * Merge Tailwind class names conditionally.
 * Lightweight utility — avoids pulling in tailwind-merge for now.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Normalize a date string for use with `<input type="date">`.
 * DB dates are often full ISO strings (e.g. `2024-05-20T00:00:00Z`),
 * but the native date input requires exactly `YYYY-MM-DD`.
 */
export function normalizeDateForInput(
  dateStr: string | null | undefined,
  fallback: string = "",
): string {
  if (!dateStr) return fallback;
  return dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
}
