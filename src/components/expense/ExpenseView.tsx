"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ROUTES } from "@/routes/paths";
import Button from "@/components/common/Button";
import { useQueryModal } from "@/lib/useQueryModal";
import { parseISTDate } from "@/api/serverDate";
import type { Expense, ExpenseViewMode } from "@/types/expense";
import { MONTHS } from "@/types/common";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useExpenseActions } from "@/hooks/useExpenseActions";
import { useExpenseData } from "@/hooks/useExpenseData";
import ViewToggle from "@/components/common/ViewToggle";
import type { ViewToggleOption } from "@/components/common/ViewToggle";
import { List, LayoutGrid } from "lucide-react";
import { FolderIcon, PaperClipIcon } from "@/components/common/Icons";
import BoxContainer, { SCROLLABLE_CLASSES } from "@/components/common/BoxContainer";
import GenericDomainPage from "@/components/common/GenericDomainPage";
import type { DomainPageContext } from "@/components/common/GenericDomainPage";
import type { ColumnDef } from "@/components/common/GenericViewPage";
import GenericDomainModal from "@/components/common/GenericDomainModal";
import { normalizeDateForInput } from "@/lib/utils";
import { EXPENSE_FIELDS } from "./config";
import GenericMonthRow from "@/components/common/GenericMonthRow";
import YearDropdown from "@/components/common/YearDropdown";
import { trunc } from "@/lib/viewHelpers";

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** SVG icon symbols for the expense view toggle */
const EXPENSE_VIEW_OPTIONS: readonly ViewToggleOption<ExpenseViewMode>[] = [
  { value: "single", label: <List className="h-4 w-4" /> },
  { value: "multi", label: <LayoutGrid className="h-4 w-4" /> },
];

/**
 * Expense Tracker feature shell.
 * Orchestrates month list, year dropdown, and create/edit expense modals.
 * "View All" navigates to the dedicated /expense/all route with month/year params.
 * Query-param-driven modals via useQueryModal ("expense" prefix).
 * Layout shell delegated to GenericDomainPage (full-width).
 */
export default function ExpenseView() {
  const { userId, istDate, isLoading, error, refreshData, expenses, documents } =
    useExpenseData();

  const refresh = useCallback(async () => {
    if (!userId) return;
    await refreshData(userId);
  }, [userId, refreshData]);

  const { createSaveAdapter, handleExpenseDelete, handleDownloadDocument } =
    useExpenseActions({ userId, refresh });

  // Query-param-driven modal state via shared hook
  const { modalTarget, openCreate, openEdit, closeModal } = useQueryModal(expenses, "expense");

  const istParsed = useMemo(() => (istDate ? parseISTDate(istDate) : null), [istDate]);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode] = useLocalStorage<ExpenseViewMode>("expenseViewMode", "single");

  // Auto-scroll to the current month tile on load / year / view change
  useEffect(() => {
    if (isLoading) return;
    const timeout = setTimeout(() => {
      document
        .getElementById("current-month-tile")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => clearTimeout(timeout);
  }, [isLoading, selectedYear, viewMode]);

  // ── Derived data ──

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearsFromData = new Set(
      expenses.map((e) => new Date(e.date).getFullYear())
    );
    yearsFromData.add(currentYear);
    return Array.from(yearsFromData).sort((a, b) => b - a);
  }, [expenses]);

  const expensesByMonth = useMemo(() => {
    return MONTHS.map((monthName, monthIndex) => {
      const filtered = expenses.filter((e) => {
        const d = new Date(e.date);
        return d.getFullYear() === selectedYear && d.getMonth() === monthIndex;
      });
      return { monthName, monthIndex, expenses: filtered };
    });
  }, [expenses, selectedYear]);

  const yearlyTotal = useMemo(() => {
    return expensesByMonth.reduce((acc, month) => {
      return acc + month.expenses.reduce((sum, e) => sum + e.cost, 0);
    }, 0);
  }, [expensesByMonth]);

  // ── Column definitions for month preview rows ──

  const expenseColumns: ColumnDef<Expense>[] = useMemo(
    () => [
      {
        key: "item",
        header: "Item",
        colSpan: 3,
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
        render: (exp) => (
          <span className="text-zinc-600 dark:text-zinc-300">
            {formatShortDate(exp.date)}
          </span>
        ),
      },
      {
        key: "reason",
        header: "Reason",
        colSpan: 2,
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
            <span className="inline-flex items-center justify-center gap-1 text-emerald-500" title={`${count} document(s) attached`}>
              <PaperClipIcon className="h-4 w-4" />
              <span className="text-zinc-600 dark:text-zinc-300">({count})</span>
            </span>
          ) : (
            <span className="text-zinc-400">—</span>
          );
        },
      },
    ],
    [],
  );

  // ── Context for GenericDomainPage ──

  const ctx: DomainPageContext = useMemo(
    () => ({
      userId,
      istDate,
      nowYear: new Date().getFullYear(),
      nowMonth: new Date().getMonth(),
      isLoading,
      error,
      refreshData,
    }),
    [userId, istDate, isLoading, error, refreshData],
  );

  // ── Render ──

  return (
    <GenericDomainPage
      ctx={ctx}
      title="Expenses"
      description="Track and manage your spending."
      backHref={ROUTES.DASHBOARD}
      storeHref={ROUTES.EXPENSE_STORE}
      storeLabel="Receipt Store"
      storeIcon={<FolderIcon className="h-5 w-5 text-emerald-500" />}
      headerStat={
        !isLoading ? (
          <p className="mt-2 text-base font-medium text-zinc-700 dark:text-zinc-300">
            Total for {selectedYear}:{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              ₹ {yearlyTotal.toLocaleString("en-IN")}
            </span>
          </p>
        ) : undefined
      }
      modalSlot={
        modalTarget && userId && (
          <GenericDomainModal
            key={modalTarget === "create" ? "create" : modalTarget.id}
            mode="record"
            title={modalTarget === "create" ? "Add expense" : "Edit expense"}
            onClose={closeModal}
            fields={EXPENSE_FIELDS}
            initialData={{
              item: modalTarget === "create" ? "" : modalTarget.item,
              seller: modalTarget === "create" ? "" : modalTarget.seller,
              cost: modalTarget === "create" ? "" : String(modalTarget.cost),
              date:
                modalTarget === "create"
                  ? (istDate ?? "")
                  : normalizeDateForInput(modalTarget.date),
              reason: modalTarget === "create" ? "" : modalTarget.reason,
            }}
            allowFiles
            allowLinking={false}
            userId={userId}
            attachedDocuments={
              modalTarget !== "create" && modalTarget
                ? documents.filter(
                    (d) => d.domain === "expense" && d.linked_id === modalTarget.id,
                  )
                : []
            }
            domain="expense"
            onSave={createSaveAdapter(
              modalTarget === "create" ? null : modalTarget,
              modalTarget === "create"
                ? (saved) => openEdit(saved)
                : undefined,
            )}
            onDeleteWithCascade={
              modalTarget !== "create" && modalTarget
                ? async (cascadeMode) => {
                    await handleExpenseDelete(modalTarget.id, cascadeMode);
                  }
                : undefined
            }
            deleteLabel="Delete"
            onDownloadDocument={handleDownloadDocument}
          />
        )
      }
      renderBody={() => (
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
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="md" onClick={() => openCreate()} disabled={isLoading}>
                + Add
              </Button>
              <YearDropdown
                years={availableYears}
                selectedYear={selectedYear}
                onChange={setSelectedYear}
              />
            </div>
          </header>
          <div className={`${SCROLLABLE_CLASSES} flex flex-col md:flex-row gap-4 items-start`}>
            {/* Left Column (or Single Column) */}
            <div className="flex-1 flex flex-col gap-4 w-full">
              {expensesByMonth
                .filter((_, i) => viewMode === "multi" ? i % 2 === 0 : true)
                .map(({ monthName, monthIndex, expenses: monthExpenses }) => {
                  const isCurrentMonth =
                    istParsed !== null &&
                    selectedYear === istParsed.year &&
                    monthIndex === istParsed.month;
                  return (
                    <GenericMonthRow
                      key={monthName}
                      monthName={monthName}
                      monthIndex={monthIndex}
                      year={selectedYear}
                      items={monthExpenses}
                      isCurrentMonth={isCurrentMonth}
                      getDate={(expense) => expense.date}
                      getSubtitle={(items) => {
                        const total = items.reduce((sum, e) => sum + e.cost, 0);
                        const count = items.length;
                        return <>Total Expense: ₹ {total.toLocaleString("en-IN")} · {count} item{count !== 1 ? "s" : ""}</>;
                      }}
                      columns={expenseColumns}
                      getItemKey={(expense) => expense.id}
                      previewCount={5}
                      onRowClick={(expense) => openEdit(expense)}
                      viewAllHref={`${ROUTES.EXPENSE_ALL}?year=${selectedYear}&month=${monthIndex}`}
                    />
                  );
                })}
            </div>

            {/* Right Column (only visible in multi view) */}
            {viewMode === "multi" && (
              <div className="flex-1 flex-col gap-4 w-full hidden md:flex">
                {expensesByMonth
                  .filter((_, i) => i % 2 !== 0)
                  .map(({ monthName, monthIndex, expenses: monthExpenses }) => {
                    const isCurrentMonth =
                      istParsed !== null &&
                      selectedYear === istParsed.year &&
                      monthIndex === istParsed.month;
                    return (
                      <GenericMonthRow
                        key={monthName}
                        monthName={monthName}
                        monthIndex={monthIndex}
                        year={selectedYear}
                        items={monthExpenses}
                        isCurrentMonth={isCurrentMonth}
                        getDate={(expense) => expense.date}
                        getSubtitle={(items) => {
                          const total = items.reduce((sum, e) => sum + e.cost, 0);
                          const count = items.length;
                          return <>Total Expense: ₹ {total.toLocaleString("en-IN")} · {count} item{count !== 1 ? "s" : ""}</>;
                        }}
                        columns={expenseColumns}
                        getItemKey={(expense) => expense.id}
                        previewCount={5}
                        onRowClick={(expense) => openEdit(expense)}
                        viewAllHref={`${ROUTES.EXPENSE_ALL}?year=${selectedYear}&month=${monthIndex}`}
                      />
                    );
                  })}
              </div>
            )}
          </div>
        </BoxContainer>
      )}
    />
  );
}
