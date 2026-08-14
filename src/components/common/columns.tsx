import type { ColumnDef } from "./GenericViewPage";
import type { Priority } from "@/types/common";
import PriorityBadge from "./PriorityBadge";
import { PaperClipIcon } from "./Icons";
import { formatShortDate } from "@/lib/format";
import { stripHtml } from "@/lib/viewHelpers";

// ── Shared column factories ─────────────────────────────────────────────
//
// One definition per column *concept*. Domain configs compose these into
// their exported column arrays; widgets and pages assemble per-view arrays
// from the same atoms. Sizing / alignment / render semantics live here,
// not at each call site — so "center the priority badge" is one edit.
//
// Every factory result is spreadable: pass an `overrides` partial to tweak
// sortColumn, align, weight, or replace the render entirely. Keep the
// factory count small — a column that needs more than a couple of options
// should stay an inline definition at its call site.

/**
 * Priority column — badge in a fixed, centered track (the lone mobile dot
 * sits mid-track when the label hides below md).
 */
export function colPriority<T extends { priority: Priority }, C extends string = string>(
  overrides: Partial<ColumnDef<T, C>> = {},
): ColumnDef<T, C> {
  return {
    key: "priority",
    header: "Priority",
    sizing: "fixed",
    // Centered so the lone mobile dot (label hidden) sits mid-track.
    align: "center",
    render: (item) => <PriorityBadge priority={item.priority} />,
    ...overrides,
  };
}

/**
 * Files column — paperclip icon + "(n)" count in a fixed track. Only the
 * icon color and the count source are domain-specific.
 */
export function colFiles<T, C extends string = string>(
  options: {
    /** How many attached documents an item has. */
    getCount: (item: T) => number;
    /** Tailwind text color for the paperclip icon. */
    iconColorClass: string;
    /** Tailwind text color for the "(n)" count label. */
    countClass?: string;
  },
  overrides: Partial<ColumnDef<T, C>> = {},
): ColumnDef<T, C> {
  const { getCount, iconColorClass, countClass = "text-zinc-600 dark:text-zinc-300" } =
    options;
  return {
    key: "files",
    header: "Files",
    sizing: "fixed",
    render: (item) => {
      const count = getCount(item);
      return count > 0 ? (
        <span
          className={`inline-flex items-center justify-center gap-1 ${iconColorClass}`}
          title={`${count} document(s) attached`}
        >
          <PaperClipIcon className="h-4 w-4" />
          <span className={countClass}>({count})</span>
        </span>
      ) : (
        <span className="text-zinc-400">—</span>
      );
    },
    ...overrides,
  };
}

/**
 * Richtext column — Tiptap HTML stripped to plain text, ellipsized by CSS.
 * Use for description / reason / diagnosis / note content.
 */
export function colRichtext<T, C extends string = string>(
  options: {
    key: string;
    header: string;
    /** Returns the raw Tiptap HTML for an item. */
    accessor: (item: T) => string | null | undefined;
    weight?: number;
    /** Tailwind classes for the text span. */
    className?: string;
  },
  overrides: Partial<ColumnDef<T, C>> = {},
): ColumnDef<T, C> {
  const {
    key,
    header,
    accessor,
    weight,
    className = "text-zinc-500 dark:text-zinc-400",
  } = options;
  return {
    key,
    header,
    sizing: "flex",
    weight,
    render: (item) => (
      <span className={className}>
        {stripHtml(accessor(item) || "") || "—"}
      </span>
    ),
    ...overrides,
  };
}

/**
 * Date column — short M/D/YY format via the shared formatter. Handles both
 * ISO timestamps (completed_at, created_at) and date-only strings (due_date).
 */
export function colDate<T, C extends string = string>(
  options: {
    key: string;
    header: string;
    /** Returns the raw date string (ISO timestamp or YYYY-MM-DD). */
    accessor: (item: T) => string | null | undefined;
    /** Tailwind classes for the text span. */
    className?: string;
  },
  overrides: Partial<ColumnDef<T, C>> = {},
): ColumnDef<T, C> {
  const { key, header, accessor, className = "text-zinc-600 dark:text-zinc-300" } =
    options;
  return {
    key,
    header,
    sizing: "fixed",
    render: (item) => (
      <span className={className}>{formatShortDate(accessor(item) ?? null)}</span>
    ),
    ...overrides,
  };
}
