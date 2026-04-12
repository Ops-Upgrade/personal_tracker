"use client";

import type { Task, TaskView } from "@/types/taskmanager";
import { PRIORITIES } from "@/types/taskmanager";
import ModalFrame from "./ModalFrame";
import ViewToggle from "./ViewToggle";
import {
  byPriority,
  completedByMonths,
  formatShortDate,
  sortByCompletedDesc,
  trunc,
} from "./helpers";

interface CompletedTasksModalProps {
  tasks: Task[];
  view: TaskView;
  onViewChange: (next: TaskView) => void;
  onClose: () => void;
  onSelectTask: (task: Task) => void;
  onReopenTask: (task: Task) => void;
}

function prettyPriority(priority: string): string {
  return priority[0].toUpperCase() + priority.slice(1);
}

export default function CompletedTasksModal({
  tasks,
  view,
  onViewChange,
  onClose,
  onSelectTask,
  onReopenTask,
}: CompletedTasksModalProps) {
  const priorityGroups = byPriority(tasks.map((task) => ({ ...task })));
  const monthGroups = completedByMonths(tasks);

  return (
    <ModalFrame title="Completed Tasks" onClose={onClose}>
      <div className="mb-3">
        <ViewToggle value={view} onChange={onViewChange} />
      </div>

      <div className="max-h-[65vh] space-y-3 overflow-y-auto rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
        {tasks.length === 0 && (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">None</div>
        )}

        {view === "priority" &&
          PRIORITIES.map((priority) => {
            const group = [...priorityGroups[priority]].sort(sortByCompletedDesc);
            if (group.length === 0) return null;
            return (
              <section
                key={priority}
                className="rounded-lg border border-zinc-200 p-2 dark:border-zinc-700"
              >
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                  {prettyPriority(priority)}
                </h3>
                <div className="space-y-2">
                  {group.map((task) => (
                    <div
                      key={task.id}
                      className="grid w-full grid-cols-12 items-center gap-2 rounded-md border border-zinc-200 px-2 py-1.5 text-left text-xs dark:border-zinc-700"
                    >
                      <button
                        type="button"
                        onClick={() => onSelectTask(task)}
                        className="col-span-6 text-left font-medium text-zinc-800 hover:text-zinc-900 dark:text-zinc-100 dark:hover:text-white"
                      >
                        {trunc(task.name, 52)}
                      </button>
                      <span className="col-span-3 text-zinc-600 dark:text-zinc-300">
                        {formatShortDate(task.completed_at)}
                      </span>
                      <span className="col-span-2 text-zinc-600 dark:text-zinc-300">
                        {prettyPriority(task.priority)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onReopenTask(task)}
                        className="col-span-1 cursor-pointer text-right text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {"< Reopen"}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

        {view === "months" &&
          monthGroups.map((group) => (
            <section
              key={group.label}
              className="rounded-lg border border-zinc-200 p-2 dark:border-zinc-700"
            >
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                {group.label}
              </h3>
              <div className="space-y-2">
                {group.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="grid w-full grid-cols-12 items-center gap-2 rounded-md border border-zinc-200 px-2 py-1.5 text-left text-xs dark:border-zinc-700"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectTask(task)}
                      className="col-span-7 text-left font-medium text-zinc-800 hover:text-zinc-900 dark:text-zinc-100 dark:hover:text-white"
                    >
                      {trunc(task.name, 58)}
                    </button>
                    <span className="col-span-3 text-zinc-600 dark:text-zinc-300">
                      {formatShortDate(task.completed_at)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onReopenTask(task)}
                      className="col-span-2 cursor-pointer text-right text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {"< Reopen"}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
      </div>
    </ModalFrame>
  );
}
