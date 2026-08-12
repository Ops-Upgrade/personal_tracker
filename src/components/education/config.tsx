import type { Education } from "@/types/education";
import type { ColumnDef } from "@/components/common/GenericViewPage";
import type { FieldDef } from "@/components/common/GenericDomainModal";
import PriorityBadge from "@/components/common/PriorityBadge";
import { PaperClipIcon } from "@/components/common/Icons";
import { PRIORITIES } from "@/types/common";
import { trunc } from "@/lib/viewHelpers";

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

// ── Date formatting ──

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear().toString().slice(-2)}`;
}

// ── Column definitions for the "all" view ──

export const EDUCATION_COLUMNS: ColumnDef<Education, SortColumn>[] = [
  {
    key: "name",
    header: "Program Name",
    colSpan: 2,
    sortColumn: "name",
    mobileBehavior: "truncate",
    render: (e) => (
      <span className="font-medium text-zinc-800 dark:text-zinc-100">
        {trunc(e.name, 24) || "—"}
      </span>
    ),
  },
  {
    key: "provider",
    header: "Provider",
    colSpan: 2,
    sortColumn: "provider",
    mobileBehavior: "truncate",
    render: (e) => (
      <span className="text-zinc-600 dark:text-zinc-300">
        {trunc(e.provider, 20) || "—"}
      </span>
    ),
  },
  {
    key: "priority",
    header: "Priority",
    colSpan: 2,
    sortColumn: "priority",
    mobileBehavior: "fixed",
    align: "center",
    render: (e) => <PriorityBadge priority={e.priority} />,
  },
  {
    key: "due_date",
    header: "Due Date",
    colSpan: 3,
    sortColumn: "due_date",
    mobileBehavior: "fixed",
    render: (e) => (
      <span className="text-zinc-600 dark:text-zinc-300">
        {formatDate(e.due_date)}
      </span>
    ),
  },
  {
    key: "description",
    header: "Description",
    colSpan: 1,
    mobileBehavior: "truncate",
    render: (e) => (
      <span className="text-zinc-500 dark:text-zinc-400">
        {trunc(e.description, 24) || "—"}
      </span>
    ),
  },
  {
    key: "files",
    header: "Files",
    colSpan: 2,
    mobileBehavior: "fixed",
    render: (e) => {
      const count = e.document_ids?.length ?? 0;
      return count > 0 ? (
        <span
          className="inline-flex items-center justify-center gap-1 text-amber-500"
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
