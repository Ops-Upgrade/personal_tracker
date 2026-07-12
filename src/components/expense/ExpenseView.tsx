"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/routes/paths";
import BackButton from "@/components/common/BackButton";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
import {
  createExpense,
  deleteExpense,
  fetchExpenses,
  updateExpense,
  uploadInvoice,
  deleteInvoice,
} from "@/api/expense";
import { parseISTDate } from "@/api/serverDate";
import type { Expense, ExpensePlaintext, ExpenseViewMode } from "@/types/expense";
import { MONTHS } from "@/types/expense";
import { useLocalStorage } from "@/lib/useLocalStorage";
import ViewToggle from "@/components/common/ViewToggle";
import type { ViewToggleOption } from "@/components/common/ViewToggle";
import { RectangleVertical, Columns2 } from "lucide-react";
import ErrorBanner from "@/components/common/ErrorBanner";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import BoxContainer, { SCROLLABLE_CLASSES } from "@/components/common/BoxContainer";
import ExpenseModal from "./ExpenseModal";
import MonthRow from "./MonthRow";
import YearDropdown from "./YearDropdown";

/** SVG icon symbols for the expense view toggle */
const EXPENSE_VIEW_OPTIONS: readonly ViewToggleOption<ExpenseViewMode>[] = [
  { value: "single", label: <RectangleVertical className="h-4 w-4" /> },
  { value: "multi", label: <Columns2 className="h-4 w-4" /> },
];


/**
 * Expense Tracker feature shell.
 * Orchestrates month list, year dropdown, and create/edit expense modals.
 * "View All" navigates to the dedicated /expense/all route with month/year params.
 */
export default function ExpenseView() {
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async (uid: string) => {
    const rows = await fetchExpenses(uid);
    setExpenses(rows);
  }, []);

  const { userId, istDate, isLoading, error, refreshData } =
    useAuthBootstrap({ loadData });

  const istParsed = useMemo(() => (istDate ? parseISTDate(istDate) : null), [istDate]);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode] = useLocalStorage<ExpenseViewMode>("expenseViewMode", "single");

  // ExpenseModal state: null = closed, "create" = new item, Expense = edit
  const [expenseModalTarget, setExpenseModalTarget] = useState<
    Expense | "create" | null
  >(null);
  const [createDefaultDate, setCreateDefaultDate] = useState<string>("");

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

  const clearHash = useCallback(() => {
    if (window.location.hash) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`
      );
    }
  }, []);

  const syncHashModal = useCallback(() => {
    const raw = window.location.hash.replace("#", "");
    if (!raw) {
      setExpenseModalTarget(null);
      return;
    }

    // Check for expense edit/create patterns
    if (raw === "new-expense") {
      setExpenseModalTarget("create");
      return;
    }

    if (raw.startsWith("edit-expense-")) {
      const expenseId = raw.slice(13);
      const expense = expenses.find((e) => e.id === expenseId);
      if (expense) {
        setExpenseModalTarget(expense);
        return;
      }
    }

    // Unknown hash — close any open modal
    setExpenseModalTarget(null);
  }, [expenses]);

  const closeExpenseModal = useCallback(() => {
    setExpenseModalTarget(null);
    clearHash();
  }, [clearHash]);

  // --- Hash-based navigation ---
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
    existingExpense: Expense | null,
    fileAction: { action: "upload" | "remove" | "keep"; file?: File }
  ) {
    if (!userId) throw new Error("No active session.");
    setIsSaving(true);

    try {
      let invoice_file = existingExpense?.invoice_file ?? "";
      let invoice_iv = existingExpense?.invoice_iv ?? "";
      let invoice_mime = existingExpense?.invoice_mime ?? "";

      // Handle file action
      if (fileAction.action === "remove") {
        // Delete old file from storage
        if (invoice_file) {
          try {
            await deleteInvoice(userId, invoice_file);
          } catch {
            // Swallow — best-effort cleanup
          }
        }
        invoice_file = "";
        invoice_iv = "";
        invoice_mime = "";
      } else if (fileAction.action === "upload" && fileAction.file) {
        // Delete old file first if exists
        if (invoice_file) {
          try {
            await deleteInvoice(userId, invoice_file);
          } catch {
            // Swallow
          }
        }
        // Upload new file
        const result = await uploadInvoice(userId, fileAction.file);
        invoice_file = result.fileName;
        invoice_iv = result.iv;
        invoice_mime = result.mimeType;
      }
      // "keep" — preserve existing values (already set above)

      const nowIso = new Date().toISOString();

      const payload: ExpensePlaintext = {
        item: draft.item,
        seller: draft.seller,
        cost: draft.cost,
        date: draft.date,
        reason: draft.reason,
        invoice: draft.invoice,
        invoice_file,
        invoice_iv,
        invoice_mime,
        updated_at: nowIso,
      };

      if (existingExpense) {
        await updateExpense(userId, existingExpense.id, payload);
      } else {
        await createExpense(userId, payload);
      }

      await refreshData(userId);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleExpenseDelete(expenseId: string) {
    if (!userId) throw new Error("No active session.");

    // Find the expense to get invoice file for cleanup
    const expense = expenses.find((e) => e.id === expenseId);
    const invoiceFile = expense?.invoice_file;

    await deleteExpense(expenseId);

    // Cleanup storage file if exists
    if (invoiceFile) {
      try {
        await deleteInvoice(userId, invoiceFile);
      } catch {
        // Swallow — best-effort cleanup
      }
    }

    await refreshData(userId);
  }

  // --- Render ---

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col items-start gap-4">
          <BackButton href={ROUTES.DASHBOARD}>← Back</BackButton>
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
                    window.location.hash = "new-expense";
                  }}
                  onSelectExpense={(expense) => {
                    window.location.hash = `edit-expense-${expense.id}`;
                  }}
                  onViewAll={() => router.push(`${ROUTES.EXPENSE_ALL}?month=${monthIndex}&year=${selectedYear}`)}
                />
              );
            })}
          </div>
        </BoxContainer>
      )}

      {/* Expense Modal (create / edit) — hash-driven */}
      {expenseModalTarget && (
        <ExpenseModal
          expense={expenseModalTarget === "create" ? null : expenseModalTarget}
          defaultDate={expenseModalTarget === "create" ? createDefaultDate : undefined}
          userId={userId ?? ""}
          isSaving={isSaving}
          onClose={closeExpenseModal}
          onSave={handleExpenseSave}
          onDelete={handleExpenseDelete}
        />
      )}
    </div>
  );
}