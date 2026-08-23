import type { Task } from "@/types/taskmanager";
import type { ColumnDef } from "@/components/common/GenericViewPage";
import type { FieldDef } from "@/components/common/GenericDomainModal";
import { colPriority, colDate, colRichtext } from "@/components/common/columns";

// ── Sort column type ──

export type SortColumn = "name" | "priority" | "due_date" | "mode" | "description" | "is_completed";

// ── Form schema for all task modals ──

export const TASK_FIELDS: FieldDef[] = [
  { key: "name", type: "text", label: "Task Name" },
  {
    key: "priority",
    type: "select",
    label: "Priority",
    defaultValue: "medium",
    options: [
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
      { value: "critical", label: "Critical" },
    ],
  },
  { key: "due_date", type: "date", label: "Due Date" },
  {
    key: "mode",
    type: "select",
    label: "Mode",
    defaultValue: "online",
    options: [
      { value: "online", label: "Online" },
      { value: "offline", label: "Offline" },
    ],
  },
  {
    key: "description",
    type: "richtext",
    label: "Task Description",
    minHeight: "8rem",
  },
  { key: "is_completed", type: "checkbox", label: "Mark complete", defaultValue: false },
];

// Every field must appear in the layout (GenericDomainModal only renders listed rows).
export const TASK_LAYOUT: string[][] = [
  ["name"],
  ["priority", "due_date", "mode"],
  ["description"],
  ["is_completed"],
];

// ── Form schema for the note store modal (store pages) ──

export const NOTE_FIELDS: FieldDef[] = [
  { key: "name", type: "text", label: "Name", placeholder: "Note title" },
  { key: "content", type: "richtext", label: "Content", minHeight: "10rem" },
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
// and truncate gracefully via CSS — no breakpoint math anywhere. Cells are
// declarative tokens; the GenericDataGrid engine renders them internally.
export const TASK_COLUMNS: ColumnDef<Task, SortColumn>[] = [
  {
    key: "name",
    header: "Task Name",
    sizing: "flex",
    weight: 2,
    sortColumn: "name",
    token: { type: "text", accessor: (t) => t.name, color: "strong" },
  },
  TASK_PRIORITY,
  TASK_DUE_DATE,
  {
    key: "mode",
    header: "Mode",
    sizing: "fixed",
    sortColumn: "mode",
    token: { type: "text", accessor: (t) => t.mode, color: "muted" },
  },
  TASK_DESCRIPTION,
  {
    key: "is_completed",
    header: "Status",
    sizing: "fixed",
    sortColumn: "is_completed",
    token: {
      type: "boolean",
      accessor: (t) => t.is_completed,
      trueLabel: "Completed",
      trueColorClass: "text-emerald-600 dark:text-emerald-400",
      falseLabel: "Active",
      falseColorClass: "text-amber-600 dark:text-amber-400",
    },
  },
];
