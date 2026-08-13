import type { Task } from "@/types/taskmanager";
import type { ColumnDef } from "@/components/common/GenericViewPage";
import PriorityBadge from "@/components/common/PriorityBadge";
import { trunc } from "@/lib/viewHelpers";

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

// ── Date formatting ──

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear().toString().slice(-2)}`;
}

// ── Column definitions for the "all" view ──

export const TASK_COLUMNS: ColumnDef<Task, SortColumn>[] = [
  {
    key: "name",
    header: "Task Name",
    colSpan: 2,
    sortColumn: "name",
    mobileBehavior: "truncate",
    render: (t) => (
      <span className="font-medium text-zinc-800 dark:text-zinc-100">
        {trunc(t.name, 24) || "—"}
      </span>
    ),
  },
  {
    key: "priority",
    header: "Priority",
    colSpan: 1,
    sortColumn: "priority",
    mobileBehavior: "fixed",
    align: "center",
    render: (t) => <PriorityBadge priority={t.priority} />,
  },
  {
    key: "due_date",
    header: "Due Date",
    colSpan: 3,
    sortColumn: "due_date",
    mobileBehavior: "fixed",
    render: (t) => (
      <span className="text-zinc-600 dark:text-zinc-300">
        {formatDate(t.due_date)}
      </span>
    ),
  },
  {
    key: "mode",
    header: "Mode",
    colSpan: 2,
    sortColumn: "mode",
    mobileBehavior: "truncate",
    render: (t) => (
      <span className="text-zinc-600 dark:text-zinc-300">{t.mode}</span>
    ),
  },
  {
    key: "description",
    header: "Description",
    colSpan: 2,
    sortColumn: "description",
    mobileBehavior: "truncate",
    render: (t) => (
      <span className="text-zinc-500 dark:text-zinc-400">
        {trunc(t.description, 28) || "—"}
      </span>
    ),
  },
  {
    key: "is_completed",
    header: "Status",
    colSpan: 2,
    sortColumn: "is_completed",
    mobileBehavior: "truncate",
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
