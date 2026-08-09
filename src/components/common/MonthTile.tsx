"use client";

import type { ReactNode } from "react";
import { useState } from "react";

export interface MonthTileProps {
  /** Month title (e.g. "January", "May 2025") */
  title: string;
  /** Optional subtitle shown after the title (e.g. "Total Expense: ₹ 20,000") */
  subtitle?: ReactNode;
  /** Content rendered inside the tile body */
  children?: ReactNode;
  /** Actions rendered in the header row (e.g. "+ Add" button) */
  headerActions?: ReactNode;
  /** Actions rendered at the bottom of the tile body (e.g. ">> View All") */
  footerActions?: ReactNode;
  /** Whether the tile starts in the expanded state. Defaults to `false`. */
  defaultExpanded?: boolean;
  /**
   * Controlled expanded state.
   * If provided, the component becomes controlled and `defaultExpanded` is ignored.
   */
  expanded?: boolean;
  /** Called when the expand/collapse state changes (controlled + uncontrolled). */
  onExpandToggle?: (expanded: boolean) => void;
  /** When `true`, shows a coloured left border accent (blue by default). */
  accent?: boolean;
  /** CSS class for the accent border colour. Defaults to blue. */
  accentClassName?: string;
  /**
   * When `true`, the tile is always expanded and the header is not clickable.
   * Useful for sections that list items without a collapse toggle.
   */
  alwaysExpanded?: boolean;
  /** Additional CSS class for the outer card */
  className?: string;
  /** Whether to highlight this tile (e.g., current month) */
  highlight?: boolean;
  /** Optional DOM id for the root element (e.g., for scroll-into-view) */
  id?: string;
}

/**
 * Reusable month/section tile used by both Expense Tracker and Task Manager.
 *
 * - Expense: collapsible card with month name, total, "+ Add", inline preview, ">> View All"
 * - Task Manager: always-expanded section within a scrollable container, showing grouped items
 */
export default function MonthTile({
  title,
  subtitle,
  children,
  headerActions,
  footerActions,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onExpandToggle,
  accent = false,
  accentClassName = "border-l-blue-500 dark:border-l-blue-500",
  alwaysExpanded = false,
  className = "",
  highlight = false,
  id,
}: MonthTileProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isControlled = controlledExpanded !== undefined;
  const isExpanded = alwaysExpanded
    ? true
    : isControlled
      ? controlledExpanded
      : internalExpanded;

  function handleHeaderClick() {
    if (alwaysExpanded) return;
    const next = !isExpanded;
    if (!isControlled) {
      setInternalExpanded(next);
    }
    onExpandToggle?.(next);
  }

  const interactiveProps =
    alwaysExpanded
      ? {}
      : {
          role: "button" as const,
          tabIndex: 0,
          onClick: handleHeaderClick,
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleHeaderClick();
            }
          },
          "aria-expanded": isExpanded,
        };

  return (
    <div
      id={id}
      className={`rounded-xl border shadow-sm ${
        highlight
          ? "border-yellow-300 bg-yellow-100 dark:border-yellow-500/20 dark:bg-yellow-500/10"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40"
      } ${
        alwaysExpanded
          ? ""
          : "border-l-[4px] " +
            (accent ? accentClassName : "border-l-transparent")
      } ${className}`}
    >
      {/* Header */}
      <div
        {...interactiveProps}
        className={`flex items-center justify-between px-5 py-4 ${
          alwaysExpanded
            ? ""
            : "cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
        }`}
      >
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {title}
          </h3>
          {subtitle && (
            <span className="text-base font-semibold text-zinc-600 dark:text-zinc-300">
              {subtitle}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {headerActions}
        </div>
      </div>

      {/* Body */}
      {isExpanded && children && (
        <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
          {children}
          {footerActions && (
            <div className="mt-2 flex justify-end">{footerActions}</div>
          )}
        </div>
      )}
    </div>
  );
}