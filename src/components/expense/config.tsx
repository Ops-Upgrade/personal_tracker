import type { Expense } from "@/types/expense";
import type { ColumnDef } from "@/components/common/GenericViewPage";
import type { FieldDef } from "@/components/common/GenericDomainModal";
import { PaperClipIcon } from "@/components/common/Icons";
import { trunc } from "@/lib/viewHelpers";

// ── Modal form fields ──

export const EXPENSE_FIELDS: FieldDef[] = [
  { key: "item", type: "text", label: "Item" },
  { key: "seller", type: "text", label: "Seller / Merchant" },
  { key: "cost", type: "number", label: "Cost", min: 0, step: "any" },
  { key: "date", type: "date", label: "Date" },
  { key: "reason", type: "richtext", label: "Reason", minHeight: "8rem" },
];

// ── Sort column type ──

export type SortColumn = "item" | "seller" | "cost" | "date" | "reason";

// ── Sort configs ──

export const SORT_CONFIGS = [
  { column: "item" as const, extractor: (exp: Expense) => exp.item.toLowerCase() },
  { column: "seller" as const, extractor: (exp: Expense) => (exp.seller ?? "").toLowerCase() },
  { column: "cost" as const, extractor: (exp: Expense) => exp.cost },
  { column: "date" as const, extractor: (exp: Expense) => new Date(exp.date + "T00:00:00").getTime() },
  { column: "reason" as const, extractor: (exp: Expense) => exp.reason.replace(/<[^>]*>/g, "").trim().toLowerCase() },
];

// ── Date formatting ──

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear().toString().slice(-2)}`;
}

// ── Column definitions for the "all" view ──

export const EXPENSE_COLUMNS: ColumnDef<Expense, SortColumn>[] = [
  {
    key: "item",
    header: "Item",
    colSpan: 2,
    sortColumn: "item",
    mobileBehavior: "truncate",
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
    mobileBehavior: "truncate",
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
    mobileBehavior: "fixed",
    align: "right",
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
    mobileBehavior: "fixed",
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
    mobileBehavior: "truncate",
    render: (exp) => (
      <span className="text-zinc-500 dark:text-zinc-400">
        {trunc(exp.reason, 20) || "—"}
      </span>
    ),
  },
  {
    key: "files",
    header: "Files",
    colSpan: 2,
    mobileBehavior: "fixed",
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
];
