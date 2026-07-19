"use client";

import { useCallback, useMemo, useState } from "react";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
import { deleteNote, fetchNotes, updateNote } from "@/api/taskmanager";
import { ROUTES } from "@/routes/paths";
import type { Note } from "@/types/taskmanager";
import BoxContainer, { SCROLLABLE_CLASSES } from "@/components/common/BoxContainer";
import PageShell from "@/components/common/PageShell";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { sortedNotes, trunc } from "@/components/taskmanager/helpers";
import NoteModal from "@/components/taskmanager/NoteModal";

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);

  const loadData = useCallback(async (uid: string) => {
    const rows = await fetchNotes(uid);
    setNotes(rows);
  }, []);

  const { userId, isLoading, error, refreshData } =
    useAuthBootstrap({ loadData });

  const sorted = useMemo(() => sortedNotes(notes), [notes]);
  const [noteModalTarget, setNoteModalTarget] = useState<Note | null>(null);

  const handleEditNote = (note: Note) => {
    setNoteModalTarget(note);
  };

  const closeNoteModal = () => setNoteModalTarget(null);

  async function handleNoteSave(content: string, existingNote: Note | null) {
    if (!userId || !existingNote) return;
    const payload = {
      content,
      updated_at: new Date().toISOString(),
    };
    await updateNote(userId, existingNote.id, payload);
    await refreshData(userId);
  }

  async function handleNoteDelete(noteId: string) {
    if (!userId) return;
    await deleteNote(noteId);
    await refreshData(userId);
  }

  return (
    <PageShell
      backHref={ROUTES.TASK_MANAGER}
      title="Notes"
      description="All your notes."
      error={error}
      onRetry={() => userId && refreshData(userId)}
    >
      {isLoading && <LoadingSpinner />}

      {!isLoading && (
        <BoxContainer>
          <div className={`${SCROLLABLE_CLASSES} space-y-2 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800`}>
            {sorted.length === 0 && (
              <div className="text-sm text-zinc-500 dark:text-zinc-400">None</div>
            )}
            {sorted.map((note) => (
              <button
                key={note.id}
                type="button"
                onClick={() => handleEditNote(note)}
                className="w-full cursor-pointer rounded-md border border-zinc-200 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {trunc(note.content, 280)}
              </button>
            ))}
          </div>
        </BoxContainer>
      )}

      {noteModalTarget && (
        <NoteModal
          note={noteModalTarget}
          onClose={closeNoteModal}
          onSave={handleNoteSave}
          onDelete={handleNoteDelete}
        />
      )}
    </PageShell>
  );
}
