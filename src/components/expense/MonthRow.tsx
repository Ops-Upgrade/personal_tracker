"use client";

import { useRouter } from "next/navigation";
import type { Expense } from "@/types/expense";
import { ROUTES } from "@/routes/paths";
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
 * Uses the reusable MonthTile component for consistent styling.
 *
 * Shows a preview of the latest 5 items inline. A "View All" button
 * navigates to the dedicated /expense/all page pre-filtered to this
 * month and year.
 */
export default function MonthRow({
  monthName,
  monthIndex,
  year,
  expenses,
  isCurrentMonth,
  onSelectExpense,
}: MonthRowProps) {
  const router = useRouter();
  const total = expenses.reduce((sum, e) => sum + e.cost, 0);
  const count = expenses.length;

  const sorted = [...expenses].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const preview = sorted.slice(0, 5);

  return (
    <MonthTile
      id={isCurrentMonth ? "current-month-tile" : undefined}
      title={monthName}
      subtitle={
        <>
          Total Expense: ₹ {total.toLocaleString("en-IN")} · {count} item{count !== 1 ? "s" : ""}
        </>
      }
      accent={total > 0}
      defaultExpanded={isCurrentMonth}
      highlight={isCurrentMonth}
      footerActions={
        expenses.length > 5 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              router.push(`${ROUTES.EXPENSE_ALL}?year=${year}&month=${monthIndex}`)
            }
          >
            View All {monthName} ({expenses.length})
          </Button>
        ) : undefined
      }
    >
      {preview.length > 0 && (
        <ExpenseTable expenses={preview} onSelectExpense={onSelectExpense} disableSorting />
      )}
    </MonthTile>
  );
}
