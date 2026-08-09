"use client";

import { useState, useCallback } from "react";
import ConfirmDialog from "@/components/common/ConfirmDialog";

interface UseDeleteConfirmOptions {
  /** Singular item name used in titles and descriptions (e.g. "record", "password", "bank"). */
  itemName: string;
  /** Plural form. Defaults to `itemName + "s"`. */
  itemNamePlural?: string;
  /** Override the single-delete description. Defaults to a generic message. */
  singleDescription?: string;
  /** Called with the single item ID to delete. */
  onDelete: (id: string) => Promise<void>;
  /** Called with the currently selected IDs for bulk deletion. */
  onBulkDelete: (ids: string[]) => Promise<void>;
  /** Called after any successful delete to clear the selection. */
  onClearSelection: () => void;
  /** Currently selected item IDs (used for bulk-delete payload). */
  selectedIds: Set<string>;
}

/**
 * Encapsulates deletion confirmation state and renders the associated
 * ConfirmDialog modals. Eliminates the ~35 lines of boilerplate that
 * were duplicated across RecordsView, PasswordView, and BankListView.
 */
export function useDeleteConfirm({
  itemName,
  itemNamePlural,
  singleDescription,
  onDelete,
  onBulkDelete,
  onClearSelection,
  selectedIds,
}: UseDeleteConfirmOptions) {
  const plural = itemNamePlural ?? `${itemName}s`;
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const handleSingleDelete = useCallback(async () => {
    if (!itemToDelete) return;
    await onDelete(itemToDelete);
    setItemToDelete(null);
    onClearSelection();
  }, [itemToDelete, onDelete, onClearSelection]);

  const handleBulkDelete = useCallback(async () => {
    await onBulkDelete(Array.from(selectedIds));
    setIsBulkDeleting(false);
    onClearSelection();
  }, [selectedIds, onBulkDelete, onClearSelection]);

  const singleDesc =
    singleDescription ??
    `This will permanently delete this ${itemName}. This action cannot be undone.`;

  const deleteModals = (
    <>
      {itemToDelete && (
        <ConfirmDialog
          title={`Delete ${itemName}?`}
          description={singleDesc}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={handleSingleDelete}
          onCancel={() => setItemToDelete(null)}
        />
      )}
      {isBulkDeleting && (
        <ConfirmDialog
          title={`Delete selected ${plural}?`}
          description={`This will permanently delete ${selectedIds.size} selected ${plural}. This action cannot be undone.`}
          confirmLabel="Delete All"
          cancelLabel="Cancel"
          onConfirm={handleBulkDelete}
          onCancel={() => setIsBulkDeleting(false)}
        />
      )}
    </>
  );

  return { setItemToDelete, setIsBulkDeleting, deleteModals };
}
