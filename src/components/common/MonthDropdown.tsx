"use client";

import { MONTH_NAMES } from "@/lib/constants";

interface MonthDropdownProps {
  months: number[];
  selectedMonth: number | "all";
  onChange: (month: number | "all") => void;
}

/**
 * Month selector dropdown.
 * Lists available months + an "All Months" option.
 * Used by expense and medical "View All" pages.
 */
export default function MonthDropdown({
  months,
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
      {months.map((m) => (
        <option key={m} value={m}>
          {MONTH_NAMES[m]}
        </option>
      ))}
    </select>
  );
}
