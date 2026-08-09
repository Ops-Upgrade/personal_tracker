"use client";

import { type ReactNode } from "react";
import type { ColumnDef, MonthGroup } from "./GenericViewPage";
import GenericDataGrid from "./GenericDataGrid";
import GenericMonthRow from "./GenericMonthRow";
import MonthTile from "./MonthTile";
import { MONTH_NAMES } from "@/lib/constants";

export interface GenericMonthsListProps<T> {
  /** Month groups to render (ordered). */
  monthGroups: MonthGroup<T>[];
  /** Column definitions for rendering items. */
  columns: ColumnDef<T>[];
  /** Stable unique key for each item. */
  getItemKey: (item: T) => string;

  /** Current year (used to highlight the current-month tile). */
  nowYear: number;
  /** Current 0-indexed month (used to highlight the current-month tile). */
  nowMonth: number;
  /** The year selected in the year filter (for full-view isCurrentMonth check). */
  selectedYear?: number;

  // ── Preview mode (active box / GenericActiveBox usage) ──
  /** When set, renders GenericMonthRow previews capped at this count. */
  previewCount?: number;
  /** Base href for "View All" navigation in preview mode. */
  viewAllBaseHref?: string;
  /** Subtitle rendered in each GenericMonthRow (preview mode only). */
  getSubtitle?: (items: T[]) => ReactNode;
  /** Extract a sortable date string for preview sorting. */
  getDate?: (item: T) => string | null;

  // ── Row interaction ──
  /** When set, the entire row becomes clickable. */
  onRowClick?: (item: T) => void;
  /** Additional CSS class per row. */
  rowClassName?: string | ((item: T) => string);
  /** Per-row action button (e.g. "Complete"). */
  rowAction?: (item: T) => ReactNode;
  /** Per-row CSS class modifier (e.g. priority-colored left border). */
  getItemClassName?: (item: T) => string;
  /** When true, hides column headers on mobile screens (full mode only). */
  hideHeaderOnMobile?: boolean;
}

/**
 * Renders items grouped by month, using GenericMonthRow when previewCount
 * is set (preview mode) or MonthTile + GenericDataGrid when not (full mode).
 * Used by both GenericActiveBox and GenericViewPage.
 */
export default function GenericMonthsList<T>({
  monthGroups,
  columns,
  getItemKey,
  nowYear,
  nowMonth,
  selectedYear,
  previewCount,
  viewAllBaseHref,
  getSubtitle,
  getDate,
  onRowClick,
  rowClassName,
  rowAction,
  getItemClassName,
}: GenericMonthsListProps<T>) {
  const isPreviewMode = !!previewCount;

  return (
    <>
      {monthGroups.map((group, index) => {
        // ── Preview mode: GenericMonthRow ──
        if (isPreviewMode && getSubtitle && viewAllBaseHref && getDate) {
          const monthIndex = (MONTH_NAMES as readonly string[]).indexOf(
            group.label,
          );
          const isStandardMonth = monthIndex !== -1;
          const isCurrentMonth =
            MONTH_NAMES[nowMonth] === group.label;

          // Use GenericMonthRow when it's a standard month
          if (isStandardMonth) {
            return (
              <GenericMonthRow
                key={group.label}
                monthName={group.label}
                monthIndex={monthIndex}
                year={nowYear}
                items={group.items}
                isCurrentMonth={isCurrentMonth}
                getSubtitle={getSubtitle}
                getDate={getDate}
                viewAllHref={`${viewAllBaseHref}?year=${nowYear}&month=${monthIndex}`}
                columns={columns}
                getItemKey={getItemKey}
                previewCount={previewCount}
                onRowClick={onRowClick}
                rowAction={rowAction}
                getItemClassName={getItemClassName}
              />
            );
          }

          // Fallback: plain MonthTile for non-standard months (e.g. "Past Years")
          return (
            <MonthTile
              key={group.label}
              title={group.label}
              defaultExpanded={false}
              accent={group.items.length > 0}
              className="text-sm"
            >
              {group.items.length === 0 ? (
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                  None
                </div>
              ) : (
                <GenericDataGrid
                  items={group.items.slice(0, previewCount)}
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

        // ── Full mode: MonthTile + GenericDataGrid ──
        const isCurrentMonth =
          nowYear !== undefined &&
          nowMonth !== undefined &&
          selectedYear === nowYear &&
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
            <GenericDataGrid
              items={group.items}
              columns={columns}
              getItemKey={getItemKey}
              emptyMessage={`No items in ${group.label}.`}
              onRowClick={onRowClick}
              rowClassName={rowClassName}
            />
          </MonthTile>
        );
      })}
    </>
  );
}
