"use client";

import type { Note } from "@/types/taskmanager";
import Button from "@/components/common/Button";
import GenericCompletedBox from "@/components/common/GenericCompletedBox";
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
    <GenericCompletedBox
      items={sorted}
      isLoading={isLoading}
      onOpenExpanded={onOpenExpanded}
      title="Notes"
      renderItem={(note) => (
        <button
          type="button"
          onClick={() => onSelectNote(note)}
          className="w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {trunc(note.content, 80)}
        </button>
      )}
      headerActions={
        <Button
          variant="secondary"
          size="md"
          onClick={onAdd}
          disabled={isLoading}
        >
          + Add
        </Button>
      }
    />
  );
}
