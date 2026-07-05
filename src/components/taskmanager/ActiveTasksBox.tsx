"use client";

import type { Task, TaskView } from "@/types/taskmanager";
import { PRIORITIES } from "@/types/taskmanager";
import ViewToggle from "./ViewToggle";
import MonthTile from "@/components/common/MonthTile";
import { activeByMonths, byPriority, trunc } from "./helpers";

interface ActiveTasksBoxProps {
  tasks: Task[];
  isLoading: boolean;
  view: TaskView;
  nowYear: number;
  onViewChange: (next: TaskView) => void;
  onAdd: () => void;
  onSelectTask: (task: Task) => void;
  onMarkComplete: (task: Task) => void;
}

function prettyPriority(priority: string): string {
  return priority[0].toUpperCase() + priority.slice(1);
}

function dueDisplay(dueDate: string | null): string {
  return dueDate ?? "-";
}

export default function ActiveTasksBox({
  tasks,
  isLoading,
  view,
  nowYear,
  onViewChange,
  onAdd,
  onSelectTask,
  onMarkComplete,
}: ActiveTasksBoxProps) {
  const priorityGroups = byPriority(tasks);
  const monthGroups = activeByMonths(tasks, nowYear);

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-2">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Tasks
          </h2>
          <ViewToggle value={view} onChange={onViewChange} />
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={isLoading}
          className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          + Add
        </button>
      </header>

      <div className="h-[30rem] space-y-3 overflow-y-auto rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
        {isLoading && (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</div>
        )}
        {!isLoading && tasks.length === 0 && (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">None</div>
        )}

        {!isLoading &&
          view === "priority" &&
          PRIORITIES.map((priority) => {
            const group = priorityGroups[priority];

            return (
              <section
                key={priority}
                className="rounded-lg border border-zinc-200 p-2 dark:border-zinc-700"
              >
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                  {prettyPriority(priority)}
                </h3>
                {group.length === 0 && (
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">None</div>
                )}
                <div className="space-y-2">
                  {group.map((task) => (
                    <div
                      key={task.id}
                      className="group flex items-center justify-between gap-2 rounded-md border border-zinc-200 px-2 py-1.5 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60"
                    >
                      <button
                        type="button"
                        onClick={() => onSelectTask(task)}
                        className="grid flex-1 cursor-pointer gap-2 text-left text-xs sm:grid-cols-12"
                      >
                        <span className="font-medium text-zinc-800 dark:text-zinc-100 sm:col-span-4">
                          {trunc(task.name, 34)}
                        </span>
                        <span className="text-zinc-600 dark:text-zinc-300 sm:col-span-2">
                          <span className="mr-1 inline sm:hidden">Due:</span>
                          {dueDisplay(task.due_date)}
                        </span>
                        <span className="text-zinc-600 dark:text-zinc-300 sm:col-span-2">
                          <span className="mr-1 inline sm:hidden">Mode:</span>
                          {task.mode}
                        </span>
                        <span className="text-zinc-500 dark:text-zinc-400 sm:col-span-4">
                          <span className="mr-1 inline sm:hidden">Description:</span>
                          {trunc(task.description, 38)}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onMarkComplete(task)}
                        className="cursor-pointer whitespace-nowrap px-1 py-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Complete {">"}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

        {!isLoading &&
          view === "months" &&
          monthGroups.map((group) => (
            <MonthTile
              key={group.label}
              title={group.label}
              alwaysExpanded
              className="text-sm"
            >
              {group.tasks.length === 0 ? (
                <div className="text-xs text-zinc-500 dark:text-zinc-400">None</div>
              ) : (
                <div className="space-y-2">
                  {group.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="group flex items-center justify-between gap-2 rounded-md border border-zinc-200 px-2 py-1.5 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60"
                    >
                      <button
                        type="button"
                        onClick={() => onSelectTask(task)}
                        className="grid flex-1 cursor-pointer gap-2 text-left text-xs sm:grid-cols-12"
                      >
                        <span className="font-medium text-zinc-800 dark:text-zinc-100 sm:col-span-4">
                          {trunc(task.name, 34)}
                        </span>
                        <span className="text-zinc-600 dark:text-zinc-300 sm:col-span-2">
                          <span className="mr-1 inline sm:hidden">Priority:</span>
                          {prettyPriority(task.priority)}
                        </span>
                        <span className="text-zinc-600 dark:text-zinc-300 sm:col-span-2">
                          <span className="mr-1 inline sm:hidden">Due:</span>
                          {dueDisplay(task.due_date)}
                        </span>
                        <span className="text-zinc-600 dark:text-zinc-300 sm:col-span-2">
                          <span className="mr-1 inline sm:hidden">Mode:</span>
                          {task.mode}
                        </span>
                        <span className="text-zinc-500 dark:text-zinc-400 sm:col-span-2">
                          <span className="mr-1 inline sm:hidden">Description:</span>
                          {trunc(task.description, 20)}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onMarkComplete(task)}
                        className="cursor-pointer whitespace-nowrap px-1 py-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Complete {">"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </MonthTile>
          ))}
      </div>
    </article>
  );
}
