"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BackButton from "@/components/common/BackButton";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import ErrorBanner from "@/components/common/ErrorBanner";
import Button from "@/components/common/Button";
import BoxContainer, { SCROLLABLE_CLASSES } from "@/components/common/BoxContainer";
import ViewToggle, { type ViewToggleOption } from "@/components/common/ViewToggle";
import YearDropdown from "@/components/common/YearDropdown";
import GenericMonthRow from "@/components/common/GenericMonthRow";
import GenericPriorityList from "@/components/common/GenericPriorityList";
import GenericDataGrid from "@/components/common/GenericDataGrid";
import type { ColumnDef } from "@/components/common/GenericViewPage";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { MONTHS } from "@/types/common";
import { LayoutGrid, List, Table } from "lucide-react";

// ── Types ──

/** View keys understood by the dashboard engine. */
export type DashboardViewKey = "months" | "priority" | "all" | "single" | "multi";

/** Info handed to the headerStat render-prop so domains can total the
 *  engine's own year-filtered data (the selected year is engine state). */
export interface DashboardHeaderInfo<T> {
  selectedYear: number;
  itemsForYear: T[];
}

export interface GenericDomainPageProps<T> {
  // ── Raw data + rendering config ──
  /** Raw, unfiltered data — the engine derives year/month/priority buckets internally. */
  data: T[];
  /** Column definitions for the internal grids (priority column is dropped
   *  automatically in the priority view). */
  columns: ColumnDef<T>[];
  domain: "taskmanager" | "education" | "expense" | "medical";
  /** Date key used for year/month bucketing, the year dropdown derivation,
   *  and the Unscheduled bucket (null → unscheduled). */
  getDateKey: (item: T) => string | null;
  /** Stable unique key for each item. Defaults to `item.id`. */
  getItemKey?: (item: T) => string;
  /** Which view toggles this domain dashboard supports. */
  supportedViews: readonly string[];
  /** localStorage key persisting the view toggle selection. */
  viewCacheKey: string;

  // ── Header ──
  title: string;
  description: string;
  backHref: string;
  /** Opens the domain's create modal ("+ Add" button). */
  onAdd: () => void;
  /** Stat line under the description; receives the engine's selected year
   *  and year-filtered items (e.g. yearly total, record count). */
  headerStat?: (info: DashboardHeaderInfo<T>) => ReactNode;
  storeHref?: string;
  storeLabel?: string;
  storeIcon?: ReactNode;

  // ── Page state (auth bootstrap results owned by the domain hook) ──
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  /** IST-derived clock (server date) for the year default + month highlight. */
  nowYear?: number;
  nowMonth?: number;

  // ── Priority view opt-in ──
  priorities?: readonly string[];
  /** Extracts the priority value from an item (required with priorities). */
  getPriorityKey?: (item: T) => string;
  getPriorityColor?: (priority: string) => { border: string; bg: string };
  renderPriorityBadge?: (priority: string) => ReactNode;

  // ── Rows ──
  onRowClick?: (item: T) => void;
  rowClassName?: string | ((item: T) => string);
  /** Per-row action button (e.g. "Complete" for tasks/education). */
  rowAction?: (item: T) => ReactNode;
  /** Subtitle rendered in each GenericMonthRow (e.g. "5 tasks"). */
  getSubtitle?: (items: T[]) => ReactNode;
  /** Base href for "View All" navigation. Appended with ?year=X&month=Y. */
  viewAllBaseHref?: string;
  /** Empty-state message (defaults to "None"). */
  emptyMessage?: string;

  // ── Layout slots ──
  /** Completed items panel (right column in the dual-column layout). */
  completedSlot?: ReactNode;
  /** Miscellaneous slot below completedSlot (Task: NotesBox stack). */
  miscSlot?: ReactNode;
  /** Modal rendered at the top level (outside the layout shell). */
  modalSlot?: ReactNode;
}

// ── Internal helpers ──

/** View toggle labels: text for month/priority, icons for grid views. */
const DASHBOARD_VIEW_LABELS: Record<string, ReactNode> = {
  all: <Table className="h-4 w-4" />,
  single: <List className="h-4 w-4" />,
  multi: <LayoutGrid className="h-4 w-4" />,
  months: "Months",
  priority: "Priority",
};

const MONTH_VIEW_KEYS = new Set<string>(["months", "single", "multi"]);

/** Parse a date key as a LOCAL date — date-only keys (YYYY-MM-DD) get a local
 *  midnight so getFullYear()/getMonth() reflect the user's calendar, while
 *  full ISO timestamps parse directly. */
function parseDateKey(key: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return new Date(`${key}T00:00:00`);
  return new Date(key);
}

function StoreLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-center gap-2 w-full rounded-xl border border-zinc-200 bg-white p-4 shadow-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800/80 transition-colors"
    >
      {icon}
      {label}
    </Link>
  );
}

// ── Component ──

/**
 * Unified dashboard engine for the 4 domain dashboards (Task Manager,
 * Education, Expense, Medical). Owns everything structural: the year
 * dropdown (always visible), strict year filtering of `data`, the
 * MONTHS.map iteration with the permanent Unscheduled bucket, the
 * GenericMonthRow grids (months/single/multi), the GenericPriorityList
 * (priority view), the flat grid (all view), the view toggle, the
 * current-month auto-scroll hook, and the single-vs-multi masonry CSS.
 * Domains opt in with raw data + declarative config — no renderBody
 * closures, manual year state, month loops, or layout CSS.
 *
 * Layout rules:
 * - When `completedSlot` is provided → dual-column (2/3 + 1/3 grid);
 *   the sidebars natively stack below the main content on mobile.
 * - Otherwise → full-width layout with header stat + store button in the
 *   header row (store button stretches to w-full on mobile).
 */
export default function GenericDomainPage<T>({
  data,
  columns,
  domain,
  getDateKey,
  getItemKey = (item) => String((item as { id?: string }).id ?? ""),
  supportedViews,
  viewCacheKey,
  title,
  description,
  backHref,
  onAdd,
  headerStat,
  storeHref,
  storeLabel = "Store",
  storeIcon,
  isLoading,
  error,
  onRetry,
  nowYear,
  nowMonth,
  priorities,
  getPriorityKey,
  getPriorityColor,
  renderPriorityBadge,
  onRowClick,
  rowClassName,
  rowAction,
  getSubtitle,
  viewAllBaseHref,
  emptyMessage,
  completedSlot,
  miscSlot,
  modalSlot,
}: GenericDomainPageProps<T>) {
  const currentYear = nowYear ?? new Date().getFullYear();
  const currentMonth = nowMonth ?? new Date().getMonth();

  // ── Engine-owned state: selected year + view toggle ──

  const [selectedYear, setSelectedYear] = useState(currentYear);

  const [storedView, setStoredView] = useLocalStorage<string>(
    viewCacheKey,
    supportedViews[0] ?? "months",
  );
  const currentView: string = supportedViews.includes(storedView)
    ? storedView
    : (supportedViews[0] ?? "months");
  const isMonthView = MONTH_VIEW_KEYS.has(currentView);

  // ── Year derivation + strict year filtering (non-negotiable) ──

  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear]);
    for (const item of data) {
      const dateKey = getDateKey(item);
      if (!dateKey) continue;
      years.add(parseDateKey(dateKey).getFullYear());
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [data, getDateKey, currentYear]);

  // Every view (month rows, priority columns, flat list) reads from this —
  // items without a date are unscheduled and belong to every year view.
  const itemsForYear = useMemo(
    () =>
      data.filter((item) => {
        const dateKey = getDateKey(item);
        if (!dateKey) return true;
        return parseDateKey(dateKey).getFullYear() === selectedYear;
      }),
    [data, getDateKey, selectedYear],
  );

  // ── Month bucketing (internal MONTHS.map — never leaked to domains) ──

  const monthBuckets = useMemo(() => {
    const byIndex = new Map<number, T[]>();
    for (let i = 0; i < 12; i++) byIndex.set(i, []);
    const unscheduled: T[] = [];
    for (const item of itemsForYear) {
      const dateKey = getDateKey(item);
      if (!dateKey) {
        unscheduled.push(item);
        continue;
      }
      byIndex.get(parseDateKey(dateKey).getMonth())!.push(item);
    }
    return { byIndex, unscheduled };
  }, [itemsForYear, getDateKey]);

  // ── Priority grouping (internal byPriority) ──

  const priorityGroups = useMemo(() => {
    if (!priorities || !getPriorityKey) return null;
    const groups: Record<string, T[]> = {};
    for (const p of priorities) groups[p] = [];
    for (const item of itemsForYear) {
      const bucket = groups[getPriorityKey(item)];
      if (bucket) bucket.push(item);
    }
    // Due-date ascending, unscheduled first (matches the legacy byPriority).
    for (const p of priorities) {
      groups[p].sort((a, b) => {
        const aDate = getDateKey(a);
        const bDate = getDateKey(b);
        if (!aDate && !bDate) return 0;
        if (!aDate) return -1;
        if (!bDate) return 1;
        return parseDateKey(aDate).getTime() - parseDateKey(bDate).getTime();
      });
    }
    return groups;
  }, [priorities, getPriorityKey, itemsForYear, getDateKey]);

  // Priority view groups by priority already, so drop the redundant Priority column.
  const priorityViewColumns = useMemo(
    () => columns.filter((col) => col.key !== "priority"),
    [columns],
  );

  const viewOptions: ViewToggleOption<string>[] = useMemo(
    () => supportedViews.map((value) => ({ value, label: DASHBOARD_VIEW_LABELS[value] ?? value })),
    [supportedViews],
  );

  // ── Current-month auto-scroll (critical on mobile with the isolated
  //    scroll container — users must not swipe past 11 empty months) ──

  useEffect(() => {
    if (isLoading || !isMonthView) return;
    const timeout = setTimeout(() => {
      document
        .getElementById("current-month-tile")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => clearTimeout(timeout);
  }, [isLoading, isMonthView, selectedYear, currentView]);

  // ── Internal view renderers ──

  const resolveItemClassName = (item: T): string =>
    typeof rowClassName === "function" ? rowClassName(item) : (rowClassName ?? "");

  const monthRow = (monthName: string, monthIndex: number, items: T[]) => {
    const isCurrentMonth =
      monthIndex >= 0 && selectedYear === currentYear && monthIndex === currentMonth;
    return (
      <GenericMonthRow
        key={monthName}
        monthName={monthName}
        monthIndex={monthIndex}
        year={selectedYear}
        items={items}
        isCurrentMonth={isCurrentMonth}
        getDate={getDateKey}
        getSubtitle={getSubtitle ?? (() => null)}
        viewAllHref={
          viewAllBaseHref
            ? `${viewAllBaseHref}?year=${selectedYear}&month=${monthIndex < 0 ? "unscheduled" : monthIndex}`
            : "#"
        }
        columns={columns}
        getItemKey={getItemKey}
        previewCount={5}
        onRowClick={onRowClick}
        rowAction={rowAction}
        getItemClassName={resolveItemClassName}
      />
    );
  };

  const monthRows = (
    <div
      className={
        currentView === "multi"
          ? "flex flex-col md:block md:columns-2 gap-4 md:gap-4 space-y-4 md:space-y-4"
          : "flex flex-col gap-4"
      }
    >
      {monthBuckets.unscheduled.length > 0 && (
        <div className={currentView === "multi" ? "break-inside-avoid inline-block w-full mb-4" : ""}>
          {monthRow("Unscheduled", -1, monthBuckets.unscheduled)}
        </div>
      )}
      {MONTHS.map((monthName, monthIndex) => (
        <div
          key={monthName}
          className={currentView === "multi" ? "break-inside-avoid inline-block w-full mb-4" : ""}
        >
          {monthRow(monthName, monthIndex, monthBuckets.byIndex.get(monthIndex)!)}
        </div>
      ))}
    </div>
  );

  const priorityList =
    priorityGroups && getPriorityColor && renderPriorityBadge ? (
      <GenericPriorityList
        priorities={priorities!}
        getItems={(priority) => priorityGroups[priority] ?? []}
        getColors={getPriorityColor}
        renderBadge={renderPriorityBadge}
        columns={priorityViewColumns}
        getItemKey={getItemKey}
        previewCount={5}
        viewAllHref={viewAllBaseHref ? `${viewAllBaseHref}?view=priority` : undefined}
        onRowClick={onRowClick}
        rowClassName={rowClassName}
        rowAction={rowAction}
      />
    ) : null;

  // Flat list (all view) — newest first, unscheduled last.
  const flatItems = useMemo(
    () =>
      [...itemsForYear].sort((a, b) => {
        const aDate = getDateKey(a);
        const bDate = getDateKey(b);
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return parseDateKey(bDate).getTime() - parseDateKey(aDate).getTime();
      }),
    [itemsForYear, getDateKey],
  );

  const flatGrid = (
    <GenericDataGrid
      items={flatItems}
      columns={columns}
      getItemKey={getItemKey}
      emptyMessage={emptyMessage ?? "No items."}
      onRowClick={onRowClick}
      rowClassName={rowClassName}
      rowAction={rowAction}
    />
  );

  // ── Dashboard box (shared by both layouts) ──

  const dashboardBox = (
    <BoxContainer>
      {/* Double-header flex wrapping: on narrow screens the year dropdown
          wraps neatly beneath the left-aligned ViewToggle. */}
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {viewOptions.length > 1 && (
            <ViewToggle
              value={currentView}
              onChange={(next) => setStoredView(next)}
              options={viewOptions}
              ariaLabel={`${title} view toggle`}
              hideContainerOnMobile={false}
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="md" onClick={onAdd} disabled={isLoading}>
            + Add
          </Button>
          <YearDropdown
            years={availableYears}
            selectedYear={selectedYear}
            onChange={setSelectedYear}
          />
        </div>
      </header>

      <div
        className={`${SCROLLABLE_CLASSES} space-y-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800`}
        aria-label={`${domain} dashboard`}
      >
        {isLoading && (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</div>
        )}
        {!isLoading && data.length === 0 && currentView !== "all" && (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            {emptyMessage ?? "None"}
          </div>
        )}
        {!isLoading && currentView === "priority" && priorityList}
        {!isLoading && isMonthView && monthRows}
        {!isLoading && currentView === "all" && flatGrid}
      </div>
    </BoxContainer>
  );

  // ── Dual-column layout (Task Manager, Education) ──
  // DOM order [ActiveBox] → [StoreLink + Completed + Misc] so the sidebars
  // natively stack below the main content on mobile (no lg: prefix).

  if (completedSlot) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col items-start gap-4">
          <BackButton href={backHref} />
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {title}
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {description}
            </p>
            {!isLoading && headerStat && headerStat({ selectedYear, itemsForYear })}
          </div>
        </div>

        {/* Body: dashboard (2/3) + store/completed/misc sidebar (1/3) */}
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">{dashboardBox}</div>

          <div className="grid gap-4 lg:grid-rows-[auto_auto_1fr] min-w-0">
            {storeHref && (
              <StoreLink href={storeHref} label={storeLabel} icon={storeIcon} />
            )}

            {completedSlot}

            {miscSlot}
          </div>
        </section>

        {/* Error */}
        {error && <ErrorBanner message={error} onRetry={onRetry} />}

        {/* Modal */}
        {modalSlot}
      </div>
    );
  }

  // ── Full-width layout (Expense, Medical) ──

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col items-start gap-4 w-full">
        <BackButton href={backHref} />
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between w-full">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {title}
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {description}
            </p>
            {!isLoading && headerStat && headerStat({ selectedYear, itemsForYear })}
          </div>

          {/* Store link (top-right on desktop, full-width block on mobile) */}
          {!isLoading && storeHref && (
            <div className="w-full md:w-auto md:min-w-[200px] lg:w-1/3">
              <StoreLink href={storeHref} label={storeLabel} icon={storeIcon} />
            </div>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && <LoadingSpinner />}

      {/* Error */}
      {error && <ErrorBanner message={error} onRetry={onRetry} />}

      {/* Body */}
      {!isLoading && dashboardBox}

      {/* Modal */}
      {modalSlot}
    </div>
  );
}
