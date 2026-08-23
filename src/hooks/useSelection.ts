"use client";

import { useState, useCallback } from "react";

/**
 * Shared multi-select state — consolidates the selectedIds Set + helpers
 * that were copy-pasted across RecordsView, PasswordView, BankListView,
 * and GlobalStoreView.
 *
 * Pass `items` + `getItemKey` to unlock the `handle*` conveniences used by
 * the generic list pages: `handleSelectAll(checked)` derives every key from
 * the items array instead of requiring the caller to map ids first.
 */
export function useSelection<T = string>(
  items?: T[],
  getItemKey?: (item: T) => string,
) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Conveniences for generic list pages (GenericViewPage selection props).
  const handleToggleSelection = toggleSelection;
  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked && items && getItemKey) {
        setSelectedIds(new Set(items.map(getItemKey)));
      } else {
        setSelectedIds(new Set());
      }
    },
    [items, getItemKey],
  );
  const handleClearSelection = clearSelection;

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    toggleSelection,
    handleToggleSelection,
    selectAll,
    handleSelectAll,
    clearSelection,
    handleClearSelection,
    setSelectedIds,
  };
}
