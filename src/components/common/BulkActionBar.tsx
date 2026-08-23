import type { ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import Button from "./Button";

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
    <div className="flex flex-wrap items-center gap-y-3 gap-x-2 sm:gap-2 sm:flex-nowrap">
      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
        {selectedCount} selected
      </span>
      {children}
      <Button variant="secondary" size="sm" onClick={onClear}>
        Cancel
      </Button>
    </div>
  );
}

// ── Standard bulk actions ──
// The styled Delete/Rename buttons live here rather than in each consumer so
// the store pages and the "/all" view pages can never drift apart again.

interface BulkActionButtonProps {
  onClick: () => void;
  /** Overrides the default button text. */
  label?: string;
}

/** Destructive bulk action — red pill with a trash icon. */
export function BulkActionDeleteButton({ onClick, label = "Delete" }: BulkActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50 transition-colors"
    >
      <Trash2 className="h-4 w-4" /> {label}
    </button>
  );
}

/** Neutral bulk action — zinc pill with a pencil icon. */
export function BulkActionRenameButton({ onClick, label = "Rename" }: BulkActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors"
    >
      <Pencil className="h-4 w-4" /> {label}
    </button>
  );
}
