"use client";

import { type ReactNode } from "react";
import { useRouter } from "next/navigation";
import MonthTile from "./MonthTile";
import Button from "./Button";
import type { ColumnDef } from "./GenericViewPage";
import GenericDataGrid from "./GenericDataGrid";

export interface GenericMonthRowProps<T> {
  /** Display name for the month (e.g. "January", "August 2026"). */
  monthName: string;
  /** 0-based month index (0 = January). */
  monthIndex: number;
  /** The year this month belongs to. */
  year: number;
  /** All items in this month group. */
  items: T[];
  /** Whether this tile represents the current month (auto-expands + highlight). */
  isCurrentMonth?: boolean;
  /** Returns a subtitle ReactNode from the full item array (e.g. "₹ 3,200 · 4 items"). */
  getSubtitle: (items: T[]) => ReactNode;
  /** Extract a sortable date string (ISO YYYY-MM-DD) from an item for sorting. */
  getDate: (item: T) => string | null;
  /** Route to navigate to when "View All" is clicked. */
  viewAllHref: string;
  /** Optional custom label for the "View All" button. Auto-generated if omitted. */
  viewAllLabel?: string;
  /** Column definitions for rendering item preview rows. */
  columns: ColumnDef<T>[];
  /** Stable unique key for each item. */
  getItemKey: (item: T) => string;
  /** Maximum number of preview items to show. Defaults to showing all items. */
  previewCount?: number;
  /** Called when a row is clicked (opens the domain modal). */
  onRowClick?: (item: T) => void;
  /** Optional per-row action button (e.g. "Complete" for tasks/education). */
  rowAction?: (item: T) => ReactNode;
  /** Optional CSS class modifier per item (e.g. priority-colored left border). */
  getItemClassName?: (item: T) => string;
}

/**
 * Generic month tile wrapper used across all 4 domains (Expense, Medical,
 * Task Manager, Education). Shows a preview of items (sorted by date
 * descending, capped at `previewCount`) inside a MonthTile, rendered via
 * GenericDataGrid. The "View All" button is shown only when `previewCount`
 * is provided (i.e. in active-box preview mode).
 */
export default function GenericMonthRow<T>({
  monthName,
  items,
  isCurrentMonth,
  getSubtitle,
  getDate,
  viewAllHref,
  viewAllLabel,
  columns,
  getItemKey,
  previewCount,
  onRowClick,
  rowAction,
  getItemClassName,
}: GenericMonthRowProps<T>) {
  const router = useRouter();

  // Sort items by date descending
  const sorted = [...items].sort((a, b) => {
    const aDate = getDate(a);
    const bDate = getDate(b);
    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;
    return new Date(bDate + "T00:00:00").getTime() - new Date(aDate + "T00:00:00").getTime();
  });

  const preview = previewCount ? sorted.slice(0, previewCount) : sorted;
  const defaultLabel = `View All ${monthName} (${items.length})`;

  return (
    <MonthTile
      id={isCurrentMonth ? "current-month-tile" : undefined}
      title={monthName}
      subtitle={getSubtitle(items)}
      accent={items.length > 0}
      defaultExpanded={isCurrentMonth}
      highlight={isCurrentMonth}
      footerActions={
        previewCount ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(viewAllHref)}
          >
            {viewAllLabel ?? defaultLabel}
          </Button>
        ) : undefined
      }
    >
      {preview.length > 0 && (
        <GenericDataGrid
          items={preview}
          columns={columns}
          getItemKey={getItemKey}
          onRowClick={onRowClick}
          rowAction={rowAction}
          getItemClassName={getItemClassName}
          hideHeaderOnMobile
        />
      )}
    </MonthTile>
  );
}
