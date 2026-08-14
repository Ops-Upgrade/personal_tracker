/**
 * Shared formatting utilities.
 * Consolidates repeated formatBytes and formatShortDate implementations
 * from across the Task Manager, Education, and Expense domains.
 */

/**
 * Human-readable byte size string.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Short locale date string (e.g. "7/9/2026"). Returns "—" for null/empty.
 * Accepts ISO timestamps ("2026-07-09T10:30:00Z") and date-only strings
 * ("2026-07-09"); date-only values are parsed at local midnight so the day
 * never shifts across timezones.
 */
export function formatShortDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear().toString().slice(-2)}`;
}