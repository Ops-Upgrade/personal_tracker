/**
 * Shared loading indicator with two variants:
 * - "inline" (default) — simple centered spinner, used in pages and boxes.
 * - "contained"  — bordered dashed container with a text message, used in
 *   list/grid views (VaultRecordView, TileView, etc.).
 */
export default function LoadingSpinner({
  className = "",
  message,
}: {
  className?: string;
  /** When provided, renders the contained (bordered) variant with this message. */
  message?: string;
}) {
  if (message) {
    return (
      <div
        className={`flex h-48 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50 ${className}`}
      >
        <span className="text-zinc-500 dark:text-zinc-400">{message}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center py-12 ${className}`}>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
    </div>
  );
}
