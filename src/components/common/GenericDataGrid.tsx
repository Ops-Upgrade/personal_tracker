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
}

// ── Helpers ──

/**
 * Builds a shared `grid-template-columns` value from the column definitions,
 * plus a trailing `max-content` track when a per-row action is rendered.
 *
 * - `"fixed"` → `minmax(max-content, var(--fixed-expand))`: sized to its
 *   content on mobile (badges, dates, actions never clip — `0fr` means no
 *   growth) and expanded by one `fr` share from the `md` breakpoint up, so
 *   leftover space spreads evenly between every column instead of pooling
 *   in the flex tracks.
 * - `"flex"`  → `minmax(1ch, weightFr)`: never shrinks below a single
 *   character so the column can't vanish on narrow screens (CSS ellipsis
 *   truncates), grows by `weight` shares of the leftover space.
 *
 * The same template is applied once on the outer grid; the header and every
 * row are subgrids, so all tracks are sized across the full column at once —
 * header/row alignment holds at any viewport width with no breakpoint math.
 */
function buildGridTemplate<T>(columns: ColumnDef<T>[], hasAction: boolean): string {
  const tracks = columns.map((col) => {
    const weight = col.weight ?? 1;
    if (col.sizing === "fixed") {
      return "minmax(max-content, var(--fixed-expand))";
    }
    return `minmax(1ch, ${weight}fr)`;
  });
  if (hasAction) tracks.push("max-content");
  return tracks.join(" ");
}

const HEADER_CLASSES =
  "text-xs font-semibold text-zinc-500 uppercase tracking-wider";

const getAlignClass = (align?: "left" | "center" | "right"): string => {
  if (align === "center") return "justify-center text-center";
  if (align === "right") return "justify-end text-right";
  return "justify-start text-left";
};

// ── Component ──

/**
 * Unified data grid with auto-sizing CSS Grid tracks and subgrid alignment.
 *
 * One outer grid defines `grid-template-columns` from the ColumnDefs; the
 * column header and each item row are `grid-template-columns: subgrid`
 * children spanning all tracks. Track sizing is therefore computed across
 * every row at once, so headers and cells can never drift apart — and
 * `max-content` tracks guarantee fixed columns (badges, dates, actions)
 * always fit their content instead of overflowing at narrow widths.
 *
 * Used by: GenericViewPage (all/months/priority views), GenericActiveBox,
 * GenericCompletedBox.
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
}: GenericDataGridProps<T, C>) {
  const resolveRowClass = (item: T): string => {
    if (typeof rowClassName === "function") return rowClassName(item);
    return rowClassName ?? "";
  };

  if (items.length === 0) {
    return (
      <div className="px-2 py-3 text-sm text-zinc-500 dark:text-zinc-400">
        <p>{emptyMessage}</p>
        {emptySubMessage && (
          <p className="mt-1 text-xs">{emptySubMessage}</p>
        )}
      </div>
    );
  }

  const template = buildGridTemplate(columns, !!rowAction);

  return (
    <div
      className="grid items-stretch w-full min-w-0"
      style={{
        gridTemplateColumns: template,
        columnGap: "0.5rem",
        rowGap: "0.5rem",
      }}
    >
      {/* Column headers — one subgrid row spanning all tracks */}
      <div
        className="col-span-full grid grid-cols-subgrid items-center gap-x-2 border-b border-zinc-200 px-2 pb-2 pl-[3px] dark:border-zinc-700"
        style={{ gridTemplateColumns: "subgrid" }}
      >
        {columns.map((col) => {
          const alignClass = getAlignClass(col.align);
          if (col.sortColumn && sortState !== undefined && onSortChange) {
            return (
              <div key={col.key} className={`min-w-0 truncate ${alignClass}`}>
                <SortableHeader
                  as="div"
                  column={col.sortColumn}
                  label={col.header}
                  sortState={sortState}
                  onSort={onSortChange}
                  align={col.align}
                />
              </div>
            );
          }
          return (
            <div
              key={col.key}
              className={`flex items-center min-w-0 ${HEADER_CLASSES} ${alignClass}`}
              title={col.header}
            >
              <span className="truncate">{col.header}</span>
            </div>
          );
        })}
        {/* Placeholder cell so the header spans the row-action track too. */}
        {rowAction && <div aria-hidden="true" />}
      </div>

      {/* Item rows — each is a subgrid row spanning all tracks */}
      {items.map((item, i) => {
        const extraClass =
          resolveRowClass(item) +
          (getItemClassName ? ` ${getItemClassName(item)}` : "");
        const clickable = !!onRowClick;
        return (
          <div
            key={getItemKey(item) || i}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={clickable ? () => onRowClick!(item) : undefined}
            onKeyDown={
              clickable
                ? (e: React.KeyboardEvent) => {
                  // Ignore events bubbling from inner controls (e.g. rowAction
                  // buttons) so activating them doesn't also trigger the row.
                  if ((e.target as HTMLElement).closest("button, a, input, select, textarea")) {
                    return;
                  }
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onRowClick!(item);
                  }
                }
                : undefined
            }
            className={`group col-span-full grid grid-cols-subgrid items-center gap-x-2 rounded-md border border-zinc-200 px-2 py-1.5 text-left text-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60 ${clickable ? "cursor-pointer" : ""
              } ${extraClass}`}
            style={{ gridTemplateColumns: "subgrid" }}
          >
            {columns.map((col) => {
              const alignClass = col.align ? `text-${col.align}` : "";
              const content = col.render(item);
              const isTruncating = col.sizing !== "fixed";
              return (
                <div
                  key={col.key}
                  className={isTruncating ? `min-w-0 ${alignClass}` : `whitespace-nowrap ${alignClass}`}
                >
                  {isTruncating ? (
                    <div className="w-full truncate">{content}</div>
                  ) : (
                    content
                  )}
                </div>
              );
            })}
            {rowAction && rowAction(item)}
          </div>
        );
      })}
    </div>
  );
}
