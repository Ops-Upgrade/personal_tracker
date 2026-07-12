"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
import {
  createExpense,
  deleteExpense,
  fetchExpenses,
  updateExpense,
  uploadInvoice,
  deleteInvoice,
} from "@/api/expense";
import { ROUTES } from "@/routes/paths";
import type { Expense, ExpensePlaintext, ExpenseViewMode } from "@/types/expense";
import { MONTHS } from "@/types/expense";
import { useLocalStorage } from "@/lib/useLocalStorage";
import ViewToggle from "@/components/common/ViewToggle";
import type { ViewToggleOption } from "@/components/common/ViewToggle";
import { RectangleVertical, Columns2 } from "lucide-react";
import MonthTile from "@/components/common/MonthTile";
import BoxContainer, { SCROLLABLE_CLASSES } from "@/components/common/BoxContainer";
import PageShell from "@/components/common/PageShell";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import YearDropdown from "@/components/expense/YearDropdown";
import ExpenseModal from "@/components/expense/ExpenseModal";
import ExpenseTable from "@/components/expense/ExpenseTable";

const EXPENSE_VIEW_OPTIONS: readonly ViewToggleOption<ExpenseViewMode>[] = [
  { value: "single", label: <RectangleVertical className="h-4 w-4" /> },
  { value: "multi", label: <Columns2 className="h-4 w-4" /> },
];

function AllExpensesContent() {
  const searchParams = useSearchParams();
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Read optional month/year filters from query params
  const filterMonth = searchParams.get("month");
  const filterYear = searchParams.get("year");
  const monthIndex = filterMonth !== null ? parseInt(filterMonth, 10) : null;
  const yearFilter = filterYear !== null ? parseInt(filterYear, 10) : null;
  const isFiltered = monthIndex !== null && !isNaN(monthIndex) && yearFilter !== null && !isNaN(yearFilter);

  const loadData = useCallback(async (uid: string) => {
    const rows = await fetchExpenses(uid);
    setExpenses(rows);
  }, []);

  const { userId, isLoading, error, refreshData } =
    useAuthBootstrap({ loadData });

  const [viewMode, setViewMode] = useLocalStorage<ExpenseViewMode>("expenseViewMode", "single");
  const [selectedYear, setSelectedYear] = useState(yearFilter ?? new Date().getFullYear());
  const [expenseModalTarget, setExpenseModalTarget] = useState<Expense | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearsFromData = new Set(
      expenses.map((e) => new Date(e.date).getFullYear())
    );
    yearsFromData.add(currentYear);
    return Array.from(yearsFromData).sort((a, b) => b - a);
  }, [expenses]);

  const expensesByMonth = useMemo(() => {
    const months = isFiltered && monthIndex !== null
      ? [{ name: MONTHS[monthIndex], index: monthIndex }]
      : MONTHS.map((name, idx) => ({ name, index: idx }));

    return months.map(({ name: monthName, index: mIdx }) => {
      const filtered = expenses.filter((e) => {
        const d = new Date(e.date);
        return d.getFullYear() === selectedYear && d.getMonth() === mIdx;
      });
      return { monthName, monthIndex: mIdx, expenses: filtered };
    });
  }, [expenses, selectedYear, isFiltered, monthIndex]);

  const yearlyTotal = useMemo(() => {
    return expensesByMonth.reduce((acc, month) => {
      return acc + month.expenses.reduce((sum, e) => sum + e.cost, 0);
    }, 0);
  }, [expensesByMonth]);

  const handleEditExpense = (expense: Expense) => {
    setExpenseModalTarget(expense);
  };

  const closeExpenseModal = () => setExpenseModalTarget(null);

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

      if (fileAction.action === "remove") {
        if (invoice_file) {
          try { await deleteInvoice(userId, invoice_file); } catch { /* best-effort */ }
        }
        invoice_file = "";
        invoice_iv = "";
        invoice_mime = "";
      } else if (fileAction.action === "upload" && fileAction.file) {
        if (invoice_file) {
          try { await deleteInvoice(userId, invoice_file); } catch { /* best-effort */ }
        }
        const result = await uploadInvoice(userId, fileAction.file);
        invoice_file = result.fileName;
        invoice_iv = result.iv;
        invoice_mime = result.mimeType;
      }

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
    const expense = expenses.find((e) => e.id === expenseId);
    const invoiceFile = expense?.invoice_file;

    await deleteExpense(expenseId);

    if (invoiceFile) {
      try { await deleteInvoice(userId, invoiceFile); } catch { /* best-effort */ }
    }

    await refreshData(userId);
  }

  return (
    <>
      <PageShell
        backHref={ROUTES.EXPENSE}
        backLabel="← Back to Expenses"
        title={isFiltered ? `${MONTHS[monthIndex!]} ${yearFilter}` : "All Expenses"}
        description={isFiltered ? `Expenses for ${MONTHS[monthIndex!]} ${yearFilter}.` : "Browse all your expenses by year and month."}
        error={error}
        onRetry={() => userId && refreshData(userId)}
      >
      {!isLoading && (
        <p className="-mt-2 text-base font-medium text-zinc-700 dark:text-zinc-300">
          Total for {selectedYear}:{" "}
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            ₹ {yearlyTotal.toLocaleString("en-IN")}
          </span>
        </p>
      )}

      {isLoading && <LoadingSpinner />}

      {!isLoading && (
        <BoxContainer>
          <header className="mb-3 flex items-center justify-between gap-3">
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
            {expensesByMonth.map(({ monthName, expenses: monthExpenses }) => (
              <MonthTile
                key={monthName}
                title={monthName}
                defaultExpanded={monthExpenses.length > 0}
                accent={monthExpenses.length > 0}
                className="text-sm"
              >
                <ExpenseTable expenses={monthExpenses} onSelectExpense={handleEditExpense} />
                {monthExpenses.length > 0 && (
                  <div className="text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 pr-1 mt-1">
                    Total: ₹ {monthExpenses.reduce((s, e) => s + e.cost, 0).toLocaleString("en-IN")}
                  </div>
                )}
              </MonthTile>
            ))}
          </div>
        </BoxContainer>
      )}
    </PageShell>

      {expenseModalTarget && (
        <ExpenseModal
          expense={expenseModalTarget}
          userId={userId ?? ""}
          isSaving={isSaving}
          onClose={closeExpenseModal}
          onSave={handleExpenseSave}
          onDelete={handleExpenseDelete}
        />
      )}
    </>
  );
}

export default function AllExpensesPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <AllExpensesContent />
    </Suspense>
  );
}
