"use client";

interface YearDropdownProps {
  years: number[];
  selectedYear: number;
  onChange: (year: number) => void;
}

/**
 * Year selector dropdown for the expense tracker.
 * Lists all years present in decrypted data + current year, sorted descending.
 */
export default function YearDropdown({
  years,
  selectedYear,
  onChange,
}: YearDropdownProps) {
  return (
    <select
      value={selectedYear}
      onChange={(e) => onChange(Number(e.target.value))}
      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
    >
      {years.map((year) => (
        <option key={year} value={year}>
          {year}
        </option>
      ))}
    </select>
  );
}
