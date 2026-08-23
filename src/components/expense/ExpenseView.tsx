"use client";

import { useCallback } from "react";
import { ROUTES } from "@/routes/paths";
import { useQueryModal } from "@/lib/useQueryModal";
import { useExpenseActions } from "@/hooks/useExpenseActions";
import { useExpenseData } from "@/hooks/useExpenseData";
import { FolderIcon } from "@/components/common/Icons";
import GenericDomainPage from "@/components/common/GenericDomainPage";
import GenericDomainModal from "@/components/common/GenericDomainModal";
import type { Expense } from "@/types/expense";
import { EXPENSE_FIELDS, EXPENSE_COLUMNS } from "./config";

/**
 * Expense Tracker feature shell.
 * "View All" navigates to the dedicated /expense/all route with month/year params.
 * Query-param-driven modals via useQueryModal ("expense" prefix).
 * All structural rendering (year dropdown, month buckets, view toggle,
 * single/multi masonry) is owned by GenericDomainPage (full-width).
 */
export default function ExpenseView() {
  const { userId, nowYear, nowMonth, isLoading, error, refreshData, expenses } =
    useExpenseData();

  const refresh = useCallback(async () => {
    if (!userId) return;
    await refreshData(userId);
  }, [userId, refreshData]);

  const { handleDownloadDocument } = useExpenseActions({ userId, refresh });

  // Query-param-driven modal state via shared hook
  const { modalTarget, openCreate, openEdit, openEditId, closeModal } = useQueryModal(expenses, "expense");

  // ── Month row subtitle (total + count per month) ──

  const getSubtitle = useCallback((items: Expense[]) => {
    const total = items.reduce((sum, e) => sum + e.cost, 0);
    const count = items.length;
    return <>Total Expense: ₹ {total.toLocaleString("en-IN")} · {count} item{count !== 1 ? "s" : ""}</>;
  }, []);

  // ── Render ──

  return (
    <GenericDomainPage<Expense>
      data={expenses}
      columns={EXPENSE_COLUMNS}
      domain="expense"
      getDateKey={(expense) => expense.date}
      getItemKey={(expense) => expense.id}
      supportedViews={["single", "multi"]}
      title="Expenses"
      description="Track and manage your spending."
      backHref={ROUTES.DASHBOARD}
      onAdd={() => openCreate()}
      isLoading={isLoading}
      error={error}
      onRetry={() => {
        void refresh();
      }}
      nowYear={nowYear}
      nowMonth={nowMonth}
      viewCacheKey="expenseViewMode"
      storeHref={ROUTES.EXPENSE_STORE}
      storeLabel="Receipt Store"
      storeIcon={<FolderIcon className="h-5 w-5 text-emerald-500" />}
      headerStat={({ selectedYear, itemsForYear }) => {
        const yearlyTotal = itemsForYear
          .filter((e) => !!e.date)
          .reduce((sum, e) => sum + e.cost, 0);
        return (
          <p className="mt-2 text-base font-medium text-zinc-700 dark:text-zinc-300">
            Total for {selectedYear}:{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              ₹ {yearlyTotal.toLocaleString("en-IN")}
            </span>
          </p>
        );
      }}
      viewAllBaseHref={ROUTES.EXPENSE_ALL}
      getSubtitle={getSubtitle}
      onRowClick={openEdit}
      modalSlot={
        modalTarget && userId && (
          <GenericDomainModal
            mode="record"
            domain="expense"
            target={
              modalTarget === "create"
                ? undefined
                : {
                    type: "record",
                    id: modalTarget.id,
                    data: modalTarget as unknown as Record<string, unknown>,
                  }
            }
            fields={EXPENSE_FIELDS}
            userId={userId}
            onClose={closeModal}
            onSaved={async (saved) => {
              await refresh();
              if (modalTarget === "create") openEditId(saved.id);
            }}
            onDeleted={async () => {
              await refresh();
            }}
            onDownloadDocument={handleDownloadDocument}
          />
        )
      }
    />
  );
}
