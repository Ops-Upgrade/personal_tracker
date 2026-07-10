"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
import { fetchExpenses } from "@/api/expense";
import { ROUTES } from "@/routes/paths";
import type { Expense, ExpenseViewMode } from "@/types/expense";
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

const EXPENSE_VIEW_OPTIONS: readonly ViewToggleOption<ExpenseViewMode>[] = [
  { value: "single", label: <RectangleVertical className="h-4 w-4" /> },
  { value: "multi", label: <Columns2 className="h-4 w-4" /> },
];

function AllExpensesContent() {
  const router = useRouter();
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

  const handleEditExpense = (expenseId: string) => {
    router.push(`${ROUTES.EXPENSE}#edit-expense-${expenseId}`);
  };

  return (
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
                {monthExpenses.length === 0 ? (
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">No expenses</div>
                ) : (
                  <div className="space-y-1">
                    {monthExpenses.map((expense) => (
                      <div
                        key={expense.id}
                        className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-1.5 dark:border-zinc-700"
                      >
                        <button
                          type="button"
                          onClick={() => handleEditExpense(expense.id)}
                          className="flex-1 cursor-pointer text-left text-sm"
                        >
                          <span className="font-medium text-zinc-800 dark:text-zinc-200">
                            {expense.item}
                          </span>
                          {expense.seller && (
                            <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                              {expense.seller}
                            </span>
                          )}
                        </button>
                        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                          ₹ {expense.cost.toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))}
                    <div className="text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 pr-1">
                      Total: ₹ {monthExpenses.reduce((s, e) => s + e.cost, 0).toLocaleString("en-IN")}
                    </div>
                  </div>
                )}
              </MonthTile>
            ))}
          </div>
        </BoxContainer>
      )}
    </PageShell>
  );
}

export default function AllExpensesPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <AllExpensesContent />
    </Suspense>
  );
}
