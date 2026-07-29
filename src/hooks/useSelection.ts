"use client";

import { useState, useCallback } from "react";

/**
 * Shared multi-select state — consolidates the selectedIds Set + helpers
 * that were copy-pasted across RecordsView, PasswordView, BankListView,
 * and GlobalStoreView.
 */
export function useSelection() {
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

  return { selectedIds, toggleSelection, selectAll, clearSelection, setSelectedIds };
}
