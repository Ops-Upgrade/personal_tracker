"use client";

import type { Task } from "@/types/taskmanager";
import { formatShortDate, sortByCompletedDesc, trunc } from "./helpers";

interface CompletedTasksBoxProps {
  tasks: Task[];
  isLoading: boolean;
  onOpenExpanded: () => void;
  onSelectTask: (task: Task) => void;
  onReopenTask: (task: Task) => void;
}

export default function CompletedTasksBox({
  tasks,
  isLoading,
  onOpenExpanded,
  onSelectTask,
  onReopenTask,
}: CompletedTasksBoxProps) {
  const sorted = [...tasks].sort(sortByCompletedDesc);

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Completed
        </h2>
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
          sorted.map((task) => (
          <div
            key={task.id}
            className="grid grid-cols-12 items-center gap-2 rounded-md border border-zinc-200 px-2 py-1.5 text-xs dark:border-zinc-700"
          >
            <button
              type="button"
              onClick={() => onSelectTask(task)}
              className="col-span-7 text-left font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-200 dark:hover:text-zinc-100"
            >
              {trunc(task.name, 44)}
            </button>
            <div className="col-span-3 text-right text-[11px] text-zinc-500 dark:text-zinc-400">
              {formatShortDate(task.completed_at)}
            </div>
            <button
              type="button"
              onClick={() => onReopenTask(task)}
              className="col-span-2 cursor-pointer whitespace-nowrap text-right text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              {"< Reopen"}
            </button>
          </div>
          ))}
      </div>
    </article>
  );
}
