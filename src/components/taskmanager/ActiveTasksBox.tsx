"use client";

import type { Task, TaskView } from "@/types/taskmanager";
import { PRIORITIES } from "@/types/taskmanager";
import ViewToggle from "./ViewToggle";
import MonthTile from "@/components/common/MonthTile";
import PriorityBadge from "./PriorityBadge";
import Button from "@/components/common/Button";
import BoxContainer, { SCROLLABLE_CLASSES } from "@/components/common/BoxContainer";
import { activeByMonths, byPriority, getPriorityColor, trunc } from "./helpers";

interface ActiveTasksBoxProps {
  tasks: Task[];
  isLoading: boolean;
  view: TaskView;
  nowYear: number;
  nowMonth: number;
  onViewChange: (next: TaskView) => void;
  onAdd: () => void;
  onSelectTask: (task: Task) => void;
  onMarkComplete: (task: Task) => void;
}

function dueDisplay(dueDate: string | null): string {
  return dueDate ?? "-";
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function ActiveTasksBox({
  tasks,
  isLoading,
  view,
  nowYear,
  nowMonth,
  onViewChange,
  onAdd,
  onSelectTask,
  onMarkComplete,
}: ActiveTasksBoxProps) {
  const priorityGroups = byPriority(tasks);
  const monthGroups = activeByMonths(tasks, nowYear);

  return (
    <BoxContainer className="lg:col-span-2">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Tasks
          </h2>
          <ViewToggle value={view} onChange={onViewChange} />
        </div>
        <Button
          variant="secondary"
          size="md"
          onClick={onAdd}
          disabled={isLoading}
        >
          + Add
        </Button>
      </header>

      <div className={`${SCROLLABLE_CLASSES} space-y-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800`}>
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
            const colors = getPriorityColor(priority);

            return (
              <section
                key={priority}
                className={`rounded-lg border ${colors.border} ${colors.bg} p-2`}
              >
                <h3 className="mb-2">
                  <PriorityBadge priority={priority} />
                </h3>
                {group.length === 0 && (
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">None</div>
                )}
                <div className="space-y-2">
                  {group.map((task) => (
                    <div
                      key={task.id}
                      className={`group flex items-center justify-between gap-2 rounded-md border border-zinc-200 px-2 py-1.5 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60 border-l-[3px] ${colors.border}`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectTask(task)}
                        className="grid flex-1 cursor-pointer gap-2 text-left text-sm sm:grid-cols-12"
                      >
                        <span className="font-semibold text-zinc-800 dark:text-zinc-100 sm:col-span-4">
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
                        <span className="text-zinc-700 dark:text-zinc-200 sm:col-span-4">
                          <span className="mr-1 inline sm:hidden">Description:</span>
                          {trunc(task.description, 38)}
                        </span>
                      </button>
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => onMarkComplete(task)}
                      >
                        Complete
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

        {!isLoading &&
          view === "months" &&
          monthGroups.map((group) => {
            const isCurrentMonth = MONTH_NAMES[nowMonth] === group.label;
            return (
              <MonthTile
                key={group.label}
                title={group.label}
                defaultExpanded={isCurrentMonth}
                accent={group.tasks.length > 0}
                className="text-sm"
                highlight={isCurrentMonth}
              >
                {group.tasks.length === 0 ? (
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">None</div>
                ) : (
                  <div className="space-y-2">
                    {group.tasks.map((task) => {
                      const colors = getPriorityColor(task.priority);
                      return (
                        <div
                          key={task.id}
                          className={`group flex items-center justify-between gap-2 rounded-md border border-zinc-200 px-2 py-1.5 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60 border-l-[3px] ${colors.border}`}
                        >
                          <button
                            type="button"
                            onClick={() => onSelectTask(task)}
                            className="grid flex-1 cursor-pointer gap-2 text-left text-sm sm:grid-cols-12"
                          >
                            <span className="font-semibold text-zinc-800 dark:text-zinc-100 sm:col-span-4">
                              {trunc(task.name, 34)}
                            </span>
                            <span className="text-zinc-600 dark:text-zinc-300 sm:col-span-2">
                              <span className="mr-1 inline sm:hidden">Priority:</span>
                              <PriorityBadge priority={task.priority} />
                            </span>
                            <span className="text-zinc-600 dark:text-zinc-300 sm:col-span-2">
                              <span className="mr-1 inline sm:hidden">Due:</span>
                              {dueDisplay(task.due_date)}
                            </span>
                            <span className="text-zinc-700 dark:text-zinc-200 sm:col-span-4">
                              <span className="mr-1 inline sm:hidden">Description:</span>
                              {trunc(task.description, 38)}
                            </span>
                          </button>
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => onMarkComplete(task)}
                          >
                            Complete
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </MonthTile>
            );
          })}
      </div>
    </BoxContainer>
  );
}