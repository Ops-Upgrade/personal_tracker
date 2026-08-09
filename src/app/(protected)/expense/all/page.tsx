"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ROUTES } from "@/routes/paths";
import type { Expense } from "@/types/expense";
import PageShell from "@/components/common/PageShell";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import GenericViewPage, { STANDARD_VIEWS } from "@/components/common/GenericViewPage";
import type { MonthGroup } from "@/components/common/GenericViewPage";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useTableSort } from "@/hooks/useTableSort";
import { useExpenseActions } from "@/hooks/useExpenseActions";
import { useExpenseData } from "@/hooks/useExpenseData";
import { byMonth } from "@/lib/viewHelpers";
import GenericDomainModal from "@/components/common/GenericDomainModal";
import { normalizeDateForInput } from "@/lib/utils";
import { EXPENSE_COLUMNS, SORT_CONFIGS, EXPENSE_FIELDS } from "@/components/expense/config";

export default function ExpenseAllPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { userId, nowYear, nowMonth, isLoading, error, refreshData, expenses, documents } =
    useExpenseData();

  // ── Year / Month filter state from URL params ──

  const urlYear = searchParams.get("year");
  const urlMonth = searchParams.get("month");

  const initialYear = urlYear ? Number(urlYear) : nowYear || new Date().getFullYear();
  const initialMonth = urlMonth ? Number(urlMonth) : ("all" as const);

  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedMonth, setSelectedMonth] = useState<number | "all">(initialMonth);
  const [activeView, setActiveView] = useLocalStorage<string>("expenseAllView", "all");

  // ── Derived data ──

  const availableYears = useMemo(() => {
    const currentYear = nowYear || new Date().getFullYear();
    const yearsFromData = new Set(
      expenses.map((e) => new Date(e.date).getFullYear()),
    );
    yearsFromData.add(currentYear);
    return Array.from(yearsFromData).sort((a, b) => b - a);
  }, [expenses, nowYear]);

  const availableMonths = useMemo(() => {
    const months = new Set<number>();
    for (const e of expenses) {
      const d = new Date(e.date);
      if (d.getFullYear() === selectedYear) {
        months.add(d.getMonth());
      }
    }
    return Array.from(months).sort((a, b) => a - b);
  }, [expenses, selectedYear]);

  const expensesForYear = useMemo(
    () =>
      expenses.filter((e) => new Date(e.date).getFullYear() === selectedYear),
    [expenses, selectedYear],
  );

  const expensesForMonth = useMemo(
    () =>
      selectedMonth === "all"
        ? expensesForYear
        : expensesForYear.filter(
            (e) => new Date(e.date).getMonth() === selectedMonth,
          ),
    [expensesForYear, selectedMonth],
  );

  const monthGroups: MonthGroup<Expense>[] = useMemo(
    () => byMonth(expensesForYear, selectedYear),
    [expensesForYear, selectedYear],
  );

  // ── Sort ──

  const { sortState, handleSort, sorted } = useTableSort(
    "expenseAllSortState",
    expensesForMonth,
    SORT_CONFIGS,
  );

  // ── Modal state ──

  const [modalTarget, setModalTarget] = useState<Expense | null>(null);

  const closeModal = () => setModalTarget(null);

  // ── CRUD handlers ──

  const refresh = useCallback(async () => {
    if (!userId) return;
    await refreshData(userId);
  }, [userId, refreshData]);

  const { createSaveAdapter, handleExpenseDelete, handleDownloadDocument } =
    useExpenseActions({ userId, refresh });

  const emptyMessage =
    selectedMonth === "all"
      ? `No expenses recorded in ${selectedYear}.`
      : `No expenses recorded in ${selectedYear} for the selected month.`;

  // ── Render ──

  return (
    <>
      <PageShell
        backHref={ROUTES.EXPENSE}
        title="All Expenses"
        description="Browse all your expenses by year and month."
        error={error}
        onRetry={() => userId && refreshData(userId)}
      >
        {isLoading && <LoadingSpinner />}

        {!isLoading && (
          <GenericViewPage
            items={sorted}
            columns={EXPENSE_COLUMNS}
            getItemKey={(exp) => exp.id}
            views={STANDARD_VIEWS.ALL_MONTHS}
            activeView={activeView}
            onViewChange={setActiveView}
            yearFilter={{
              years: availableYears,
              selectedYear,
              onChange: (year) => {
                setSelectedYear(year);
                setSelectedMonth("all");
                router.replace(
                  `${ROUTES.EXPENSE_ALL}?year=${year}`,
                  { scroll: false },
                );
              },
            }}
            monthFilter={{
              months: availableMonths,
              selectedMonth,
              onChange: (month) => {
                setSelectedMonth(month);
                const params = new URLSearchParams();
                params.set("year", String(selectedYear));
                if (month !== "all") params.set("month", String(month));
                router.replace(
                  `${ROUTES.EXPENSE_ALL}?${params.toString()}`,
                  { scroll: false },
                );
              },
            }}
            sortState={sortState}
            onSortChange={handleSort}
            emptyMessage={emptyMessage}
            onRowClick={(exp) => setModalTarget(exp)}
            monthGroups={monthGroups}
            nowYear={nowYear ?? new Date().getFullYear()}
            nowMonth={nowMonth ?? new Date().getMonth()}
            disableMonthToggle
          />
        )}
      </PageShell>

      {modalTarget && userId && (
        <GenericDomainModal
          key={modalTarget.id}
          mode="record"
          title="Edit expense"
          onClose={closeModal}
          fields={EXPENSE_FIELDS}
          initialData={{
            item: modalTarget.item,
            seller: modalTarget.seller,
            cost: String(modalTarget.cost),
            date: normalizeDateForInput(modalTarget.date),
            reason: modalTarget.reason,
          }}
          allowFiles
          allowLinking={false}
          userId={userId}
          attachedDocuments={documents.filter(
            (d) => d.domain === "expense" && d.linked_id === modalTarget.id,
          )}
          domain="expense"
          onSave={createSaveAdapter(modalTarget)}
          onDeleteWithCascade={async (cascadeMode) => {
            await handleExpenseDelete(modalTarget.id, cascadeMode);
          }}
          deleteLabel="Delete"
          onDownloadDocument={handleDownloadDocument}
        />
      )}
    </>
  );
}
