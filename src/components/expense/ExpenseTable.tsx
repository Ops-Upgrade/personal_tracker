"use client";

import { useMemo } from "react";
import { useLocalStorage } from "@/lib/useLocalStorage";
import type { Expense } from "@/types/expense";

// --- Inline SVG Icon Component ---

function PaperClipIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-5.7-1.477-1.477" />
    </svg>
  );
}

// --- Types ---

type SortColumn = "item" | "seller" | "cost" | "date" | "reason";
type SortDirection = "asc" | "desc";

interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

interface SortableHeaderProps {
  label: string;
  column: SortColumn;
  sortState: SortState | null;
  onClick: (column: SortColumn) => void;
  className?: string;
}

function SortableHeader({
  label,
  column,
  sortState,
  onClick,
  className,
}: SortableHeaderProps) {
  const isActive = sortState?.column === column;

  return (
    <th
      className={`cursor-pointer select-none hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors ${className ?? ""}`}
      onClick={() => onClick(column)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="text-[9px] leading-none w-2 inline-block">
          {isActive
            ? sortState.direction === "asc"
              ? "▲"
              : "▼"
            : "↕"}
        </span>
      </span>
    </th>
  );
}

// --- Main Component ---

interface ExpenseTableProps {
  expenses: Expense[];
  onSelectExpense: (expense: Expense) => void;
}

/**
 * Reusable expense table — used in both the inline month preview and the full month modal.
 * Columns: Item, Seller, Cost, Date, Reason, Invoice.
 * Clicking a column header toggles between ascending, descending, and no-sort.
 */
export default function ExpenseTable({
  expenses,
  onSelectExpense,
}: ExpenseTableProps) {
  const [sortState, setSortState] = useLocalStorage<SortState | null>("expenseTableSortState", null);

  function handleSort(column: SortColumn) {
    setSortState((prev) => {
      if (prev?.column !== column) {
        return { column, direction: "asc" };
      }
      if (prev.direction === "asc") {
        return { column, direction: "desc" };
      }
      // Second click on same column with desc → clear sort
      return null;
    });
  }

  const sorted = useMemo(() => {
    if (!sortState) return expenses;
    const { column, direction } = sortState;
    const sorted = [...expenses].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (column) {
        case "item":
          aVal = a.item.toLowerCase();
          bVal = b.item.toLowerCase();
          break;
        case "seller":
          aVal = (a.seller ?? "").toLowerCase();
          bVal = (b.seller ?? "").toLowerCase();
          break;
        case "cost":
          aVal = a.cost;
          bVal = b.cost;
          break;
        case "date":
          aVal = new Date(a.date + "T00:00:00").getTime();
          bVal = new Date(b.date + "T00:00:00").getTime();
          break;
        case "reason":
          aVal = a.reason.toLowerCase();
          bVal = b.reason.toLowerCase();
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return direction === "asc" ? -1 : 1;
      if (aVal > bVal) return direction === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [expenses, sortState]);

  if (expenses.length === 0) {
    return (
      <div className="py-3 text-sm text-zinc-500 dark:text-zinc-400">
        No expenses recorded.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            <SortableHeader
              label="Item"
              column="item"
              sortState={sortState}
              onClick={handleSort}
              className="pb-2 pr-3 font-medium"
            />
            <SortableHeader
              label="Seller"
              column="seller"
              sortState={sortState}
              onClick={handleSort}
              className="pb-2 pr-3 font-medium"
            />
            <SortableHeader
              label="Cost"
              column="cost"
              sortState={sortState}
              onClick={handleSort}
              className="pb-2 pr-3 font-medium text-right"
            />
            <SortableHeader
              label="Date"
              column="date"
              sortState={sortState}
              onClick={handleSort}
              className="pb-2 pr-3 font-medium"
            />
            <SortableHeader
              label="Reason"
              column="reason"
              sortState={sortState}
              onClick={handleSort}
              className="pb-2 pr-3 font-medium"
            />
            <th className="pb-2 font-medium">Invoice</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((expense) => (
            <tr
              key={expense.id}
              onClick={() => onSelectExpense(expense)}
              className="cursor-pointer border-b border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60"
            >
              <td className="py-2 pr-3 font-medium text-zinc-800 dark:text-zinc-100">
                {trunc(expense.item, 24)}
              </td>
              <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-300">
                {trunc(expense.seller, 20)}
              </td>
              <td className="py-2 pr-3 text-right text-zinc-700 dark:text-zinc-200">
                ₹ {expense.cost.toLocaleString("en-IN")}
              </td>
              <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-300">
                {formatDate(expense.date)}
              </td>
              <td className="py-2 pr-3 text-zinc-500 dark:text-zinc-400">
                {trunc(expense.reason, 20)}
              </td>
              <td className="py-2 text-center">
                {(expense.invoice_file && expense.invoice_file !== "") ? (
                  <span className="inline-flex items-center text-emerald-500" title="Invoice attached">
                    <PaperClipIcon className="h-4 w-4" />
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

function trunc(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}