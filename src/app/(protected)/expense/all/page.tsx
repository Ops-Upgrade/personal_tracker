"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
import {
  createExpense,
  deleteExpense,
  fetchExpenses,
  updateExpense,
} from "@/api/expense";
import {
  fetchDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
} from "@/api/common/documents";
import {
  uploadDocumentFile,
  deleteDocumentFile,
} from "@/api/common/documentStorage";
import { ROUTES } from "@/routes/paths";
import type { Expense, ExpensePlaintext, ExpenseViewMode } from "@/types/expense";
import type { Document, DocumentPlaintext } from "@/types/document";
import { MONTHS } from "@/types/expense";
import { useLocalStorage } from "@/lib/useLocalStorage";
import ViewToggle from "@/components/common/ViewToggle";
import type { ViewToggleOption } from "@/components/common/ViewToggle";
import { RectangleVertical, Columns2 } from "lucide-react";
import MonthTile from "@/components/common/MonthTile";
import BoxContainer, { SCROLLABLE_CLASSES } from "@/components/common/BoxContainer";
import PageShell from "@/components/common/PageShell";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import YearDropdown from "@/components/common/YearDropdown";
import ExpenseModal from "@/components/expense/ExpenseModal";
import ExpenseTable from "@/components/expense/ExpenseTable";

const EXPENSE_VIEW_OPTIONS: readonly ViewToggleOption<ExpenseViewMode>[] = [
  { value: "single", label: <RectangleVertical className="h-4 w-4" /> },
  { value: "multi", label: <Columns2 className="h-4 w-4" /> },
];

function AllExpensesContent() {
  const searchParams = useSearchParams();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  // Read optional month/year filters from query params
  const filterMonth = searchParams.get("month");
  const filterYear = searchParams.get("year");
  const monthIndex = filterMonth !== null ? parseInt(filterMonth, 10) : null;
  const yearFilter = filterYear !== null ? parseInt(filterYear, 10) : null;
  const isFiltered = monthIndex !== null && !isNaN(monthIndex) && yearFilter !== null && !isNaN(yearFilter);

  const loadData = useCallback(async (uid: string) => {
    const [expRows, docRows] = await Promise.all([
      fetchExpenses(uid),
      fetchDocuments(uid),
    ]);
    setExpenses(expRows);
    setDocuments(docRows);
  }, []);

  const { userId, isLoading, error, refreshData } =
    useAuthBootstrap({ loadData });

  const [viewMode, setViewMode] = useLocalStorage<ExpenseViewMode>("expenseViewMode", "single");
  const [selectedYear, setSelectedYear] = useState(yearFilter ?? new Date().getFullYear());
  const [expenseModalTarget, setExpenseModalTarget] = useState<Expense | null>(null);

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
    fileAction?: { newFiles: File[]; removeDocIds: string[]; linkDocId?: string },
  ) {
    if (!userId) throw new Error("No active session.");

    const nowIso = new Date().toISOString();
    let document_ids = [...(existingExpense?.document_ids ?? [])];

    if (fileAction?.removeDocIds) {
      for (const docId of fileAction.removeDocIds) {
        const doc = documents.find((d) => d.id === docId);
        if (doc) {
          if (doc.file_name) {
            try { await deleteDocumentFile(userId, doc.file_name); } catch { /* best-effort */ }
          }
          try { await deleteDocument(docId); } catch { /* best-effort */ }
        }
        document_ids = document_ids.filter((id) => id !== docId);
      }
    }

    if (fileAction?.newFiles) {
      for (const file of fileAction.newFiles) {
        const { fileName, iv, mimeType } = await uploadDocumentFile(userId, file);
        const doc = await createDocument(userId, {
          label: file.name,
          file_name: fileName,
          file_iv: iv,
          file_mime: mimeType,
          domain: "expense",
          linked_id: existingExpense?.id ?? "",
          updated_at: nowIso,
        });
        document_ids.push(doc.id);
      }
    }

    if (fileAction?.linkDocId) {
      const linkDoc = documents.find((d) => d.id === fileAction.linkDocId);
      if (linkDoc && !document_ids.includes(fileAction.linkDocId)) {
        document_ids.push(fileAction.linkDocId);
        await updateDocument(userId, fileAction.linkDocId, {
          ...linkDoc,
          linked_id: existingExpense?.id ?? "",
          updated_at: nowIso,
        } as DocumentPlaintext);
      }
    }

    const payload: ExpensePlaintext = {
      item: draft.item, seller: draft.seller, cost: draft.cost,
      date: draft.date, reason: draft.reason, invoice: draft.invoice,
      document_ids, updated_at: nowIso,
    };

    let savedExpense: Expense;
    if (existingExpense) {
      savedExpense = await updateExpense(userId, existingExpense.id, payload);
    } else {
      savedExpense = await createExpense(userId, payload);
    }

    if (!existingExpense && fileAction?.newFiles && fileAction.newFiles.length > 0) {
      const freshDocs = await fetchDocuments(userId);
      for (const doc of freshDocs) {
        if (doc.domain === "expense" && doc.linked_id === "" && document_ids.includes(doc.id)) {
          await updateDocument(userId, doc.id, {
            ...doc, linked_id: savedExpense.id, updated_at: new Date().toISOString(),
          } as DocumentPlaintext);
        }
      }
    }
    if (!existingExpense && fileAction?.linkDocId) {
      const linkDoc = documents.find((d) => d.id === fileAction.linkDocId);
      if (linkDoc && linkDoc.linked_id === "") {
        await updateDocument(userId, fileAction.linkDocId, {
          ...linkDoc, linked_id: savedExpense.id, updated_at: new Date().toISOString(),
        } as DocumentPlaintext);
      }
    }

    await refreshData(userId);
  }

  async function handleExpenseDelete(expenseId: string) {
    if (!userId) throw new Error("No active session.");

    const expense = expenses.find((e) => e.id === expenseId);
    if (expense?.document_ids) {
      for (const docId of expense.document_ids) {
        const doc = documents.find((d) => d.id === docId);
        if (doc) {
          if (doc.file_name) {
            try { await deleteDocumentFile(userId, doc.file_name); } catch { /* best-effort */ }
          }
          try { await deleteDocument(docId); } catch { /* best-effort */ }
        }
      }
    }

    await deleteExpense(expenseId);
    await refreshData(userId);
  }

  return (
    <>
      <PageShell
        backHref={ROUTES.EXPENSE}
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
          attachedDocuments={documents.filter((d) => expenseModalTarget.document_ids?.includes(d.id))}
          standaloneDocuments={documents.filter((d) => d.domain === "expense" && !d.linked_id)}
          userId={userId ?? ""}
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
