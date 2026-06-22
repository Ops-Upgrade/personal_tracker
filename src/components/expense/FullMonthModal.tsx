"use client";

import type { Expense } from "@/types/expense";
import ModalFrame from "@/components/taskmanager/ModalFrame";
import ExpenseTable from "./ExpenseTable";

interface FullMonthModalProps {
  monthName: string;
  year: number;
  expenses: Expense[];
  onClose: () => void;
  onSelectExpense: (expense: Expense) => void;
}

/**
 * Full month modal — shows all items for a given month/year.
 * Opened via >> View All or by direct URL navigation to /expense#month-year.
 * F2.7.
 */
export default function FullMonthModal({
  monthName,
  year,
  expenses,
  onClose,
  onSelectExpense,
}: FullMonthModalProps) {
  // Sort by date descending
  const sorted = [...expenses].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const total = expenses.reduce((sum, e) => sum + e.cost, 0);

  return (
    <ModalFrame
      title={`${monthName} ${year} — All Items`}
      onClose={onClose}
      maxWidthClassName="max-w-4xl"
    >
      <div className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
        Total: ₹ {total.toLocaleString("en-IN")}
      </div>
      <div className="max-h-[60vh] overflow-y-auto">
        <ExpenseTable expenses={sorted} onSelectExpense={onSelectExpense} />
      </div>
    </ModalFrame>
  );
}
