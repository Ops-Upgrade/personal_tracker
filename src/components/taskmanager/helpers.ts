import type { Task, Note, Priority } from "@/types/taskmanager";
import { PRIORITIES } from "@/types/taskmanager";

// Re-export shared utilities (except byPriority which we wrap)
export {
  sortByCompletedDesc,
  sortByCreatedAtDesc,
  sortByDueDateAsc,
  activeByMonths,
  completedByMonths,
  trunc,
} from "@/lib/viewHelpers";

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
