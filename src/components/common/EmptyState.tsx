/**
 * Standardised empty-state container — extracts the h-48 border-dashed
 * flex container that was hardcoded in VaultRecordView and TileView.
 */
export default function EmptyState({ message = "No items to display." }: { message?: string }) {
  return (
    <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
      <span className="text-zinc-500 dark:text-zinc-400">{message}</span>
    </div>
  );
}
