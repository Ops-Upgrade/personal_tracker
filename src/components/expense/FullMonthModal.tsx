"use client";

import { useEffect } from "react";
import type { Expense } from "@/types/expense";
import ExpenseTable from "./ExpenseTable";

interface FullMonthModalProps {
  monthName: string;
  year: number;
  expenses: Expense[];
  onClose: () => void;
  onSelectExpense: (expense: Expense) => void;
}

/**
 * Full-screen modal showing all expense items for a given month/year.
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

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950/80 backdrop-blur-sm">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      {/* Full-screen panel */}
      <div className="relative z-10 flex h-full w-full flex-col">
        {/* Sticky Header */}
        <header className="flex shrink-0 items-center justify-between border-b border-zinc-200/10 bg-white/95 px-6 py-4 shadow-sm backdrop-blur dark:bg-zinc-900/95">
          <div className="flex items-baseline gap-4">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {monthName} {year}
            </h2>
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {sorted.length} {sorted.length === 1 ? "item" : "items"}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Total: ₹ {total.toLocaleString("en-IN")}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              aria-label="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </header>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl px-6 py-6">
            <ExpenseTable
              expenses={sorted}
              onSelectExpense={onSelectExpense}
            />
          </div>
        </div>

        {/* Bottom bar */}
        <footer className="flex shrink-0 items-center justify-between border-t border-zinc-200/10 bg-white/95 px-6 py-3 backdrop-blur dark:bg-zinc-900/95">
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            Click any row to view or edit · Press Esc to close
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
