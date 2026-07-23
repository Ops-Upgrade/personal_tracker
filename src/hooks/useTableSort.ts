"use client";

import { useMemo } from "react";
import { useLocalStorage } from "@/lib/useLocalStorage";

// ---------- types ----------

export type SortDirection = "asc" | "desc";

export interface SortState<Column extends string = string> {
  column: Column;
  direction: SortDirection;
}

export interface SortConfig<Column extends string, Item> {
  column: Column;
  extractor: (item: Item) => string | number;
}

// ---------- hook ----------

/**
 * Generic table sorting hook.
 *
 * Persists sort state in localStorage and returns a sorted copy of `items`.
 * The three-state cycle (none → asc → desc → none) is handled internally.
 *
 * @param storageKey  localStorage key for persisting sort preferences
 * @param items       the array to sort (unchanged when sortState is null or disabled)
 * @param sortConfigs column → extractor mappings (one per sortable column)
 * @param disableSorting  when true, sorting is skipped and items are returned as-is
 */
export function useTableSort<Column extends string, Item>(
  storageKey: string,
  items: Item[],
  sortConfigs: SortConfig<Column, Item>[],
  disableSorting = false,
) {
  const [sortState, setSortState] = useLocalStorage<SortState<Column> | null>(
    storageKey,
    null,
  );

  /** Called by SortableHeader — receives the FULL next state (column + direction). */
  function handleSort(next: SortState<Column>) {
    setSortState((prev) => {
      // Three-state cycle: clicking the same column that is already "desc" clears the sort.
      if (prev?.column === next.column && prev.direction === "desc") {
        return null;
      }
      return next;
    });
  }

  const sorted = useMemo(() => {
    if (disableSorting || !sortState) return items;

    const { column, direction } = sortState;
    const config = sortConfigs.find((c) => c.column === column);
    if (!config) return items;

    return [...items].sort((a, b) => {
      const aVal = config.extractor(a);
      const bVal = config.extractor(b);

      if (aVal < bVal) return direction === "asc" ? -1 : 1;
      if (aVal > bVal) return direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [items, sortState, disableSorting, sortConfigs]);

  return { sortState, handleSort, sorted };
}
