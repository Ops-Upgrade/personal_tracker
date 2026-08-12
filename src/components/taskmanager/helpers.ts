import type { Task, Note } from "@/types/taskmanager";
import type { Priority } from "@/types/common";
import type { Document } from "@/types/document";
import { PRIORITIES } from "@/types/common";
import { trunc } from "@/lib/viewHelpers";

// Re-export shared utilities (except byPriority which we wrap)
export {
  sortByCompletedDesc,
  completedByMonths,
} from "@/lib/viewHelpers";

// Re-export trunc (imported above for local use in getNoteTitle)
export { trunc };

export { formatShortDate } from "@/lib/format";

// Re-export priority colors from shared location
export { getPriorityColor } from "@/lib/priorityColors";

// Re-import byPriority from shared for wrapping
import { byPriority as sharedByPriority } from "@/lib/viewHelpers";

export function byPriority(tasks: Task[]): Record<Priority, Task[]> {
  return sharedByPriority(tasks, PRIORITIES) as Record<Priority, Task[]>;
}

/** Extract a display title from a note, with fallback for legacy notes lacking a name. */
export function getNoteTitle(note: Note): string {
  if (note.name?.trim()) return note.name.trim();
  // Legacy fallback: first 60 chars of plain-text content, stripped of HTML
  const stripped = note.content?.replace(/<[^>]*>/g, "").trim() ?? "";
  return stripped ? trunc(stripped, 60) : "Untitled Note";
}

// ── Unified note + file records ────────────────────────────────────────────

export type UnifiedNoteRecord =
  | { type: "note"; id: string; data: Note; attachedDocs: Document[]; dateStr: string }
  | { type: "file"; id: string; data: Document; dateStr: string };

/** Merge actual notes (only), sorted chronologically. */
export function getUnifiedNotes(notes: Note[], documents: Document[]): UnifiedNoteRecord[] {
  const docsByNoteId = new Map<string, Document[]>();

  for (const doc of documents) {
    if (doc.domain !== "taskmanager") continue;
    if (doc.linked_id) {
      if (!docsByNoteId.has(doc.linked_id)) docsByNoteId.set(doc.linked_id, []);
      docsByNoteId.get(doc.linked_id)!.push(doc);
    }
  }

  const unified: UnifiedNoteRecord[] = [];

  for (const note of notes) {
    unified.push({
      type: "note",
      id: `note-${note.id}`,
      data: note,
      attachedDocs: docsByNoteId.get(note.id) ?? [],
      dateStr: note.created_at,
    });
  }

  return unified.sort(
    (a, b) => new Date(b.dateStr).getTime() - new Date(a.dateStr).getTime(),
  );
}
