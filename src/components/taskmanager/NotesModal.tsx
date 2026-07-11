"use client";

import type { Note } from "@/types/taskmanager";
import ModalFrame from "@/components/common/ModalFrame";
import { sortedNotes, trunc } from "./helpers";

interface NotesModalProps {
  notes: Note[];
  onClose: () => void;
  onSelectNote: (note: Note) => void;
}

export default function NotesModal({ notes, onClose, onSelectNote }: NotesModalProps) {
  const sorted = sortedNotes(notes);

  return (
    <ModalFrame title="Notes" onClose={onClose}>
      <div className="max-h-[65vh] space-y-2 overflow-y-auto rounded-lg border border-zinc-200 p-2 dark:border-zinc-800">
        {sorted.length === 0 && (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">None</div>
        )}
        {sorted.map((note) => (
          <button
            key={note.id}
            type="button"
            onClick={() => onSelectNote(note)}
            className="w-full cursor-pointer rounded-md border border-zinc-200 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {trunc(note.content, 280)}
          </button>
        ))}
      </div>
    </ModalFrame>
  );
}
