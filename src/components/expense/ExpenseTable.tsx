"use client";

import { trunc, stripHtml } from "@/lib/viewHelpers";
import SortableHeader from "@/components/common/SortableHeader";
import { PaperClipIcon } from "@/components/common/Icons";
import { useTableSort, type SortConfig } from "@/hooks/useTableSort";
import type { Expense } from "@/types/expense";

// --- Column type ---

type SortColumn = "item" | "seller" | "cost" | "date" | "reason";

// --- Sort configs ---

const SORT_CONFIGS: SortConfig<SortColumn, Expense>[] = [
  { column: "item", extractor: (exp) => exp.item.toLowerCase() },
  { column: "seller", extractor: (exp) => (exp.seller ?? "").toLowerCase() },
  { column: "cost", extractor: (exp) => exp.cost },
  { column: "date", extractor: (exp) => new Date(exp.date + "T00:00:00").getTime() },
  { column: "reason", extractor: (exp) => stripHtml(exp.reason).toLowerCase() },
];

// --- Main Component ---

interface ExpenseTableProps {
  expenses: Expense[];
  onSelectExpense: (expense: Expense) => void;
  /** When true, column headers are rendered as plain text (no sort controls). */
  disableSorting?: boolean;
}

/**
 * Reusable expense table — used in both the inline month preview and the full month modal.
 * Columns: Item, Seller, Cost, Date, Reason, Invoice.
 * Clicking a column header toggles between ascending, descending, and no-sort.
 */
export default function ExpenseTable({
  expenses,
  onSelectExpense,
  disableSorting = false,
}: ExpenseTableProps) {
  const { sortState, handleSort, sorted } = useTableSort(
    "expenseTableSortState",
    expenses,
    SORT_CONFIGS,
    disableSorting,
  );

  if (expenses.length === 0) {
    return (
      <div className="py-3 text-sm text-zinc-500 dark:text-zinc-400">
        No expenses recorded.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            {disableSorting ? (
              <>
                <th className="pb-2 pr-3 font-medium">Item</th>
                <th className="pb-2 pr-3 font-medium">Seller</th>
                <th className="pb-2 pr-3 font-medium text-right">Cost</th>
                <th className="pb-2 pr-3 font-medium">Date</th>
                <th className="pb-2 pr-3 font-medium">Reason</th>
                <th className="pb-2 font-medium text-center">Files</th>
              </>
            ) : (
              <>
                <SortableHeader
                  as="th"
                  column="item"
                  label="Item"
                  sortState={sortState}
                  onSort={handleSort}
                  className="pb-2 pr-3 font-medium"
                />
                <SortableHeader
                  as="th"
                  column="seller"
                  label="Seller"
                  sortState={sortState}
                  onSort={handleSort}
                  className="pb-2 pr-3 font-medium"
                />
                <SortableHeader
                  as="th"
                  column="cost"
                  label="Cost"
                  sortState={sortState}
                  onSort={handleSort}
                  className="pb-2 pr-3 font-medium text-right"
                />
                <SortableHeader
                  as="th"
                  column="date"
                  label="Date"
                  sortState={sortState}
                  onSort={handleSort}
                  className="pb-2 pr-3 font-medium"
                />
                <SortableHeader
                  as="th"
                  column="reason"
                  label="Reason"
                  sortState={sortState}
                  onSort={handleSort}
                  className="pb-2 pr-3 font-medium"
                />
                <th className="pb-2 font-medium text-center">Files</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {sorted.map((expense) => (
            <tr
              key={expense.id}
              onClick={() => onSelectExpense(expense)}
              className="cursor-pointer border-b border-zinc-200 dark:border-zinc-700 last:border-b-0 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
            >
              <td className="py-2 pr-3 font-medium text-zinc-800 dark:text-zinc-100">
                {trunc(expense.item, 24) || "—"}
              </td>
              <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-300">
                {trunc(expense.seller, 20) || "—"}
              </td>
              <td className="py-2 pr-3 text-right text-zinc-700 dark:text-zinc-200">
                ₹ {expense.cost.toLocaleString("en-IN")}
              </td>
              <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-300">
                {formatDate(expense.date)}
              </td>
              <td className="py-2 pr-3 text-zinc-500 dark:text-zinc-400">
                {trunc(expense.reason, 20) || "—"}
              </td>
              <td className="py-2 text-center">
                {(expense.document_ids && expense.document_ids.length > 0) ? (
                  <span className="inline-flex items-center justify-center gap-1 text-emerald-500" title={`${expense.document_ids.length} document(s) attached`}>
                    <PaperClipIcon className="h-4 w-4" />
                    <span className="text-zinc-600 dark:text-zinc-300">({expense.document_ids.length})</span>
                  </span>
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}
