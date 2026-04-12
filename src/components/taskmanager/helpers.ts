import { PRIORITIES, type Note, type Priority, type Task } from "@/types/taskmanager";

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "long" });
const MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

export function sortByDueDateAsc(a: Task, b: Task): number {
  if (!a.due_date && !b.due_date) return 0;
  if (!a.due_date) return 1;
  if (!b.due_date) return -1;
  return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
}

export function sortByCompletedDesc(a: Task, b: Task): number {
  const aTs = a.completed_at ? new Date(a.completed_at).getTime() : 0;
  const bTs = b.completed_at ? new Date(b.completed_at).getTime() : 0;
  return bTs - aTs;
}

export function sortByCreatedAtDesc<T extends { created_at: string }>(
  a: T,
  b: T
): number {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export function byPriority(tasks: Task[]): Record<Priority, Task[]> {
  return PRIORITIES.reduce(
    (acc, priority) => {
      acc[priority] = tasks
        .filter((task) => task.priority === priority)
        .sort(sortByDueDateAsc);
      return acc;
    },
    {
      critical: [],
      high: [],
      medium: [],
      low: [],
    } as Record<Priority, Task[]>
  );
}

export function activeByMonths(tasks: Task[]): Array<{ label: string; tasks: Task[] }> {
  const nowYear = new Date().getFullYear();
  const monthMap = new Map<string, Task[]>();

  for (const task of tasks) {
    if (!task.due_date) {
      const unscheduled = monthMap.get("Unscheduled") ?? [];
      unscheduled.push(task);
      monthMap.set("Unscheduled", unscheduled);
      continue;
    }

    const due = new Date(task.due_date);
    const year = due.getFullYear();
    const label = year > nowYear ? "Next Year" : MONTH_FORMATTER.format(due);
    const bucket = monthMap.get(label) ?? [];
    bucket.push(task);
    monthMap.set(label, bucket);
  }

  const orderedMonths = [
    "Unscheduled",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
    "Next Year",
  ];

  return orderedMonths.map((label) => ({
    label,
    tasks: (monthMap.get(label) ?? []).sort(sortByDueDateAsc),
  }));
}

export function completedByMonths(
  tasks: Task[]
): Array<{ label: string; tasks: Task[]; sortKey: number }> {
  const nowYear = new Date().getFullYear();
  const monthMap = new Map<string, { tasks: Task[]; sortKey: number }>();

  for (const task of tasks) {
    if (!task.completed_at) continue;
    const completed = new Date(task.completed_at);
    const label =
      completed.getFullYear() > nowYear
        ? "Next Year"
        : MONTH_YEAR_FORMATTER.format(completed);
    const existing = monthMap.get(label);
    const taskTs = completed.getTime();

    if (!existing) {
      monthMap.set(label, { tasks: [task], sortKey: taskTs });
      continue;
    }

    existing.tasks.push(task);
    existing.sortKey = Math.max(existing.sortKey, taskTs);
    monthMap.set(label, existing);
  }

  return Array.from(monthMap.entries())
    .map(([label, value]) => ({
      label,
      tasks: value.tasks.sort(sortByCompletedDesc),
      sortKey: value.sortKey,
    }))
    .sort((a, b) => b.sortKey - a.sortKey);
}

export function trunc(text: string, max = 70): string {
  return text.length <= max ? text : `${text.slice(0, max)}...`;
}

export function sortedNotes(notes: Note[]): Note[] {
  return [...notes].sort(sortByCreatedAtDesc);
}

export function formatShortDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}
