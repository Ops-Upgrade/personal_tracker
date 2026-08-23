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
  if (!a.due_date) return -1; // unscheduled items float to the top
  if (!b.due_date) return 1;
  return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
}

export function sortByCompletedAsc<T extends HasCompletedAt>(a: T, b: T): number {
  const aTs = a.completed_at ? new Date(a.completed_at).getTime() : 0;
  const bTs = b.completed_at ? new Date(b.completed_at).getTime() : 0;
  return aTs - bTs;
}

// ---- Text helpers ----

/** Strip HTML tags from a string, returning clean plain text. */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
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