"use client";

import { MONTH_NAMES } from "@/lib/constants";

interface MonthDropdownProps {
  /** Kept for backward compatibility — the dropdown now renders all 12 months
   *  from MONTH_NAMES regardless of this prop. */
  months?: number[];
  selectedMonth: number | "all";
  onChange: (month: number | "all") => void;
}

/**
 * Month selector dropdown.
 * Always renders all 12 months (using MONTH_NAMES) so empty months
 * are still selectable. The `months` prop is retained for callers that
 * compute availability separately but no longer controls the rendered
 * options.
 * Used by expense and medical "View All" pages.
 */
export default function MonthDropdown({
  selectedMonth,
  onChange,
}: MonthDropdownProps) {
  return (
    <select
      value={selectedMonth}
      onChange={(e) => {
        const val = e.target.value;
        onChange(val === "all" ? "all" : Number(val));
      }}
      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
    >
      <option value="all">All Months</option>
      {MONTH_NAMES.map((name, idx) => (
        <option key={idx} value={idx}>
          {name}
        </option>
      ))}
    </select>
  );
}
