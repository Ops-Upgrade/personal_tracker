"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSession } from "@/api/auth";
import {
  createExpense,
  deleteExpense,
  fetchExpenses,
  updateExpense,
} from "@/api/expense";
import type { Expense } from "@/types/expense";
import { MONTHS } from "@/types/expense";
import ExpenseModal from "./ExpenseModal";
import FullMonthModal from "./FullMonthModal";
import MonthRow from "./MonthRow";
import YearDropdown from "./YearDropdown";

/**
 * Expense Tracker feature shell.
 * Orchestrates month list, year dropdown, hash-based full-month modal,
 * and create/edit expense modals.
 */
export default function ExpenseView() {
  const [userId, setUserId] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [fullMonthModal, setFullMonthModal] = useState<{
    monthIndex: number;
    year: number;
  } | null>(null);

  // ExpenseModal state: null = closed, "create" = new item, Expense = edit
  const [expenseModalTarget, setExpenseModalTarget] = useState<
    Expense | { mode: "create"; defaultDate: string } | null
  >(null);

  // --- Derived data ---

  // All distinct years from decrypted data + current year, sorted descending
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearsFromData = new Set(
      expenses.map((e) => new Date(e.date).getFullYear())
    );
    yearsFromData.add(currentYear);
    return Array.from(yearsFromData).sort((a, b) => b - a);
  }, [expenses]);

  // Expenses grouped by month for the selected year
  const expensesByMonth = useMemo(() => {
    return MONTHS.map((monthName, monthIndex) => {
      const filtered = expenses.filter((e) => {
        const d = new Date(e.date);
        return d.getFullYear() === selectedYear && d.getMonth() === monthIndex;
      });
      return { monthName, monthIndex, expenses: filtered };
    });
  }, [expenses, selectedYear]);

  // Total for the selected year
  const yearlyTotal = useMemo(() => {
    return expensesByMonth.reduce((acc, month) => {
      return acc + month.expenses.reduce((sum, e) => sum + e.cost, 0);
    }, 0);
  }, [expensesByMonth]);

  // --- Hash-based navigation ---

  const syncHashModal = useCallback(() => {
    const raw = window.location.hash.replace("#", "");
    if (!raw) {
      setFullMonthModal(null);
      return;
    }

    // Expected format: "january-2025"
    const parts = raw.split("-");
    if (parts.length < 2) {
      setFullMonthModal(null);
      return;
    }

    const yearStr = parts[parts.length - 1];
    const monthStr = parts.slice(0, -1).join("-"); // handle multi-word? unlikely but safe
    const year = parseInt(yearStr, 10);
    if (isNaN(year)) {
      setFullMonthModal(null);
      return;
    }

    const monthIndex = MONTHS.findIndex(
      (m) => m.toLowerCase() === monthStr.toLowerCase()
    );
    if (monthIndex === -1) {
      setFullMonthModal(null);
      return;
    }

    setSelectedYear(year);
    setFullMonthModal({ monthIndex, year });
  }, []);

  const closeFullMonthModal = useCallback(() => {
    if (window.location.hash) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`
      );
    }
    setFullMonthModal(null);
  }, []);

  const openFullMonthModal = useCallback(
    (monthIndex: number) => {
      const monthName = MONTHS[monthIndex].toLowerCase();
      window.location.hash = `${monthName}-${selectedYear}`;
    },
    [selectedYear]
  );

  // --- Data loading ---

  const loadData = useCallback(async (uid: string) => {
    const rows = await fetchExpenses(uid);
    setExpenses(rows);
  }, []);

  const refreshData = useCallback(
    async (uid: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await loadData(uid);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to refresh expense data."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [loadData]
  );

  // Bootstrap: get session, load data
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const session = await getSession();
        const uid = session?.user.id;
        if (!uid) throw new Error("No active session.");
        if (cancelled) return;
        setUserId(uid);
        await refreshData(uid);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load expense data."
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [refreshData]);

  // Listen for hash changes
  useEffect(() => {
    syncHashModal();
    window.addEventListener("hashchange", syncHashModal);
    return () => {
      window.removeEventListener("hashchange", syncHashModal);
    };
  }, [syncHashModal]);

  // --- CRUD handlers ---

  async function handleExpenseSave(
    draft: {
      item: string;
      seller: string;
      cost: number;
      date: string;
      reason: string;
      invoice: string;
    },
    existingExpense: Expense | null
  ) {
    if (!userId) throw new Error("No active session.");
    const nowIso = new Date().toISOString();

    const payload = {
      ...draft,
      updated_at: nowIso,
    };

    if (existingExpense) {
      await updateExpense(userId, existingExpense.id, payload);
    } else {
      await createExpense(userId, payload);
    }

    await refreshData(userId);
  }

  async function handleExpenseDelete(expenseId: string) {
    if (!userId) throw new Error("No active session.");
    await deleteExpense(expenseId);
    await refreshData(userId);
  }

  // --- Render ---

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Expenses
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Track and manage your spending.
          </p>
          {!isLoading && (
            <p className="mt-2 text-base font-medium text-zinc-700 dark:text-zinc-300">
              Total for {selectedYear}:{" "}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                ₹ {yearlyTotal.toLocaleString("en-IN")}
              </span>
            </p>
          )}
        </div>

        <YearDropdown
          years={availableYears}
          selectedYear={selectedYear}
          onChange={setSelectedYear}
        />
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => userId && refreshData(userId)}
            className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-900/40"
          >
            Retry
          </button>
        </div>
      )}

      {/* Month rows */}
      {!isLoading && (
        <div className="grid grid-cols-1 items-start gap-4">
          {expensesByMonth.map(({ monthName, monthIndex, expenses: monthExpenses }) => (
            <MonthRow
              key={monthName}
              monthName={monthName}
              monthIndex={monthIndex}
              year={selectedYear}
              expenses={monthExpenses}
              onAdd={() => {
                // Pre-fill date to 1st of this month for the selected year
                const mm = String(monthIndex + 1).padStart(2, "0");
                setExpenseModalTarget({
                  mode: "create",
                  defaultDate: `${selectedYear}-${mm}-01`,
                });
              }}
              onSelectExpense={(expense) => setExpenseModalTarget(expense)}
              onViewAll={() => openFullMonthModal(monthIndex)}
            />
          ))}
        </div>
      )}

      {/* Full Month Modal */}
      {fullMonthModal && (
        <FullMonthModal
          monthName={MONTHS[fullMonthModal.monthIndex]}
          year={fullMonthModal.year}
          expenses={expenses.filter((e) => {
            const d = new Date(e.date);
            return (
              d.getFullYear() === fullMonthModal.year &&
              d.getMonth() === fullMonthModal.monthIndex
            );
          })}
          onClose={closeFullMonthModal}
          onSelectExpense={(expense) => {
            setExpenseModalTarget(expense);
          }}
        />
      )}

      {/* Expense Modal (create / edit) */}
      {expenseModalTarget && (
        <ExpenseModal
          expense={
            "mode" in expenseModalTarget ? null : expenseModalTarget
          }
          defaultDate={
            "mode" in expenseModalTarget
              ? expenseModalTarget.defaultDate
              : undefined
          }
          onClose={() => setExpenseModalTarget(null)}
          onSave={handleExpenseSave}
          onDelete={handleExpenseDelete}
        />
      )}
    </div>
  );
}
