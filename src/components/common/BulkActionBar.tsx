import type { ReactNode } from "react";

interface BulkActionBarProps {
  /** Number of currently selected items. */
  selectedCount: number;
  /** Called when the user clicks "Clear" or deselect-all. */
  onClear: () => void;
  /** Action buttons rendered between the count label and the clear button. */
  children?: ReactNode;
}

/**
 * Standardised bulk-action bar — shown in place of the search bar when
 * one or more items are selected. Extracted from the raw flexbox HTML
 * duplicated across GlobalStoreView, VaultRecordView, and TileView.
 */
export default function BulkActionBar({ selectedCount, onClear, children }: BulkActionBarProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
        {selectedCount} selected
      </span>
      {children}
      <button
        onClick={onClear}
        className="ml-1 text-sm text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}
