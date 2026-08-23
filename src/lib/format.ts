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
 * Short date string in Indian DD/MM/YY order (e.g. "09/07/26").
 * The two-digit year keeps the string at exactly 8 characters so fixed-width
 * date columns stay narrow on mobile grids. Returns "—" for null/empty.
 * Accepts ISO timestamps ("2026-07-09T10:30:00Z") and date-only strings
 * ("2026-07-09"); date-only values are parsed at local midnight so the
 * day never shifts across timezones.
 */
export function formatShortDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}