import type { Expense } from "@/types/expense";
import type { ColumnDef } from "@/components/common/GenericViewPage";
import type { FieldDef } from "@/components/common/GenericDomainModal";
import { colDate, colRichtext, colFiles } from "@/components/common/columns";

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

// ── Shared column atoms ──

export const EXPENSE_DATE: ColumnDef<Expense, SortColumn> = colDate<Expense, SortColumn>(
  { key: "date", header: "Date", accessor: (exp) => exp.date },
  { sortColumn: "date" },
);

export const EXPENSE_REASON: ColumnDef<Expense, SortColumn> = colRichtext<Expense, SortColumn>(
  { key: "reason", header: "Reason", accessor: (exp) => exp.reason, weight: 1 },
  { sortColumn: "reason" },
);

export const EXPENSE_FILES: ColumnDef<Expense, SortColumn> = colFiles<Expense, SortColumn>({
  getCount: (exp) => exp.document_ids?.length ?? 0,
  iconColorClass: "text-emerald-500",
});

// ── Column definitions for the "all" view ──

// Sizing model: "fixed" columns get max-content tracks (cost, dates, files
// always fit their content); "flex" columns share the remaining space and
// truncate gracefully via CSS — no breakpoint math anywhere. Cells are
// declarative tokens; the GenericDataGrid engine renders them internally.
export const EXPENSE_COLUMNS: ColumnDef<Expense, SortColumn>[] = [
  {
    key: "item",
    header: "Item",
    sizing: "flex",
    weight: 2,
    sortColumn: "item",
    token: { type: "text", accessor: (exp) => exp.item, color: "strong" },
  },
  {
    key: "seller",
    header: "Seller",
    sizing: "flex",
    weight: 1,
    sortColumn: "seller",
    token: { type: "text", accessor: (exp) => exp.seller, color: "muted" },
  },
  {
    key: "cost",
    header: "Cost",
    sizing: "fixed",
    sortColumn: "cost",
    // Locale grouping renders "₹ 1,23,456" (en-IN) via the token engine.
    token: {
      type: "text",
      accessor: (exp) => exp.cost,
      prefix: "₹ ",
      localeFormat: "en-IN",
      color: "plain",
    },
  },
  EXPENSE_DATE,
  EXPENSE_REASON,
  EXPENSE_FILES,
];
