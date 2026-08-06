"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
import { fetchExpenses } from "@/api/expense";
import { fetchDocuments } from "@/api/common/documents";
import { ROUTES } from "@/routes/paths";
import type { Expense } from "@/types/expense";
import type { Document } from "@/types/document";
import PageShell from "@/components/common/PageShell";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import GenericViewPage, { STANDARD_VIEWS } from "@/components/common/GenericViewPage";
import type { ColumnDef, MonthGroup } from "@/components/common/GenericViewPage";
import { PaperClipIcon } from "@/components/common/Icons";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useTableSort, type SortConfig } from "@/hooks/useTableSort";
import { useExpenseActions } from "@/hooks/useExpenseActions";
import { byMonth, trunc } from "@/lib/viewHelpers";
import ExpenseModal from "@/components/expense/ExpenseModal";

// ── Sort helpers ──

type SortColumn = "item" | "seller" | "cost" | "date" | "reason";

const SORT_CONFIGS: SortConfig<SortColumn, Expense>[] = [
  { column: "item", extractor: (exp) => exp.item.toLowerCase() },
  { column: "seller", extractor: (exp) => (exp.seller ?? "").toLowerCase() },
  { column: "cost", extractor: (exp) => exp.cost },
  { column: "date", extractor: (exp) => new Date(exp.date + "T00:00:00").getTime() },
  { column: "reason", extractor: (exp) => exp.reason.replace(/<[^>]*>/g, "").trim().toLowerCase() },
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ExpenseAllPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

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

  const { userId, nowYear, nowMonth, isLoading, error, refreshData } =
    useAuthBootstrap({ loadData });

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

  const { handleExpenseSave, handleExpenseDelete, handleDownloadDocument } =
    useExpenseActions({ userId, refresh });

  // ── Column definitions ──

  const expenseColumns: ColumnDef<Expense, SortColumn>[] = useMemo(
    () => [
      {
        key: "item",
        header: "Item",
        colSpan: 3,
        sortColumn: "item",
        render: (exp) => (
          <span className="font-medium text-zinc-800 dark:text-zinc-100">
            {trunc(exp.item, 24) || "—"}
          </span>
        ),
      },
      {
        key: "seller",
        header: "Seller",
        colSpan: 2,
        sortColumn: "seller",
        render: (exp) => (
          <span className="text-zinc-600 dark:text-zinc-300">
            {trunc(exp.seller, 20) || "—"}
          </span>
        ),
      },
      {
        key: "cost",
        header: "Cost",
        colSpan: 2,
        sortColumn: "cost",
        render: (exp) => (
          <span className="text-zinc-700 dark:text-zinc-200">
            ₹ {exp.cost.toLocaleString("en-IN")}
          </span>
        ),
      },
      {
        key: "date",
        header: "Date",
        colSpan: 2,
        sortColumn: "date",
        render: (exp) => (
          <span className="text-zinc-600 dark:text-zinc-300">
            {formatDate(exp.date)}
          </span>
        ),
      },
      {
        key: "reason",
        header: "Reason",
        colSpan: 2,
        sortColumn: "reason",
        render: (exp) => (
          <span className="text-zinc-500 dark:text-zinc-400">
            {trunc(exp.reason, 20) || "—"}
          </span>
        ),
      },
      {
        key: "files",
        header: "Files",
        colSpan: 1,
        render: (exp) => {
          const count = exp.document_ids?.length ?? 0;
          return count > 0 ? (
            <span
              className="inline-flex items-center justify-center gap-1 text-emerald-500"
              title={`${count} document(s) attached`}
            >
              <PaperClipIcon className="h-4 w-4" />
              <span className="text-zinc-600 dark:text-zinc-300">
                ({count})
              </span>
            </span>
          ) : (
            <span className="text-zinc-400">—</span>
          );
        },
      },
    ],
    [],
  );

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
            columns={expenseColumns}
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
          />
        )}
      </PageShell>

      {modalTarget && userId && (
        <ExpenseModal
          expense={modalTarget}
          documents={documents}
          userId={userId}
          onClose={closeModal}
          onSave={handleExpenseSave}
          onDelete={handleExpenseDelete}
          onDownloadDocument={handleDownloadDocument}
        />
      )}
    </>
  );
}
