"use client";

import { type ReactNode, useEffect } from "react";
import type { ViewToggleOption } from "@/components/common/ViewToggle";
import ViewToggle from "@/components/common/ViewToggle";
import Button from "@/components/common/Button";
import BoxContainer, { SCROLLABLE_CLASSES } from "@/components/common/BoxContainer";
import { activeByMonths, byPriority } from "@/lib/viewHelpers";
import type { ColumnDef } from "./GenericViewPage";
import GenericPriorityList from "./GenericPriorityList";
import GenericMonthsList from "./GenericMonthsList";

/**
 * Minimum shape for an active item — must have id, priority, and optional due_date.
 */
export interface ActiveItem {
  id: string;
  priority: string;
  due_date: string | null;
}

interface GenericActiveBoxProps<T extends ActiveItem> {
  items: T[];
  isLoading: boolean;
  view: string;
  nowYear: number;
  nowMonth: number;
  onViewChange: (next: string) => void;
  onAdd: () => void;
  title: string;
  viewOptions: readonly ViewToggleOption<string>[];
  priorities: readonly string[];
  getPriorityColor: (priority: string) => { border: string; bg: string };
  renderPriorityBadge: (priority: string) => ReactNode;
  /** Optional className override for the outer BoxContainer (defaults to "lg:col-span-2") */
  className?: string;
  /** Subtitle rendered in each GenericMonthRow (used in months view only). */
  getSubtitle?: (items: T[]) => ReactNode;
  /** Base href for "View All" navigation (e.g. "/taskmanager/all"). Appended with ?year=X&month=Y. */
  viewAllBaseHref?: string;
  /** Column definitions for rendering items as bordered grid boxes. */
  columns: ColumnDef<T>[];
  /** Stable unique key for each item. Defaults to `item.id`. */
  getItemKey?: (item: T) => string;
  /** Called when a row is clicked (opens the domain modal). */
  onRowClick?: (item: T) => void;
  /** Optional per-row action button (e.g. "Complete" for tasks/education). */
  rowAction?: (item: T) => ReactNode;
  /** Optional CSS class modifier per item (e.g. priority-colored left border). */
  getItemClassName?: (item: T) => string;
}

export default function GenericActiveBox<T extends ActiveItem>({
  items,
  isLoading,
  view,
  nowYear,
  nowMonth,
  onViewChange,
  onAdd,
  title,
  viewOptions,
  priorities,
  getPriorityColor,
  renderPriorityBadge,
  className,
  getSubtitle,
  viewAllBaseHref,
  columns,
  getItemKey = (item) => (item as ActiveItem).id,
  onRowClick,
  rowAction,
  getItemClassName,
}: GenericActiveBoxProps<T>) {
  const priorityGroups = byPriority(items, [...priorities]);
  const monthGroups = activeByMonths(items, nowYear);

  // Auto-scroll to the current month tile when switching to months view
  useEffect(() => {
    if (view !== "months" || isLoading) return;
    const timeout = setTimeout(() => {
      document
        .getElementById("current-month-tile")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => clearTimeout(timeout);
  }, [view, isLoading]);

  return (
    <BoxContainer className={className ?? "lg:col-span-2"}>
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </h2>
          <ViewToggle
            value={view}
            onChange={onViewChange}
            options={viewOptions}
            ariaLabel={`${title} view toggle`}
          />
        </div>
        <Button
          variant="secondary"
          size="md"
          onClick={onAdd}
          disabled={isLoading}
        >
          + Add
        </Button>
      </header>

      <div className={`${SCROLLABLE_CLASSES} space-y-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800`}>
        {isLoading && (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</div>
        )}
        {!isLoading && items.length === 0 && (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">None</div>
        )}

        {!isLoading && view === "priority" && (
          <GenericPriorityList
            priorities={priorities}
            getItems={(p) => priorityGroups[p] ?? []}
            getColors={getPriorityColor}
            renderBadge={renderPriorityBadge}
            columns={columns}
            getItemKey={getItemKey}
            previewCount={5}
            viewAllHref={viewAllBaseHref ? `${viewAllBaseHref}?view=priority` : undefined}
            onRowClick={onRowClick}
            rowAction={rowAction}
            getItemClassName={getItemClassName}
            hideHeaderOnMobile
          />
        )}

        {!isLoading && view === "months" && (
          <GenericMonthsList
            monthGroups={monthGroups}
            columns={columns}
            getItemKey={getItemKey}
            nowYear={nowYear}
            nowMonth={nowMonth}
            previewCount={5}
            viewAllBaseHref={viewAllBaseHref}
            getSubtitle={getSubtitle}
            getDate={(item) => (item as ActiveItem).due_date}
            onRowClick={onRowClick}
            rowAction={rowAction}
            getItemClassName={getItemClassName}
            hideHeaderOnMobile
          />
        )}
      </div>
    </BoxContainer>
  );
}
