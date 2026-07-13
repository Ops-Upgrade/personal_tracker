// ---- Generic types ----

/** Minimum shape for sorting by created_at */
interface HasCreatedAt {
  created_at: string;
}

/** Minimum shape for sorting by completed_at */
interface HasCompletedAt {
  completed_at: string | null;
}

/** Minimum shape for due-date sorting and month grouping */
interface HasDueDate {
  due_date: string | null;
}

/** Minimum shape for priority grouping */
interface HasPriority {
  priority: string;
}

// ---- Sorting utilities ----

export function sortByCompletedDesc<T extends HasCompletedAt>(a: T, b: T): number {
  const aTs = a.completed_at ? new Date(a.completed_at).getTime() : 0;
  const bTs = b.completed_at ? new Date(b.completed_at).getTime() : 0;
  return bTs - aTs;
}

export function sortByCreatedAtDesc<T extends HasCreatedAt>(a: T, b: T): number {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export function sortByDueDateAsc<T extends HasDueDate>(a: T, b: T): number {
  if (!a.due_date && !b.due_date) return 0;
  if (!a.due_date) return 1;
  if (!b.due_date) return -1;
  return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
}

// ---- Priority grouping ----

export function byPriority<T extends HasPriority>(
  items: T[],
  priorities: readonly string[]
): Record<string, T[]> {
  const acc: Record<string, T[]> = {};
  for (const p of priorities) {
    acc[p] = [];
  }
  for (const item of items) {
    const bucket = acc[item.priority];
    if (bucket) {
      bucket.push(item);
    }
  }
  for (const p of priorities) {
    acc[p].sort((a, b) =>
      sortByDueDateAsc(
        a as unknown as HasDueDate,
        b as unknown as HasDueDate,
      ),
    );
  }
  return acc;
}

// ---- Month grouping (active) ----

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "long" });

const ORDERED_MONTHS = [
  "Unscheduled",
  "Past Years",
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
  "Future Years",
];

export function activeByMonths<T extends HasDueDate>(
  items: T[],
  nowYear: number
): Array<{ label: string; items: T[] }> {
  const monthMap = new Map<string, T[]>();

  for (const item of items) {
    if (!item.due_date) {
      const unscheduled = monthMap.get("Unscheduled") ?? [];
      unscheduled.push(item);
      monthMap.set("Unscheduled", unscheduled);
      continue;
    }

    const due = new Date(item.due_date);
    const year = due.getFullYear();

    let label: string;
    if (year < nowYear) {
      label = "Past Years";
    } else if (year > nowYear) {
      label = "Future Years";
    } else {
      label = MONTH_FORMATTER.format(due);
    }

    const bucket = monthMap.get(label) ?? [];
    bucket.push(item);
    monthMap.set(label, bucket);
  }

  return ORDERED_MONTHS.map((label) => ({
    label,
    items: (monthMap.get(label) ?? []).sort(sortByDueDateAsc),
  }));
}

// ---- Month grouping (completed) ----

const MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

export function completedByMonths<T extends HasCompletedAt>(
  items: T[],
  nowYear: number
): Array<{ label: string; items: T[]; sortKey: number }> {
  const monthMap = new Map<string, { items: T[]; sortKey: number }>();

  for (const item of items) {
    if (!item.completed_at) continue;
    const completed = new Date(item.completed_at);
    const completedYear = completed.getFullYear();

    let label: string;
    if (completedYear < nowYear) {
      label = "Past Years";
    } else if (completedYear > nowYear) {
      label = "Future Years";
    } else {
      label = MONTH_YEAR_FORMATTER.format(completed);
    }

    const existing = monthMap.get(label);
    const itemTs = completed.getTime();

    if (!existing) {
      monthMap.set(label, { items: [item], sortKey: itemTs });
      continue;
    }

    existing.items.push(item);
    existing.sortKey = Math.max(existing.sortKey, itemTs);
    monthMap.set(label, existing);
  }

  return Array.from(monthMap.entries())
    .map(([label, value]) => ({
      label,
      items: value.items.sort(sortByCompletedDesc),
      sortKey: value.sortKey,
    }))
    .sort((a, b) => b.sortKey - a.sortKey);
}

// ---- Text helpers ----

export function trunc(text: string | null | undefined, max = 70): string {
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max)}...`;
}

/**
 * Returns a unique file name by appending (1), (2), ... if the desired name
 * already exists in the provided set of taken names.
 */
export function getUniqueFileName(desiredName: string, takenNames: Set<string>): string {
  if (!takenNames.has(desiredName)) return desiredName;
  let counter = 1;
  let candidate = `${desiredName} (${counter})`;
  while (takenNames.has(candidate)) {
    counter++;
    candidate = `${desiredName} (${counter})`;
  }
  return candidate;
}