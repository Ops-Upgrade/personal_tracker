import type { Task } from "@/types/taskmanager";
import type { ColumnDef } from "@/components/common/GenericViewPage";
import { colPriority, colDate, colRichtext } from "@/components/common/columns";

// ── Sort column type ──

export type SortColumn = "name" | "priority" | "due_date" | "mode" | "description" | "is_completed";

// ── Priority comparison ──

export function comparePriority(a: string, b: string): number {
  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return (order[a] ?? 99) - (order[b] ?? 99);
}

// ── Sort configs ──

export const SORT_CONFIGS = [
  { column: "name" as const, extractor: (t: Task) => t.name.toLowerCase() },
  { column: "priority" as const, extractor: (t: Task) => t.priority },
  { column: "due_date" as const, extractor: (t: Task) => (t.due_date ? new Date(t.due_date + "T00:00:00").getTime() : 0) },
  { column: "mode" as const, extractor: (t: Task) => t.mode.toLowerCase() },
  { column: "description" as const, extractor: (t: Task) => t.description.replace(/<[^>]*>/g, "").trim().toLowerCase() },
  { column: "is_completed" as const, extractor: (t: Task) => (t.is_completed ? 1 : 0) },
];

// ── Shared column atoms ──

export const TASK_PRIORITY: ColumnDef<Task, SortColumn> = colPriority<Task, SortColumn>({
  sortColumn: "priority",
});

export const TASK_DUE_DATE: ColumnDef<Task, SortColumn> = colDate<Task, SortColumn>(
  { key: "due_date", header: "Due Date", accessor: (t) => t.due_date },
  { sortColumn: "due_date" },
);

export const TASK_DESCRIPTION: ColumnDef<Task, SortColumn> = colRichtext<Task, SortColumn>(
  { key: "description", header: "Description", accessor: (t) => t.description, weight: 1 },
  { sortColumn: "description" },
);

// ── Column definitions for the "all" view ──

// Sizing model: "fixed" columns get max-content tracks (badges, dates, mode,
// status always fit their content); "flex" columns share the remaining space
// and truncate gracefully via CSS — no breakpoint math anywhere.
export const TASK_COLUMNS: ColumnDef<Task, SortColumn>[] = [
  {
    key: "name",
    header: "Task Name",
    sizing: "flex",
    weight: 2,
    sortColumn: "name",
    render: (t) => (
      <span className="font-medium text-zinc-800 dark:text-zinc-100">
        {t.name || "—"}
      </span>
    ),
  },
  TASK_PRIORITY,
  TASK_DUE_DATE,
  {
    key: "mode",
    header: "Mode",
    sizing: "fixed",
    sortColumn: "mode",
    render: (t) => (
      <span className="text-zinc-600 dark:text-zinc-300">{t.mode}</span>
    ),
  },
  TASK_DESCRIPTION,
  {
    key: "is_completed",
    header: "Status",
    sizing: "fixed",
    sortColumn: "is_completed",
    render: (t) => (
      <span
        className={`text-[10px] sm:text-xs ${
          t.is_completed
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-amber-600 dark:text-amber-400"
        }`}
      >
        {t.is_completed ? "Completed" : "Active"}
      </span>
    ),
  },
];
