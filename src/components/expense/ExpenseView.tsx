"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ROUTES } from "@/routes/paths";
import BackButton from "@/components/common/BackButton";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
import { useQueryModal } from "@/lib/useQueryModal";
import {
  fetchExpenses,
} from "@/api/expense";
import {
  fetchDocuments,
} from "@/api/common/documents";
import { parseISTDate } from "@/api/serverDate";
import type { Expense, ExpenseViewMode } from "@/types/expense";
import type { Document } from "@/types/document";
import { MONTHS } from "@/types/expense";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useExpenseActions } from "@/hooks/useExpenseActions";
import ViewToggle from "@/components/common/ViewToggle";
import type { ViewToggleOption } from "@/components/common/ViewToggle";
import { List, LayoutGrid } from "lucide-react";
import { FolderIcon } from "@/components/common/Icons";
import ErrorBanner from "@/components/common/ErrorBanner";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import BoxContainer, { SCROLLABLE_CLASSES } from "@/components/common/BoxContainer";
import ExpenseModal from "./ExpenseModal";
import MonthRow from "./MonthRow";
import YearDropdown from "@/components/common/YearDropdown";

/** SVG icon symbols for the expense view toggle */
const EXPENSE_VIEW_OPTIONS: readonly ViewToggleOption<ExpenseViewMode>[] = [
  { value: "single", label: <List className="h-4 w-4" /> },
  { value: "multi", label: <LayoutGrid className="h-4 w-4" /> },
];


/**
 * Expense Tracker feature shell.
 * Orchestrates month list, year dropdown, and create/edit expense modals.
 * "View All" navigates to the dedicated /expense/all route with month/year params.
 * Query-param-driven modals (like EducationView).
 */
export default function ExpenseView() {
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  const loadData = useCallback(async (uid: string) => {
    const [expRows, docRows] = await Promise.all([
      fetchExpenses(uid),
      fetchDocuments(uid),
    ]);
    setExpenses(expRows);
    setDocuments(docRows);
  }, []);

  const { userId, istDate, isLoading, error, refreshData } =
    useAuthBootstrap({ loadData });

  const refresh = useCallback(async () => {
    if (!userId) return;
    await refreshData(userId);
  }, [userId, refreshData]);

  const { handleExpenseSave, handleExpenseDelete, handleDownloadDocument } =
    useExpenseActions({ userId, refresh });

  const istParsed = useMemo(() => (istDate ? parseISTDate(istDate) : null), [istDate]);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode] = useLocalStorage<ExpenseViewMode>("expenseViewMode", "single");

  // Query-param-driven modal state via shared hook
  const { modalTarget, openCreate, openEdit, closeModal } = useQueryModal(expenses, "expense");

  // Default date for create mode — set by MonthRow callbacks
  const [createDefaultDate, setCreateDefaultDate] = useState<string>("");

  // Auto-scroll to the current month tile on load / year change
  useEffect(() => {
    if (isLoading) return;
    const timeout = setTimeout(() => {
      document
        .getElementById("current-month-tile")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => clearTimeout(timeout);
  }, [isLoading, selectedYear]);

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

  // --- Render ---

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col items-start gap-4">
          <BackButton href={ROUTES.DASHBOARD} />
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
        </div>
      </div>

      {/* Loading state */}
      {isLoading && <LoadingSpinner />}

      {/* Error state */}
      {error && (
        <ErrorBanner
          message={error}
          onRetry={() => userId && refreshData(userId)}
        />
      )}

      {/* Receipt Store link */}
      {!isLoading && (
        <div className="flex w-full justify-end">
          <div className="w-full lg:w-1/3">
            <Link
              href={ROUTES.EXPENSE_STORE}
              className="flex items-center justify-center gap-2 w-full rounded-xl border border-zinc-200 bg-white p-4 shadow-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800/80 transition-colors"
            >
              <FolderIcon className="h-5 w-5 text-emerald-500" />
              Receipt Store
            </Link>
          </div>
        </div>
      )}

      {/* Month rows */}
      {!isLoading && (
        <BoxContainer>
          <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Months
              </h2>
              <ViewToggle
                value={viewMode}
                onChange={setViewMode}
                options={EXPENSE_VIEW_OPTIONS}
                ariaLabel="Expense view toggle"
              />
            </div>
            <YearDropdown
              years={availableYears}
              selectedYear={selectedYear}
              onChange={setSelectedYear}
            />
          </header>
          <div className={`${SCROLLABLE_CLASSES} grid grid-cols-1 items-start gap-4 ${viewMode === "multi" ? "md:grid-cols-2" : ""}`}>
            {expensesByMonth.map(({ monthName, monthIndex, expenses: monthExpenses }) => {
              const isCurrentMonth =
                istParsed !== null &&
                selectedYear === istParsed.year &&
                monthIndex === istParsed.month;
              return (
                <MonthRow
                  key={monthName}
                  monthName={monthName}
                  monthIndex={monthIndex}
                  year={selectedYear}
                  expenses={monthExpenses}
                  isCurrentMonth={isCurrentMonth}
                  onAdd={() => {
                    // Use today's IST date as default if viewing the current month; otherwise month-01
                    const defaultDate =
                      isCurrentMonth && istDate
                        ? istDate
                        : `${selectedYear}-${String(monthIndex + 1).padStart(2, "0")}-01`;
                    setCreateDefaultDate(defaultDate);
                    openCreate();
                  }}
                  onSelectExpense={(expense) => {
                    openEdit(expense);
                  }}
                  onViewAll={() => router.push(`${ROUTES.EXPENSE_ALL}?month=${monthIndex}&year=${selectedYear}`)}
                />
              );
            })}
          </div>
        </BoxContainer>
      )}

      {/* Expense Modal (create / edit) — query-param-driven */}
      {modalTarget && userId && (
        <ExpenseModal
          expense={modalTarget === "create" ? null : modalTarget}
          defaultDate={modalTarget === "create" ? createDefaultDate : undefined}
          documents={documents}
          userId={userId}
          onClose={closeModal}
          onSave={handleExpenseSave}
          onDelete={handleExpenseDelete}
          onDownloadDocument={handleDownloadDocument}
        />
      )}
    </div>
  );
}
