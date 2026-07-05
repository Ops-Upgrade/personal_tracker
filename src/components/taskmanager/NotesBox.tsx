"use client";

import type { Note } from "@/types/taskmanager";
import Button from "@/components/common/Button";
import BoxContainer, { SCROLLABLE_CLASSES } from "@/components/common/BoxContainer";
import { sortedNotes, trunc } from "./helpers";

interface NotesBoxProps {
  notes: Note[];
  isLoading: boolean;
  onAdd: () => void;
  onOpenExpanded: () => void;
  onSelectNote: (note: Note) => void;
}

export default function NotesBox({
  notes,
  isLoading,
  onAdd,
  onOpenExpanded,
  onSelectNote,
}: NotesBoxProps) {
  const sorted = sortedNotes(notes);

  return (
    <BoxContainer>
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Notes
          </h2>
          <Button
            variant="secondary"
            size="md"
            onClick={onAdd}
            disabled={isLoading}
          >
            + Add
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenExpanded}
          disabled={isLoading}
        >
          View all
        </Button>
      </header>
      <div className={`${SCROLLABLE_CLASSES} space-y-1 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800`}>
        {isLoading && (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</div>
        )}
        {!isLoading && sorted.length === 0 && (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">None</div>
        )}
        {!isLoading &&
          sorted.map((note) => (
          <button
            key={note.id}
            type="button"
            onClick={() => onSelectNote(note)}
            className="w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {trunc(note.content, 80)}
          </button>
          ))}
      </div>
    </BoxContainer>
  );
}
