"use client";

import { useState } from "react";
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
  onSelectExpense: (expense: Expense) => void;
}

/**
 * A single month row in the expense tracker.
 * Uses the reusable MonthTile component for consistent styling
 * with the Task Manager month sections.
 *
 * Clicking the tile header expands/collapses the inline preview.
 * When expanded, shows a preview table (up to 5 items) with a
 * "View All" toggle to expand the full list inline.
 */
export default function MonthRow({
  monthName,
  expenses,
  isCurrentMonth,
  onSelectExpense,
}: MonthRowProps) {
  const total = expenses.reduce((sum, e) => sum + e.cost, 0);
  const [showAll, setShowAll] = useState(false);

  const sorted = [...expenses].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const preview = showAll ? sorted : sorted.slice(0, 5);

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
      footerActions={
        sorted.length > 5 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll((prev) => !prev)}
          >
            {showAll ? "View Less" : `View All (${sorted.length})`}
          </Button>
        ) : undefined
      }
    >
      <ExpenseTable expenses={preview} onSelectExpense={onSelectExpense} disableSorting />
    </MonthTile>
  );
}