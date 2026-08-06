"use client";

import type { ReactNode } from "react";
import BoxContainer, { SCROLLABLE_CLASSES } from "./BoxContainer";
import SortableHeader from "./SortableHeader";
import type { SortState } from "./SortableHeader";
import type { ViewToggleOption } from "./ViewToggle";
import ViewToggle from "./ViewToggle";
import YearDropdown from "./YearDropdown";
import MonthDropdown from "./MonthDropdown";
import MonthTile from "./MonthTile";
import PriorityBadge from "./PriorityBadge";
import { MONTH_NAMES } from "@/lib/constants";
import type { Priority } from "@/types/common";
import { PRIORITIES } from "@/types/common";
import { getPriorityColor } from "@/lib/priorityColors";

// ── Standard view option presets ──

/**
 * Pre-packaged view option arrays so domain pages don't redefine them.
 * Each set maps to internal view keys: `"all"`, `"months"`, `"priority"`.
 */
export const STANDARD_VIEWS = {
  /** Flat list + month-grouped + priority-grouped views. */
  COMPLETION_MONTHS_PRIORITY: [
    { value: "all", label: "Completion" },
    { value: "months", label: "Months" },
    { value: "priority", label: "Priority" },
  ] as ViewToggleOption<string>[],
  /** Flat list only — no grouped views. */
  ALL_ONLY: [
    { value: "all", label: "All" },
  ] as ViewToggleOption<string>[],
  /** Flat list + month-grouped views (no priority). */
  ALL_MONTHS: [
    { value: "all", label: "All" },
    { value: "months", label: "Months" },
  ] as ViewToggleOption<string>[],
} as const;

// ── Types ──

/**
 * Column definition for a single column in a GenericViewPage grid.
 * @typeParam T - The type of item in each row.
 * @typeParam C - Union of sortable column keys (defaults to `string`).
 */
export interface ColumnDef<T, C extends string = string> {
  /** Unique key for this column (used as React key). */
  key: string;
  /** Column header text. Must be a plain string when sortColumn is set. */
  header: string;
  /** Grid column span out of 12. */
  colSpan: number;
  /** When set, this column renders a SortableHeader with this sort key. */
  sortColumn?: C;
  /** Render the cell contents for a given item. */
  render: (item: T) => ReactNode;
}

/** A group of items keyed by a month label (e.g. "August 2026"). */
export interface MonthGroup<T> {
  label: string;
  items: T[];
  sortKey?: number;
}

/** A group of items keyed by a priority value. */
export interface PriorityGroup<T> {
  priority: string;
  items: T[];
}

/** Configuration for the year dropdown filter. */
export interface YearFilterConfig {
  years: number[];
  selectedYear: number;
  onChange: (year: number) => void;
}

/** Configuration for the month dropdown filter. */
export interface MonthFilterConfig {
  months: number[];
  selectedMonth: number | "all";
  onChange: (month: number | "all") => void;
}

/** Configuration for rendering priority-grouped sections. */
export interface PriorityGroupConfig {
  /** Ordered list of priority values (determines render order). */
  priorities: readonly string[];
  /** Get colour classes for a priority value. */
  getColors: (priority: string) => {
    bg: string;
    border: string;
    text: string;
    dot: string;
  };
  /** Render the priority label / badge in the section header. */
  renderBadge: (priority: string) => ReactNode;
}

interface GenericViewPageProps<T, C extends string = string> {
  // ── Data ──
  /** Flat item array used in the "all" (flat list) view. */
  items: T[];
  /** Default column definitions used by all views unless overridden. */
  columns: ColumnDef<T, C>[];
  /** Stable unique key extractor for each item. */
  getItemKey: (item: T) => string;

  // ── Views ──
  /** Available view options. When provided, a ViewToggle is rendered in the header. */
  views?: ViewToggleOption<string>[];
  /** Currently active view value. */
  activeView?: string;
  /** Called when the user switches views. */
  onViewChange?: (view: string) => void;

  // ── Year filter ──
  /** When provided, a YearDropdown is rendered in the header. */
  yearFilter?: YearFilterConfig;

  // ── Month filter ──
  /** When provided, a MonthDropdown is rendered in the header next to the year dropdown. */
  monthFilter?: MonthFilterConfig;

  // ── Sorting (for flat / completion view) ──
  /** Current sort state (null / undefined = no active sort). */
  sortState?: SortState<C> | null;
  /** Called when a sortable header is clicked. */
  onSortChange?: (next: SortState<C>) => void;

  // ── Empty state ──
  emptyMessage?: string;
  emptySubMessage?: string;

  // ── Row interaction ──
  /** When set, the entire row becomes clickable. */
  onRowClick?: (item: T) => void;
  /** Additional CSS classes for a row. Static string or per-item callback. */
  rowClassName?: string | ((item: T) => string);

  // ── Grouped data ──
  /** Pre-computed month groups for the "months" view. */
  monthGroups?: MonthGroup<T>[];
  /** Pre-computed priority groups for the "priority" view. */
  priorityGroups?: PriorityGroup<T>[];
  /** Configuration for priority section rendering. Defaults use PRIORITIES + getPriorityColor + PriorityBadge. */
  priorityGroupConfig?: PriorityGroupConfig;

  // ── Month tile context ──
  /** Current year (used to highlight the current-month tile). */
  nowYear?: number;
  /** Current 0-indexed month (used to highlight the current-month tile). */
  nowMonth?: number;

  // ── View-specific column overrides ──
  /** Columns for the "all" / flat-list view. Falls back to `columns`. */
  completionColumns?: ColumnDef<T, C>[];
  /** Columns for the "months" view. Falls back to `columns`. Sorting is disabled in this view. */
  monthColumns?: ColumnDef<T, string>[];
  /** Columns for the "priority" view. Falls back to `columns`. Sorting is disabled in this view. */
  priorityColumns?: ColumnDef<T, string>[];
}

// ── Helpers ──

const gridSpan = (n: number): React.CSSProperties => ({
  gridColumn: `span ${n} / span ${n}`,
});

const HEADER_CLASSES =
  "text-xs font-semibold text-zinc-500 uppercase tracking-wider";

// ── Default priority config ──

const DEFAULT_PRIORITY_CONFIG: PriorityGroupConfig = {
  priorities: PRIORITIES as unknown as readonly string[],
  getColors: (p) => getPriorityColor(p as Priority),
  renderBadge: (p) => <PriorityBadge priority={p as Priority} />,
};

// ── Internal grid renderer ──

/**
 * Renders a 12-column grid: sortable headers + rows + empty state.
 * Extracted so all three view strategies (all, months, priority)
 * share the same grid markup without duplication.
 */
function renderGrid<T, C extends string>(
  items: T[],
  columns: ColumnDef<T, C>[],
  getItemKey: (item: T) => string,
  sortState: SortState<C> | null | undefined,
  onSortChange: ((next: SortState<C>) => void) | undefined,
  emptyMessage: string,
  emptySubMessage: string | undefined,
  onRowClick: ((item: T) => void) | undefined,
  rowClassName: string | ((item: T) => string) | undefined,
) {
  const resolveRowClass = (item: T): string => {
    if (typeof rowClassName === "function") return rowClassName(item);
    return rowClassName ?? "";
  };

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
          <div className="grid w-full grid-cols-12 gap-2 px-2 pb-1">
            {columns.map((col) => {
              if (col.sortColumn && sortState !== undefined && onSortChange) {
                return (
                  <div key={col.key} style={gridSpan(col.colSpan)}>
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
                  style={gridSpan(col.colSpan)}
                  className={HEADER_CLASSES}
                >
                  {col.header}
                </div>
              );
            })}
          </div>

          {/* Rows */}
          <div className="space-y-2">
            {items.map((item) => {
              const extra = resolveRowClass(item);
              const clickable = !!onRowClick;
              return (
                <div
                  key={getItemKey(item)}
                  className={`grid w-full grid-cols-12 items-center gap-2 rounded-md border border-zinc-200 px-2 py-1.5 text-left text-sm dark:border-zinc-700 ${extra} ${clickable ? "cursor-pointer" : ""}`}
                  onClick={
                    clickable ? () => onRowClick!(item) : undefined
                  }
                  role={clickable ? "button" : undefined}
                  tabIndex={clickable ? 0 : undefined}
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
                >
                  {columns.map((col) => (
                    <div key={col.key} style={gridSpan(col.colSpan)}>
                      {col.render(item)}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

// ── Component ──

export default function GenericViewPage<T, C extends string = string>({
  items,
  columns,
  getItemKey,
  views,
  activeView,
  onViewChange,
  yearFilter,
  monthFilter,
  sortState,
  onSortChange,
  emptyMessage = "No items.",
  emptySubMessage,
  onRowClick,
  rowClassName,
  monthGroups,
  priorityGroups,
  priorityGroupConfig = DEFAULT_PRIORITY_CONFIG,
  nowYear,
  nowMonth,
  completionColumns,
  monthColumns,
  priorityColumns,
}: GenericViewPageProps<T, C>) {
  const hasHeaderBar = !!(views || yearFilter);
  const currentView = activeView ?? views?.[0]?.value ?? "all";

  // Resolve which columns to use for each view
  const colsForCompletion = completionColumns ?? columns;
  const colsForMonths = monthColumns ?? columns;
  const colsForPriority = priorityColumns ?? columns;

  return (
    <BoxContainer>
      {hasHeaderBar && (
        <header className="mb-3 flex items-center justify-between gap-3">
          <div>
            {views && onViewChange && (
              <ViewToggle
                value={currentView}
                onChange={onViewChange}
                options={views}
                ariaLabel="View toggle"
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            {monthFilter && (
              <MonthDropdown
                months={monthFilter.months}
                selectedMonth={monthFilter.selectedMonth}
                onChange={monthFilter.onChange}
              />
            )}
            {yearFilter && (
              <YearDropdown
                years={yearFilter.years}
                selectedYear={yearFilter.selectedYear}
                onChange={yearFilter.onChange}
              />
            )}
          </div>
        </header>
      )}

      <div
        className={`${SCROLLABLE_CLASSES} space-y-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800`}
      >
        {/* ── All / Flat List View ── */}
        {currentView === "all" &&
          renderGrid(
            items,
            colsForCompletion,
            getItemKey,
            sortState,
            onSortChange,
            emptyMessage,
            emptySubMessage,
            onRowClick,
            rowClassName,
          )}

        {/* ── Priority View ── */}
        {currentView === "priority" && priorityGroups && (
          <>
            {priorityGroupConfig.priorities.map((priority) => {
              const group = priorityGroups.find(
                (g) => g.priority === priority,
              );
              if (!group || group.items.length === 0) return null;
              const colors = priorityGroupConfig.getColors(priority);
              return (
                <section
                  key={priority}
                  className={`rounded-lg border ${colors.border} ${colors.bg} p-2`}
                >
                  <h3 className="mb-2">
                    {priorityGroupConfig.renderBadge(priority)}
                  </h3>
                  {renderGrid(
                    group.items,
                    colsForPriority,
                    getItemKey,
                    undefined, // no sorting in priority view
                    undefined,
                    `No ${priority} items.`,
                    undefined,
                    onRowClick,
                    rowClassName,
                  )}
                </section>
              );
            })}
          </>
        )}

        {/* ── Months View ── */}
        {currentView === "months" && monthGroups && (
          <>
            {monthGroups.map((group, index) => {
              const isCurrentMonth =
                nowYear !== undefined &&
                nowMonth !== undefined &&
                yearFilter?.selectedYear === nowYear &&
                group.label.startsWith(MONTH_NAMES[nowMonth]);
              return (
                <MonthTile
                  key={group.label}
                  title={group.label}
                  defaultExpanded={index === 0}
                  accent
                  className="text-sm"
                  highlight={isCurrentMonth}
                >
                  {renderGrid(
                    group.items,
                    colsForMonths,
                    getItemKey,
                    undefined, // no sorting in month view
                    undefined,
                    `No items in ${group.label}.`,
                    undefined,
                    onRowClick,
                    rowClassName,
                  )}
                </MonthTile>
              );
            })}
          </>
        )}
      </div>
    </BoxContainer>
  );
}
