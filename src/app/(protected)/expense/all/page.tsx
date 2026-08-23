"use client";

import { useCallback, useState } from "react";
import { ROUTES } from "@/routes/paths";
import type { Expense } from "@/types/expense";
import PageShell from "@/components/common/PageShell";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import GenericViewPage from "@/components/common/GenericViewPage";
import { useExpenseActions } from "@/hooks/useExpenseActions";
import { useExpenseData } from "@/hooks/useExpenseData";
import GenericDomainModal from "@/components/common/GenericDomainModal";
import { EXPENSE_COLUMNS, EXPENSE_FIELDS } from "@/components/expense/config";

export default function ExpenseAllPage() {
  const { userId, nowYear, nowMonth, isLoading, error, refreshData, expenses } =
    useExpenseData();

  const [modalTarget, setModalTarget] = useState<Expense | null>(null);

  const closeModal = () => setModalTarget(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    await refreshData(userId);
  }, [userId, refreshData]);

  const { handleExpenseDelete, handleDownloadDocument } =
    useExpenseActions({ userId, refresh });

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
            data={expenses}
            columns={EXPENSE_COLUMNS}
            getItemKey={(exp) => exp.id}
            cacheKeyPrefix="expense_all"
            defaultSort={{ column: "date", direction: "asc" }}
            supportedViews={["all"]}
            getDateKey={(exp) => exp.date}
            itemNamePlural="expenses"
            metrics={[
              {
                label: "Total spent",
                value: (items) => items.reduce((sum, e) => sum + e.cost, 0),
                format: "currency-INR",
              },
            ]}
            onRowClick={(exp) => setModalTarget(exp)}
            onBulkDelete={async (ids, clearFn) => {
              for (const id of ids) await handleExpenseDelete(id, "cascade");
              clearFn();
            }}
            nowYear={nowYear ?? undefined}
            nowMonth={nowMonth ?? undefined}
          />
        )}
      </PageShell>

      {modalTarget && userId && (
        <GenericDomainModal
          mode="record"
          domain="expense"
          target={{
            type: "record",
            id: modalTarget.id,
            data: modalTarget as unknown as Record<string, unknown>,
          }}
          fields={EXPENSE_FIELDS}
          userId={userId}
          onClose={closeModal}
          onSaved={async () => {
            await refresh();
          }}
          onDeleted={async () => {
            await refresh();
          }}
          onDownloadDocument={handleDownloadDocument}
        />
      )}
    </>
  );
}
