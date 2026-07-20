"use client";

import type { Expense } from "@/types/expense";
import Button from "@/components/common/Button";
import ExpenseTable from "./ExpenseTable";
import MonthTile from "@/components/common/MonthTile";

interface MonthRowProps {
  monthName: string;
  monthIndex: number; // 0-based
  year: number;
  expenses: Expense[];
  isCurrentMonth?: boolean;
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
  isCurrentMonth,
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
      id={isCurrentMonth ? "current-month-tile" : undefined}
      title={monthName}
      subtitle={
        <>
          Total Expense: ₹ {total.toLocaleString("en-IN")}
        </>
      }
      accent={total > 0}
      defaultExpanded={isCurrentMonth}
      highlight={isCurrentMonth}
      headerActions={
        <Button
          variant="secondary"
          size="md"
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
        >
          + Add
        </Button>
      }
      footerActions={
        expenses.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewAll}
          >
            View All
          </Button>
        ) : undefined
      }
    >
      <ExpenseTable expenses={preview} onSelectExpense={onSelectExpense} disableSorting />
    </MonthTile>
  );
}