import type { Education } from "@/types/education";
import type { ColumnDef } from "@/components/common/GenericViewPage";
import type { FieldDef } from "@/components/common/GenericDomainModal";
import PriorityBadge from "@/components/common/PriorityBadge";
import { PRIORITIES } from "@/types/common";
import { colPriority, colDate, colRichtext, colFiles } from "@/components/common/columns";

// ── Form schema for all education modals ──

export const EDUCATION_FIELDS: FieldDef[] = [
  { key: "name", type: "text", label: "Course / Certification Name" },
  { key: "provider", type: "text", label: "Provider", placeholder: "Institution or platform" },
  {
    key: "priority",
    type: "select",
    label: "Priority",
    options: PRIORITIES.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) })),
  },
  { key: "due_date", type: "date", label: "Due Date" },
  { key: "description", type: "richtext", label: "Description", minHeight: "8rem" },
  { key: "is_completed", type: "checkbox", label: "Mark as complete (acquired)" },
];

export const EDUCATION_LAYOUT: string[][] = [
  ["name"],
  ["provider"],
  ["priority", "due_date"],
  ["description"],
  ["is_completed"],
];

// ── Sort column type ──

export type SortColumn = "name" | "provider" | "priority" | "due_date";

// ── Sort configs ──

export const SORT_CONFIGS = [
  { column: "name" as const, extractor: (e: Education) => e.name.toLowerCase() },
  { column: "provider" as const, extractor: (e: Education) => e.provider.toLowerCase() },
  { column: "priority" as const, extractor: (e: Education) => e.priority },
  { column: "due_date" as const, extractor: (e: Education) => (e.due_date ? new Date(e.due_date + "T00:00:00").getTime() : 0) },
];

// ── Shared column atoms ──

export const EDU_PRIORITY: ColumnDef<Education, SortColumn> = colPriority<Education, SortColumn>(
  {
    // Legacy rows may lack a priority — fall back to a dash.
    render: (e) =>
      e.priority ? (
        <PriorityBadge priority={e.priority} />
      ) : (
        <span className="text-zinc-400">—</span>
      ),
    sortColumn: "priority",
  },
);

export const EDU_DUE_DATE: ColumnDef<Education, SortColumn> = colDate<Education, SortColumn>(
  { key: "due_date", header: "Due Date", accessor: (e) => e.due_date },
  { sortColumn: "due_date" },
);

export const EDU_DESCRIPTION: ColumnDef<Education, SortColumn> = colRichtext<Education, SortColumn>(
  { key: "description", header: "Description", accessor: (e) => e.description, weight: 1 },
);

export const EDU_FILES: ColumnDef<Education, SortColumn> = colFiles<Education, SortColumn>({
  getCount: (e) => e.document_ids?.length ?? 0,
  iconColorClass: "text-amber-500",
});

// ── Column definitions for the "all" view ──

// Sizing model: "fixed" columns get max-content tracks (badges, dates, files
// always fit their content); "flex" columns share the remaining space and
// truncate gracefully via CSS — no breakpoint math anywhere.
export const EDUCATION_COLUMNS: ColumnDef<Education, SortColumn>[] = [
  {
    key: "name",
    header: "Program Name",
    sizing: "flex",
    weight: 2,
    sortColumn: "name",
    render: (e) => (
      <span className="font-medium text-zinc-800 dark:text-zinc-100">
        {e.name || "—"}
      </span>
    ),
  },
  {
    key: "provider",
    header: "Provider",
    sizing: "flex",
    weight: 1,
    sortColumn: "provider",
    render: (e) => (
      <span className="text-zinc-600 dark:text-zinc-300">
        {e.provider || "—"}
      </span>
    ),
  },
  EDU_PRIORITY,
  EDU_DUE_DATE,
  EDU_DESCRIPTION,
  EDU_FILES,
];
