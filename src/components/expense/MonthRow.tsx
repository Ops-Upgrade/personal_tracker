"use client";

import type { Expense } from "@/types/expense";
import ExpenseTable from "./ExpenseTable";
import MonthTile from "@/components/common/MonthTile";

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
 * Uses the reusable MonthTile component for consistent styling
 * with the Task Manager month sections.
 *
 * Clicking the tile header expands/collapses the inline preview.
 * When expanded, shows a preview table (up to 5 items).
 */
export default function MonthRow({
  monthName,
  expenses,
  onAdd,
  onSelectExpense,
  onViewAll,
}: MonthRowProps) {
  const total = expenses.reduce((sum, e) => sum + e.cost, 0);

  // Preview: 5 most recent items sorted by date descending
  const sorted = [...expenses].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const preview = sorted.slice(0, 5);

  return (
    <MonthTile
      title={monthName}
      subtitle={
        <>
          Total Expense: ₹ {total.toLocaleString("en-IN")}
        </>
      }
      accent={total > 0}
      headerActions={
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          + Add
        </button>
      }
      footerActions={
        expenses.length > 0 ? (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {">> View All"}
          </button>
        ) : undefined
      }
    >
      <ExpenseTable expenses={preview} onSelectExpense={onSelectExpense} />
    </MonthTile>
  );
}