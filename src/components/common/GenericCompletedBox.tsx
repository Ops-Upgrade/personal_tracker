"use client";

import type { ReactNode } from "react";
import Button from "@/components/common/Button";
import BoxContainer, { SCROLLABLE_CLASSES } from "@/components/common/BoxContainer";
import type { ColumnDef } from "./GenericViewPage";
import GenericDataGrid from "./GenericDataGrid";

/**
 * Minimum shape for a completed item in a summary box.
 */
export interface CompletedSummaryItem {
  id: string;
}

interface GenericCompletedBoxProps<T extends CompletedSummaryItem> {
  items: T[];
  isLoading: boolean;
  onOpenExpanded: () => void;
  title?: string;
  /** Column definitions rendered via GenericDataGrid (shared header/row tracks). */
  columns: ColumnDef<T>[];
  /** Stable unique key for each item. Defaults to `item.id`. */
  getItemKey?: (item: T) => string;
  /** When set, the entire row becomes clickable. */
  onRowClick?: (item: T) => void;
  /** Optional actions to render next to the title (e.g. + Add button) */
  headerActions?: ReactNode;
}

export default function GenericCompletedBox<T extends CompletedSummaryItem>({
  items,
  isLoading,
  onOpenExpanded,
  title = "Completed",
  columns,
  getItemKey,
  onRowClick,
  headerActions,
}: GenericCompletedBoxProps<T>) {
  return (
    <BoxContainer>
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </h2>
          {headerActions}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenExpanded}
          disabled={isLoading}
        >
          View all
        </Button>
      </header>
      <div
        className={`${SCROLLABLE_CLASSES} space-y-1 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800`}
      >
        {isLoading && (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</div>
        )}
        {!isLoading && items.length === 0 && (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">None</div>
        )}
        {!isLoading && items.length > 0 && (
          <GenericDataGrid
            items={items}
            columns={columns}
            getItemKey={getItemKey ?? ((item) => item.id)}
            emptyMessage="None"
            onRowClick={onRowClick}
          />
        )}
      </div>
    </BoxContainer>
  );
}
