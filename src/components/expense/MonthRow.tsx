"use client";

import { useState } from "react";
import type { Expense } from "@/types/expense";
import ExpenseTable from "./ExpenseTable";

interface MonthRowProps {
  monthName: string;
  monthIndex: number; // 0-based
  year: number;
  expenses: Expense[];
  onAdd: () => void;
  onSelectExpense: (expense: Expense) => void;
  onViewAll: () => void;
}

/**
 * A single month row in the expense tracker.
 * Shows month name, total, expand/retract toggle, and + Add button.
 * When expanded, shows an inline preview table (up to 5 items).
 */
export default function MonthRow({
  monthName,
  expenses,
  onAdd,
  onSelectExpense,
  onViewAll,
}: MonthRowProps) {
  const [expanded, setExpanded] = useState(false);

  const total = expenses.reduce((sum, e) => sum + e.cost, 0);

  // Preview: 5 most recent items sorted by date descending
  const sorted = [...expenses].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const preview = sorted.slice(0, 5);
  const hasMore = sorted.length > 5;

  return (
    <div
      className={`rounded-xl border border-zinc-200 bg-white shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:bg-zinc-800/60 ${
        total > 0
          ? "border-l-[4px] border-l-blue-500 dark:border-l-blue-500"
          : "border-l-[4px] border-l-transparent"
      }`}
    >
      {/* Month header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            {monthName}
          </h3>
          <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Total expense: ₹ {total.toLocaleString("en-IN")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {expanded ? "^ Retract" : "v Expand"}
          </button>
          <button
            type="button"
            onClick={onAdd}
            className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Expanded inline preview */}
      {expanded && (
        <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <ExpenseTable expenses={preview} onSelectExpense={onSelectExpense} />
          {hasMore && (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={onViewAll}
                className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                {">> View All"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
