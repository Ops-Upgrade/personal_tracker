"use client";

import type { ReactNode } from "react";
import type { ColumnDef } from "./GenericViewPage";
import SortableHeader from "./SortableHeader";
import type { SortState } from "./SortableHeader";

// ── Types ──

export interface GenericDataGridProps<T, C extends string = string> {
  /** Items to render. When empty, shows the empty message. */
  items: T[];
  /** Column definitions (header + render + optional sort). */
  columns: ColumnDef<T, C>[];
  /** Stable unique key for each item. */
  getItemKey: (item: T) => string;

  /** Message shown when items is empty. */
  emptyMessage?: string;
  /** Optional secondary message below the empty message. */
  emptySubMessage?: string;

  // ── Sorting (inherited from GenericViewPage) ──
  /** Current sort state. When not provided, column headers render as plain text. */
  sortState?: SortState<C> | null;
  /** Called when a sortable header is clicked. */
  onSortChange?: (next: SortState<C>) => void;

  // ── Row interaction ──
  /** When set, the entire row becomes clickable. */
  onRowClick?: (item: T) => void;
  /** Additional CSS class per row. Static string or per-item callback. */
  rowClassName?: string | ((item: T) => string);
  /** Per-row action button rendered at the end of each row (e.g. "Complete"). */
  rowAction?: (item: T) => ReactNode;
  /** Per-row CSS class modifier (e.g. priority-colored left border). */
  getItemClassName?: (item: T) => string;

  // ── Header visibility ──
  /** When true, hides column headers on mobile screens. Defaults to false. */
  hideHeaderOnMobile?: boolean;

  // ── Action column ──
  /** Width of the spacer for the rowAction column in the header. Defaults to "85px". */
  actionColumnWidth?: string;
}

// ── Helpers ──

const getColSpanClass = (n: number): string => {
  const spans: Record<number, string> = {
    1: "col-span-1",
    2: "col-span-2",
    3: "col-span-3",
    4: "col-span-4",
    5: "col-span-5",
    6: "col-span-6",
    7: "col-span-7",
    8: "col-span-8",
    9: "col-span-9",
    10: "col-span-10",
    11: "col-span-11",
    12: "col-span-12",
  };
  return spans[n] || "col-span-1";
};

const HEADER_CLASSES =
  "text-xs font-semibold text-zinc-500 uppercase tracking-wider";

// ── Component ──

/**
 * Unified 12-column CSS Grid for rendering items with column headers.
 * Extracted from GenericViewPage's renderGrid and GenericActiveBox's renderItemGrid.
 *
 * Used by: GenericViewPage (all/months/priority views), GenericActiveBox (priority sections, month fallback).
 */
export default function GenericDataGrid<T, C extends string = string>({
  items,
  columns,
  getItemKey,
  emptyMessage = "No items.",
  emptySubMessage,
  sortState,
  onSortChange,
  onRowClick,
  rowClassName,
  rowAction,
  getItemClassName,
  hideHeaderOnMobile = false,
  actionColumnWidth = "85px",
}: GenericDataGridProps<T, C>) {
  const resolveRowClass = (item: T): string => {
    if (typeof rowClassName === "function") return rowClassName(item);
    return rowClassName ?? "";
  };

  const headerVisibilityClass = hideHeaderOnMobile
    ? "hidden sm:flex"
    : "flex";

  return (
    <>
      {items.length === 0 ? (
        <div className="px-2 py-3 text-sm text-zinc-500 dark:text-zinc-400">
          <p>{emptyMessage}</p>
          {emptySubMessage && (
            <p className="mt-1 text-xs">{emptySubMessage}</p>
          )}
        </div>
      ) : (
        <>
          {/* Column headers */}
          <div className={`${headerVisibilityClass} items-center gap-2 px-2 pb-2 border-b border-zinc-200 dark:border-zinc-700`}>
            <div className="grid flex-1 gap-2 grid-cols-12 pl-[3px]">
              {columns.map((col) => {
                if (col.sortColumn && sortState !== undefined && onSortChange) {
                  return (
                    <div key={col.key} className={getColSpanClass(col.colSpan)}>
                      <SortableHeader
                        as="div"
                        column={col.sortColumn}
                        label={col.header}
                        sortState={sortState}
                        onSort={onSortChange}
                      />
                    </div>
                  );
                }
                return (
                  <div
                    key={col.key}
                    className={`${HEADER_CLASSES} ${getColSpanClass(col.colSpan)}`}
                  >
                    {col.header}
                  </div>
                );
              })}
            </div>
            {rowAction && <div style={{ width: actionColumnWidth }} />}
          </div>

          {/* Item rows */}
          <div className="space-y-2">
            {items.map((item, i) => {
              const extraClass = resolveRowClass(item) + (getItemClassName ? ` ${getItemClassName(item)}` : "");
              const clickable = !!onRowClick;
              return (
                <div
                  key={getItemKey(item) || i}
                  className={`group flex items-center justify-between gap-2 rounded-md border border-zinc-200 px-2 py-1.5 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60 ${extraClass}`}
                >
                  <div
                    role={clickable ? "button" : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    onClick={
                      clickable ? () => onRowClick!(item) : undefined
                    }
                    onKeyDown={
                      clickable
                        ? (e: React.KeyboardEvent) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onRowClick!(item);
                            }
                          }
                        : undefined
                    }
                    className={`grid flex-1 gap-2 text-left text-sm grid-cols-12 ${clickable ? "cursor-pointer" : ""}`}
                  >
                    {columns.map((col) => (
                      <div key={col.key} className={getColSpanClass(col.colSpan)}>
                        {col.render(item)}
                      </div>
                    ))}
                  </div>
                  {rowAction && rowAction(item)}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
