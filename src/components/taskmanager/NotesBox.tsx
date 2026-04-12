"use client";

import type { Note } from "@/types/taskmanager";
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
    <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Notes
          </h2>
          <button
            type="button"
            onClick={onAdd}
            disabled={isLoading}
            className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            + Add
          </button>
        </div>
        <button
          type="button"
          onClick={onOpenExpanded}
          disabled={isLoading}
          className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          {">>View all"}
        </button>
      </header>
      <div className="h-52 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 p-2 dark:border-zinc-800">
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
            className="w-full rounded-md px-2 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {trunc(note.content, 80)}
          </button>
          ))}
      </div>
    </article>
  );
}
