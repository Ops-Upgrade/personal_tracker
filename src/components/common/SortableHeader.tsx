"use client";

import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

// ---------- types ----------

export type SortDirection = "asc" | "desc";

export interface SortState<Column extends string = string> {
  column: Column;
  direction: SortDirection;
}

interface SortableHeaderProps<Column extends string = string> {
  column: Column;
  label: string;
  sortState: SortState<Column> | null;
  onSort: (next: SortState<Column>) => void;
  /** Element to render as — default "button" for standalone use, "div" for grid rows, "th" for tables */
  as?: "button" | "div" | "th";
  /** Optional additional class names (e.g. grid column spans) */
  className?: string;
}

// ---------- component ----------

export default function SortableHeader<Column extends string = string>({
  column,
  label,
  sortState,
  onSort,
  as: Component = "button",
  className: extraClassName,
}: SortableHeaderProps<Column>) {
  const isActive = sortState?.column === column;
  const nextDirection: SortDirection =
    isActive && sortState?.direction === "asc" ? "desc" : "asc";

  const handleClick = () => {
    onSort({ column, direction: nextDirection });
  };

  const icon =
    isActive ? (
      sortState!.direction === "asc" ? (
        <ArrowUp className="inline-block h-3 w-3 ml-0.5" />
      ) : (
        <ArrowDown className="inline-block h-3 w-3 ml-0.5" />
      )
    ) : (
      <ArrowUpDown className="inline-block h-3 w-3 ml-0.5 opacity-40" />
    );

  const sharedTextClasses =
    "text-xs font-semibold text-zinc-500 uppercase tracking-wider hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors cursor-pointer";

  // ── <th> branch: preserve native table-cell display ──
  if (Component === "th") {
    const thClassName = [sharedTextClasses, extraClassName]
      .filter(Boolean)
      .join(" ");

    return (
      <th onClick={handleClick} className={thClassName}>
        <span className="inline-flex items-center gap-0.5">
          {label}
          {icon}
        </span>
      </th>
    );
  }

  // ── <button> / <div> branch: apply flex layout directly ──
  const className = [
    `flex items-center min-w-0 gap-0.5 ${sharedTextClasses}`,
    extraClassName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Component onClick={handleClick} className={className} title={label}>
      <span className="truncate">{label}</span>
      {icon}
    </Component>
  );
}
