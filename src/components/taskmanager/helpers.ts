import type { Task, Note, Priority } from "@/types/taskmanager";
import { PRIORITIES } from "@/types/taskmanager";
import { trunc } from "@/lib/viewHelpers";

// Re-export shared utilities (except byPriority which we wrap)
export {
  sortByCompletedDesc,
  sortByCreatedAtDesc,
  sortByDueDateAsc,
  activeByMonths,
  completedByMonths,
} from "@/lib/viewHelpers";

// Re-export trunc (imported above for local use in getNoteTitle)
export { trunc };

export { formatShortDate } from "@/lib/format";

// Re-export priority colors from shared location
export { getPriorityColor } from "@/lib/priorityColors";
export type { PriorityColorSet } from "@/lib/priorityColors";

// Re-import byPriority from shared for wrapping
import { byPriority as sharedByPriority } from "@/lib/viewHelpers";

export function byPriority(tasks: Task[]): Record<Priority, Task[]> {
  return sharedByPriority(tasks, PRIORITIES) as Record<Priority, Task[]>;
}

export function sortedNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/** Extract a display title from a note, with fallback for legacy notes lacking a name. */
export function getNoteTitle(note: Note): string {
  if (note.name?.trim()) return note.name.trim();
  // Legacy fallback: first 60 chars of plain-text content, stripped of HTML
  const stripped = note.content?.replace(/<[^>]*>/g, "").trim() ?? "";
  return stripped ? trunc(stripped, 60) : "Untitled Note";
}
