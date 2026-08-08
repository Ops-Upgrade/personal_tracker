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

/** Minimum shape for date-based month grouping */
interface HasDate {
  date: string;
}

/** Minimum shape for media status grouping */
interface HasStatus {
  status: string;
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

/** Strip HTML tags from a string, returning clean plain text. */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function trunc(text: string | null | undefined, max = 70): string {
  if (!text) return "";
  const clean = stripHtml(text);
  return clean.length <= max ? clean : `${clean.slice(0, max)}...`;
}

// ---- Media status grouping ----

const STATUS_ORDER: Record<string, number> = {
  watching: 0,
  unwatched: 1,
  watched: 2,
};

const STATUS_LABELS: Record<string, string> = {
  watching: "Watching",
  unwatched: "Not Watched",
  watched: "Watched",
};

/**
 * Group items by their `status` field in the canonical Media order:
 * Watching → Not Watched → Watched.
 */
export function groupByStatus<T extends HasStatus>(
  items: T[]
): Array<{ label: string; status: string; items: T[] }> {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const key = item.status;
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  }

  return Array.from(groups.entries())
    .map(([status, groupItems]) => ({
      label: STATUS_LABELS[status] ?? status,
      status,
      items: groupItems,
    }))
    .sort(
      (a, b) =>
        (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
    );
}
// ---- Month grouping (by date field) ----

/**
 * Group items by their `date` field into month-year buckets.
 * For expense and medical records that use a plain `date` field
 * rather than `completed_at` or `due_date`.
 *
 * Returns groups sorted by most recent first.
 */
export function byMonth<T extends HasDate>(
  items: T[],
  selectedYear: number,
): Array<{ label: string; items: T[]; sortKey: number }> {
  // Pre-fill all 12 months so empty months always appear in the calendar grid
  const monthMap = new Map<number, { items: T[]; sortKey: number }>();
  for (let i = 0; i < 12; i++) {
    monthMap.set(i, { items: [], sortKey: i });
  }

  for (const item of items) {
    const d = new Date(item.date + "T00:00:00");
    if (d.getFullYear() !== selectedYear) continue;
    const monthIndex = d.getMonth();
    monthMap.get(monthIndex)!.items.push(item);
  }

  return Array.from(monthMap.entries())
    .map(([monthIndex, value]) => ({
      label: MONTH_YEAR_FORMATTER.format(new Date(selectedYear, monthIndex)),
      items: value.items.sort(
        (a, b) => new Date(b.date + "T00:00:00").getTime() - new Date(a.date + "T00:00:00").getTime(),
      ),
      sortKey: monthIndex,
    }))
    .sort((a, b) => b.sortKey - a.sortKey);
}

// ---- Month grouping (by due_date field) ----

/** Minimum shape for due-date-based month grouping */
interface HasDueDateForMonth {
  due_date: string | null;
}

/**
 * Group items by their `due_date` field into month-year buckets.
 * For task and education records that use `due_date` instead of a plain `date`.
 * Items with null `due_date` are excluded.
 *
 * Returns groups sorted by most recent first.
 */
export function byDueMonth<T extends HasDueDateForMonth>(
  items: T[],
  selectedYear: number,
): Array<{ label: string; items: T[]; sortKey: number }> {
  // Pre-fill all 12 months so empty months always appear in the calendar grid
  const monthMap = new Map<number, { items: T[]; sortKey: number }>();
  for (let i = 0; i < 12; i++) {
    monthMap.set(i, { items: [], sortKey: i });
  }

  for (const item of items) {
    if (!item.due_date) continue;
    const d = new Date(item.due_date + "T00:00:00");
    if (d.getFullYear() !== selectedYear) continue;
    const monthIndex = d.getMonth();
    monthMap.get(monthIndex)!.items.push(item);
  }

  return Array.from(monthMap.entries())
    .map(([monthIndex, value]) => ({
      label: MONTH_YEAR_FORMATTER.format(new Date(selectedYear, monthIndex)),
      items: value.items.sort(
        (a, b) => {
          const aDate = (a as HasDueDateForMonth).due_date;
          const bDate = (b as HasDueDateForMonth).due_date;
          if (!aDate && !bDate) return 0;
          if (!aDate) return 1;
          if (!bDate) return -1;
          return new Date(bDate + "T00:00:00").getTime() - new Date(aDate + "T00:00:00").getTime();
        },
      ),
      sortKey: monthIndex,
    }))
    .sort((a, b) => b.sortKey - a.sortKey);
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