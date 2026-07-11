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
 * Short locale date string (e.g. "7/9/2026"). Returns "-" for null/empty.
 */
export function formatShortDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}