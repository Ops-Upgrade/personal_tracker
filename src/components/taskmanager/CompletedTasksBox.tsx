"use client";

import type { Task } from "@/types/taskmanager";
import Button from "@/components/common/Button";
import BoxContainer, { SCROLLABLE_CLASSES } from "@/components/common/BoxContainer";
import { formatShortDate, getPriorityColor, sortByCompletedDesc, trunc } from "./helpers";

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
    <BoxContainer>
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Completed
        </h2>
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
          sorted.map((task) => {
            const colors = getPriorityColor(task.priority);
            return (
              <div
                key={task.id}
                className="grid grid-cols-12 items-center gap-2 rounded-md border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-700"
              >
                {/* Priority dot */}
                <span
                  className={`col-span-1 inline-block h-2 w-2 rounded-full ${colors.dot}`}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={() => onSelectTask(task)}
                  className="col-span-6 cursor-pointer text-left font-semibold text-zinc-800 hover:text-zinc-900 dark:text-zinc-100 dark:hover:text-white"
                >
                  {trunc(task.name, 44)}
                </button>
                <div className="col-span-3 text-right text-zinc-600 dark:text-zinc-300">
                  {formatShortDate(task.completed_at)}
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => onReopenTask(task)}
                  className="col-span-2 text-right"
                >
                  Reopen
                </Button>
              </div>
            );
          })}
      </div>
    </BoxContainer>
  );
}