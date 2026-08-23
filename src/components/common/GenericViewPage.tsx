"use client";

import { useMemo, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import BoxContainer, { SCROLLABLE_CLASSES } from "./BoxContainer";
import type { SortState } from "./SortableHeader";
import ViewToggle from "./ViewToggle";
import type { ViewToggleOption } from "./ViewToggle";
import DataListView from "./DataListView";
import GenericDataGrid, { type GridSelection } from "./GenericDataGrid";
import GenericPriorityList from "./GenericPriorityList";
import GenericMonthsList from "./GenericMonthsList";
import YearDropdown from "./YearDropdown";
import MonthDropdown from "./MonthDropdown";
import PriorityBadge from "./PriorityBadge";
import BulkActionBar from "./BulkActionBar";
import Button from "./Button";
import type { Priority } from "@/types/common";
import { PRIORITIES, MONTHS } from "@/types/common";
import { getPriorityColor } from "@/lib/priorityColors";
import { useSelection } from "@/hooks/useSelection";
import { useTableSort, type SortConfig } from "@/hooks/useTableSort";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { stripHtml } from "@/lib/viewHelpers";

// ── Types ──

/** Union of values a month filter can select: all, a specific 0-based month, or unscheduled. */
export type MonthFilterValue = number | "all" | "unscheduled";

/** View keys understood by GenericViewPage. */
export type ViewKey = "all" | "months" | "priority";

/** Preset text colour tokens for text cells (classes live in GenericDataGrid). */
export type TextColor = "strong" | "plain" | "muted" | "faint";

/**
 * Declarative cell token — the generic grid engine parses these to construct
 * cell DOM and Tailwind classes internally. Domains may not inject JSX into
 * table cells; every cell is one of the supported token types.
 */
export type ColumnToken<T> =
  | {
      type: "text";
      /** Returns the raw text or number value. */
      accessor: (item: T) => string | number | null | undefined;
      /** Preset colour classes. Defaults to "muted". */
      color?: TextColor;
      /** Extra Tailwind classes appended to the text span. */
      className?: string;
      /** Render the text capitalised (e.g. task modes). */
      capitalize?: boolean;
      /** Smaller text size (used by compact status/mode cells). */
      size?: "xs";
      /** Static prefix rendered before the value (e.g. "₹ "). */
      prefix?: string;
      /** Locale for numeric values, e.g. "en-IN" (1,23,456). */
      localeFormat?: string;
    }
  | {
      type: "date";
      /** Returns the raw date string (ISO timestamp or YYYY-MM-DD). */
      accessor: (item: T) => string | null | undefined;
      /** Extra Tailwind classes appended to the date span. */
      className?: string;
    }
  | {
      type: "richtext";
      /** Returns raw Tiptap HTML, stripped to plain text by the engine. */
      accessor: (item: T) => string | null | undefined;
      /** Extra Tailwind classes appended to the text span. */
      className?: string;
    }
  | {
      type: "badge";
      /** Returns the priority value; null/undefined renders an em dash. */
      accessor: (item: T) => Priority | null | undefined;
    }
  | {
      type: "files";
      /** How many attached documents an item has. */
      getCount: (item: T) => number;
      /** Tailwind text colour for the paperclip icon. */
      iconColorClass: string;
      /** Tailwind text colour for the "(n)" count label. */
      countClass?: string;
    }
  | {
      type: "boolean";
      /** Returns the boolean value rendered as a status chip. */
      accessor: (item: T) => boolean;
      /** Label shown when the value is true. */
      trueLabel: string;
      /** Tailwind colour classes shown when the value is true. */
      trueColorClass: string;
      /** Label shown when the value is false (defaults to `trueLabel`). */
      falseLabel?: string;
      /** Tailwind colour classes shown when the value is false. */
      falseColorClass: string;
    };

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
  /**
   * Track sizing for this column (no breakpoint math — widths are emergent).
   * `"fixed"` → `minmax(max-content, var(--fixed-expand))`: sized to its
   *             content on mobile (dates, badges, files, actions, short
   *             mode labels never clip or overflow), expands by one `fr`
   *             share from the `md` breakpoint up so leftover space spreads
   *             evenly between every column.
   * `"flex"`  → `minmax(6rem, weightFr)`: takes leftover space by `weight`
   *             share, truncates gracefully, and never shrinks below a
   *             readable minimum. Use for names, descriptions, providers.
   */
  sizing: "fixed" | "flex";
  /** Relative space share for flex columns. Default: 1. Higher = more space. */
  weight?: number;
  /** When set, this column renders a SortableHeader with this sort key. */
  sortColumn?: C;
  /**
   * Declarative cell token — the preferred way to describe cell content; the
   * grid engine renders it internally. Optional only while unmigrated widgets
   * still carry a legacy `render` below.
   */
  token?: ColumnToken<T>;
  /**
   * Legacy JSX render function. DEPRECATED: retained only for widgets that
   * have not yet migrated (GenericCompletedBox consumers)
   * and for interactive cells (action buttons) tokens cannot model. When
   * present it wins over `token`. GenericViewPage routes must use `token` only.
   */
  render?: (item: T) => ReactNode;
  /** Horizontal alignment of the column content. Defaults to left. */
  align?: "left" | "center" | "right";
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

/** One stat block rendered above the grids. */
export interface Metric<T> {
  label: string;
  /**
   * Static value, or a function receiving the currently visible items
   * (year + month filtered) so domains can total filtered data declaratively.
   */
  value: string | number | ((visibleItems: T[]) => string | number);
  /** Display format. `"currency-INR"` prefixes ₹ with en-IN grouping. */
  format?: "currency-INR";
}

interface GenericViewPageProps<T, C extends string = string> {
  // ── Data ──
  /** Raw, unfiltered data — the page derives year/month/priority filtering internally. */
  data: T[];
  /** Declarative column definitions (token-based — no render functions). */
  columns: ColumnDef<T, C>[];
  /** Stable unique key extractor for each item. */
  getItemKey: (item: T) => string;

  // ── Caching & sort defaults ──
  /** Route-unique prefix for localStorage view/sort cache keys (e.g. "taskmanager_completed"). */
  cacheKeyPrefix: string;
  /** Default sort applied when no sort is cached (pass null for no default). */
  defaultSort: SortState<C> | null;
  /** Which views the route supports (flat list, month tiles, priority groups). */
  supportedViews: ViewKey[];

  // ── Date / priority derivation ──
  /** Date key used for year/month filtering and the year dropdown derivation. */
  getDateKey: (item: T) => string | null;
  /** Priority key used for internal priority grouping (enables the priority view). */
  getPriorityKey?: (item: T) => string;
  /**
   * Month-tile semantics. `"active"` groups by the date key into Unscheduled +
   * January–December tiles; `"completed"` groups by the date key into
   * newest-first "Month Year" tiles.
   */
  monthsMode?: "active" | "completed";

  // ── Row interaction ──
  /** When set, the entire row becomes clickable. */
  onRowClick?: (item: T) => void;
  /** Additional CSS classes for a row. Static string or per-item callback. */
  rowClassName?: string | ((item: T) => string);
  /** Per-row action button (e.g. "Reopen") rendered in the trailing actions track. */
  rowAction?: (item: T) => ReactNode;

  // ── Empty state & metrics ──
  /** Plural item name for the built-in empty messages (e.g. "expenses"). */
  itemNamePlural?: string;
  /** Stat blocks rendered securely above the grids. */
  metrics?: Metric<T>[];

  // ── Bulk delete ──
  /**
   * When provided, the bulk action bar shows a Delete button while rows are
   * selected. When absent, checkboxes are still present but no action bar
   * ever appears.
   */
  onBulkDelete?: (ids: string[], clearFn: () => void) => void;

  // ── Clock (server-derived where available) ──
  /** Current year (drives the year dropdown default and month highlights). */
  nowYear?: number;
  /** Current 0-indexed month (drives current-month highlight). */
  nowMonth?: number;
}

// ── Helpers ──

const MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

const VIEW_OPTION_LABELS: Record<ViewKey, string> = {
  all: "All",
  months: "Months",
  priority: "Priority",
};

/** Parse a date key as a LOCAL date — date-only keys (YYYY-MM-DD) get a local
 *  midnight so getFullYear()/getMonth() reflect the user's calendar, while
 *  full ISO timestamps (created_at / completed_at) parse directly. */
function parseDateKey(key: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return new Date(`${key}T00:00:00`);
  return new Date(key);
}

/**
 * Builds `SortConfig`s from the declarative column tokens — the engine sorts
 * via each column's own accessor, so domains never pass sort extractors.
 * Normalisation mirrors the previous per-domain SORT_CONFIGS: strings compare
 * case-insensitively, dates lexicographically, richtext stripped, priorities
 * by canonical rank, booleans as 0/1, numbers numerically.
 */
function deriveSortConfigs<T, C extends string>(
  columns: ColumnDef<T, C>[],
): SortConfig<C, T>[] {
  const configs: SortConfig<C, T>[] = [];
  for (const col of columns) {
    if (!col.sortColumn) continue;
    const column = col.sortColumn;
    const token = col.token;
    if (!token) continue;
    // Capture the narrowed accessor inside each case so the closures below
    // keep the discriminated-union narrowing.
    switch (token.type) {
      case "text": {
        const accessor = token.accessor;
        configs.push({
          column,
          extractor: (item) => {
            const value = accessor(item);
            if (value === null || value === undefined) return "";
            return typeof value === "number" ? value : value.toLowerCase();
          },
        });
        break;
      }
      case "date": {
        const accessor = token.accessor;
        configs.push({ column, extractor: (item) => accessor(item) ?? "" });
        break;
      }
      case "richtext": {
        const accessor = token.accessor;
        configs.push({
          column,
          extractor: (item) => stripHtml(accessor(item) ?? "").toLowerCase(),
        });
        break;
      }
      case "badge": {
        const accessor = token.accessor;
        configs.push({
          column,
          extractor: (item) => {
            const priority = accessor(item);
            if (!priority) return 99;
            const index = PRIORITIES.indexOf(priority);
            return index === -1 ? 99 : index;
          },
        });
        break;
      }
      case "files": {
        const getCount = token.getCount;
        configs.push({ column, extractor: (item) => getCount(item) });
        break;
      }
      case "boolean": {
        const accessor = token.accessor;
        configs.push({ column, extractor: (item) => (accessor(item) ? 1 : 0) });
        break;
      }
    }
  }
  return configs;
}

/** Active-item month tiles: Unscheduled first, then January–December of the
 *  selected year (matches the GenericDomainPage dashboard months UX). */
function groupActiveByMonths<T>(
  items: T[],
  year: number,
  getDateKey: (item: T) => string | null,
): MonthGroup<T>[] {
  const monthMap = new Map<number, T[]>();
  for (let i = 0; i < 12; i++) monthMap.set(i, []);
  const unscheduled: T[] = [];

  for (const item of items) {
    const dateKey = getDateKey(item);
    if (!dateKey) {
      unscheduled.push(item);
      continue;
    }
    const date = parseDateKey(dateKey);
    if (date.getFullYear() !== year) continue;
    monthMap.get(date.getMonth())!.push(item);
  }

  const groups: MonthGroup<T>[] = [];
  if (unscheduled.length > 0) {
    groups.push({ label: "Unscheduled", items: unscheduled, sortKey: 999 });
  }
  for (const [monthIndex] of MONTHS.entries()) {
    groups.push({
      label: MONTH_YEAR_FORMATTER.format(new Date(year, monthIndex)),
      items: monthMap.get(monthIndex)!,
      sortKey: monthIndex,
    });
  }
  return groups;
}

/** Completed-item month tiles: one "Month Year" tile per month that has
 *  items, newest first (mirrors the legacy completedByMonths semantics). */
function groupCompletedByMonths<T>(
  items: T[],
  getDateKey: (item: T) => string | null,
): MonthGroup<T>[] {
  const monthMap = new Map<string, { items: T[]; sortKey: number }>();

  for (const item of items) {
    const dateKey = getDateKey(item);
    if (!dateKey) continue;
    const completed = new Date(dateKey);
    const label = MONTH_YEAR_FORMATTER.format(completed);
    const timestamp = completed.getTime();

    const existing = monthMap.get(label);
    if (!existing) {
      monthMap.set(label, { items: [item], sortKey: timestamp });
      continue;
    }
    existing.items.push(item);
    existing.sortKey = Math.max(existing.sortKey, timestamp);
  }

  return Array.from(monthMap.entries())
    .map(([label, value]) => ({
      label,
      items: value.items,
      sortKey: value.sortKey,
    }))
    .sort((a, b) => b.sortKey - a.sortKey);
}

// ── Component ──

export default function GenericViewPage<T, C extends string = string>({
  data,
  columns,
  getItemKey,
  cacheKeyPrefix,
  defaultSort,
  supportedViews,
  getDateKey,
  getPriorityKey,
  monthsMode = "active",
  onRowClick,
  rowClassName,
  rowAction,
  itemNamePlural = "items",
  metrics,
  onBulkDelete,
  nowYear,
  nowMonth,
}: GenericViewPageProps<T, C>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentYear = nowYear ?? new Date().getFullYear();

  // ── Year / month filters — derived from URL query params (single source
  //    of truth). The dropdowns write to the URL and the URL drives the
  //    state, so back/forward navigation always stays in sync without any
  //    duplicated local state.

  const urlYear = searchParams.get("year");
  const urlMonth = searchParams.get("month");

  const selectedYear =
    urlYear && !Number.isNaN(Number(urlYear)) ? Number(urlYear) : currentYear;
  const selectedMonth: MonthFilterValue =
    urlMonth === "unscheduled"
      ? "unscheduled"
      : urlMonth && !Number.isNaN(Number(urlMonth))
        ? Number(urlMonth)
        : "all";

  const handleYearChange = (year: number) => {
    // Dropping the month param resets the month filter to "all".
    router.replace(`${pathname}?year=${year}`, { scroll: false });
  };

  const handleMonthChange = (month: MonthFilterValue) => {
    const params = new URLSearchParams();
    params.set("year", String(selectedYear));
    if (month !== "all") params.set("month", String(month));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // ── View & sort caching (route-specific keys) ──

  const [storedView, setStoredView] = useLocalStorage<string>(
    `${cacheKeyPrefix}.view`,
    supportedViews[0] ?? "all",
  );
  const currentView: ViewKey = supportedViews.includes(storedView as ViewKey)
    ? (storedView as ViewKey)
    : (supportedViews[0] ?? "all");

  const viewOptions: ViewToggleOption<ViewKey>[] = useMemo(
    () => supportedViews.map((value) => ({ value, label: VIEW_OPTION_LABELS[value] })),
    [supportedViews],
  );

  // ── Derived data (year filter) ──

  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear]);
    for (const item of data) {
      const dateKey = getDateKey(item);
      if (!dateKey) continue;
      years.add(parseDateKey(dateKey).getFullYear());
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [data, getDateKey, currentYear]);

  const itemsForYear = useMemo(
    () =>
      data.filter((item) => {
        const dateKey = getDateKey(item);
        // Items without a date are unscheduled and belong to every year view.
        if (!dateKey) return true;
        return parseDateKey(dateKey).getFullYear() === selectedYear;
      }),
    [data, getDateKey, selectedYear],
  );

  // ── Sorting (3-state cycle + defaultSort enforcement) ──

  const sortConfigs = useMemo(() => deriveSortConfigs(columns), [columns]);

  const { sortState, handleSort, sorted } = useTableSort(
    `${cacheKeyPrefix}.sort`,
    itemsForYear,
    sortConfigs,
    false,
    defaultSort,
  );

  // ── Month filter (flat view only) ──

  const itemsForMonth = useMemo(() => {
    if (selectedMonth === "all") return sorted;
    if (selectedMonth === "unscheduled") {
      return sorted.filter((item) => !getDateKey(item));
    }
    return sorted.filter((item) => {
      const dateKey = getDateKey(item);
      if (!dateKey) return false;
      return parseDateKey(dateKey).getMonth() === selectedMonth;
    });
  }, [sorted, selectedMonth, getDateKey]);

  // ── Grouped views ──

  const monthGroups = useMemo(() => {
    if (!supportedViews.includes("months")) return [];
    if (monthsMode === "completed") return groupCompletedByMonths(sorted, getDateKey);
    return groupActiveByMonths(sorted, selectedYear, getDateKey);
  }, [supportedViews, monthsMode, sorted, selectedYear, getDateKey]);

  const priorityGroups: PriorityGroup<T>[] = useMemo(() => {
    if (!getPriorityKey || !supportedViews.includes("priority")) return [];
    const groups = PRIORITIES.map((priority) => ({ priority, items: [] as T[] }));
    for (const item of sorted) {
      const priority = getPriorityKey(item);
      groups.find((group) => group.priority === priority)?.items.push(item);
    }
    return groups.filter((group) => group.items.length > 0);
  }, [getPriorityKey, supportedViews, sorted]);

  // Priority view groups by priority already, so drop the redundant Priority column.
  const priorityViewColumns = useMemo(
    () => columns.filter((col) => col.key !== "priority"),
    [columns],
  );

  // ── Inherent bulk selection (checkboxes on every view) ──

  const visibleItems = currentView === "all" ? itemsForMonth : sorted;
  const { selectedIds, handleToggleSelection, handleSelectAll, handleClearSelection } =
    useSelection(visibleItems, getItemKey);

  const selection: GridSelection = {
    selectedKeys: selectedIds,
    onToggle: handleToggleSelection,
    onSelectAll: handleSelectAll,
    itemsLength: visibleItems.length,
  };

  // Only the Delete action exists; the bar appears solely when the route
  // opted into bulk delete via onBulkDelete.
  const bulkActionBar =
    onBulkDelete && selectedIds.size > 0 ? (
      <BulkActionBar selectedCount={selectedIds.size} onClear={handleClearSelection}>
        <Button
          variant="danger"
          size="sm"
          onClick={() => onBulkDelete(Array.from(selectedIds), handleClearSelection)}
        >
          Delete
        </Button>
      </BulkActionBar>
    ) : undefined;

  // ── Empty state & metrics ──

  const emptyMessage =
    selectedMonth === "all"
      ? `No ${itemNamePlural} found in ${selectedYear}.`
      : selectedMonth === "unscheduled"
        ? `No unscheduled ${itemNamePlural}.`
        : `No ${itemNamePlural} found in ${selectedYear} for the selected month.`;

  const metricBlocks = useMemo(() => {
    if (!metrics) return null;
    return metrics.map((metric) => {
      const rawValue =
        typeof metric.value === "function" ? metric.value(itemsForMonth) : metric.value;
      const display =
        metric.format === "currency-INR"
          ? `₹ ${Number(rawValue).toLocaleString("en-IN")}`
          : String(rawValue);
      return (
        <div
          key={metric.label}
          className="flex min-w-[10rem] flex-1 flex-col gap-1 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {metric.label}
          </span>
          <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {display}
          </span>
        </div>
      );
    });
  }, [metrics, itemsForMonth]);

  // Flat list grid.
  const flatGrid = (
    <GenericDataGrid
      items={itemsForMonth}
      columns={columns}
      getItemKey={getItemKey}
      sortState={sortState}
      onSortChange={handleSort}
      emptyMessage={emptyMessage}
      onRowClick={onRowClick}
      rowClassName={rowClassName}
      rowAction={rowAction}
      selection={selection}
    />
  );

  // ── Render ──

  return (
    <BoxContainer>
      {/* Double-header flex wrapping: on narrow screens the year/month filters
          wrap neatly beneath the left-aligned ViewToggle. */}
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          {viewOptions.length > 1 && (
            <ViewToggle
              value={currentView}
              onChange={(view) => setStoredView(view)}
              options={viewOptions}
              ariaLabel="View toggle"
              hideContainerOnMobile={false}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {currentView === "all" && (
            <MonthDropdown selectedMonth={selectedMonth} onChange={handleMonthChange} />
          )}
          <YearDropdown
            years={availableYears}
            selectedYear={selectedYear}
            onChange={handleYearChange}
          />
        </div>
      </header>

      {metricBlocks && <div className="mb-3 flex flex-wrap gap-3">{metricBlocks}</div>}

      <DataListView
        selectionEnabled
        selectedCount={selectedIds.size}
        totalCount={visibleItems.length}
        onSelectAll={handleSelectAll}
        onClearSelection={handleClearSelection}
        bulkActionBar={bulkActionBar}
        isLoading={false}
        isEmpty={data.length === 0}
        isFilteredEmpty={false}
        emptyMessage={emptyMessage}
        itemCount={visibleItems.length}
        renderContent={() => (
          <div
            className={`${SCROLLABLE_CLASSES} space-y-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800`}
          >
            {/* ── All / Flat List View ── */}
            {currentView === "all" && flatGrid}

            {/* ── Priority View ── */}
            {currentView === "priority" &&
              (priorityGroups.length > 0 ? (
                <GenericPriorityList
                  priorities={PRIORITIES}
                  getItems={(priority) =>
                    priorityGroups.find((group) => group.priority === priority)?.items ?? []
                  }
                  getColors={(priority) => getPriorityColor(priority as Priority)}
                  renderBadge={(priority) => (
                    <PriorityBadge priority={priority as Priority} showTextOnMobile />
                  )}
                  columns={priorityViewColumns}
                  getItemKey={getItemKey}
                  sortState={sortState}
                  onSortChange={handleSort}
                  hideEmpty
                  onRowClick={onRowClick}
                  rowClassName={rowClassName}
                  rowAction={rowAction}
                  selection={selection}
                />
              ) : (
                <GenericDataGrid
                  items={[]}
                  columns={priorityViewColumns}
                  getItemKey={getItemKey}
                  emptyMessage={emptyMessage}
                  selection={selection}
                />
              ))}

            {/* ── Months View ── */}
            {currentView === "months" &&
              (monthGroups.length > 0 && sorted.length > 0 ? (
                <GenericMonthsList
                  monthGroups={monthGroups}
                  columns={columns}
                  getItemKey={getItemKey}
                  nowYear={currentYear}
                  nowMonth={nowMonth ?? new Date().getMonth()}
                  selectedYear={selectedYear}
                  onRowClick={onRowClick}
                  rowClassName={rowClassName}
                  rowAction={rowAction}
                  selection={selection}
                />
              ) : (
                <GenericDataGrid
                  items={[]}
                  columns={columns}
                  getItemKey={getItemKey}
                  emptyMessage={emptyMessage}
                  selection={selection}
                />
              ))}
          </div>
        )}
      />
    </BoxContainer>
  );
}
