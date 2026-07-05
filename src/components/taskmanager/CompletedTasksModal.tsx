"use client";

import type { Task, TaskView } from "@/types/taskmanager";
import { PRIORITIES } from "@/types/taskmanager";
import ModalFrame from "./ModalFrame";
import ViewToggle from "./ViewToggle";
import MonthTile from "@/components/common/MonthTile";
import PriorityBadge from "./PriorityBadge";
import Button from "@/components/common/Button";
import {
  byPriority,
  completedByMonths,
  formatShortDate,
  getPriorityColor,
  sortByCompletedDesc,
  trunc,
} from "./helpers";

interface CompletedTasksModalProps {
  tasks: Task[];
  view: TaskView;
  nowYear: number;
  onViewChange: (next: TaskView) => void;
  onClose: () => void;
  onSelectTask: (task: Task) => void;
  onReopenTask: (task: Task) => void;
}

export default function CompletedTasksModal({
  tasks,
  view,
  nowYear,
  onViewChange,
  onClose,
  onSelectTask,
  onReopenTask,
}: CompletedTasksModalProps) {
  const priorityGroups = byPriority(tasks.map((task) => ({ ...task })));
  const monthGroups = completedByMonths(tasks, nowYear);

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
            const colors = getPriorityColor(priority);

            return (
              <section
                key={priority}
                className={`rounded-lg border ${colors.border} ${colors.bg} p-2`}
              >
                <h3 className="mb-2">
                  <PriorityBadge priority={priority} />
                </h3>
                <div className="space-y-2">
                  {group.map((task) => (
                    <div
                      key={task.id}
                      className={`grid w-full grid-cols-12 items-center gap-2 rounded-md border border-zinc-200 px-2 py-1.5 text-left text-sm dark:border-zinc-700 border-l-[3px] ${colors.border}`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectTask(task)}
                        className="col-span-6 cursor-pointer text-left font-semibold text-zinc-800 hover:text-zinc-900 dark:text-zinc-100 dark:hover:text-white"
                      >
                        {trunc(task.name, 52)}
                      </button>
                      <span className="col-span-3 text-zinc-600 dark:text-zinc-300">
                        {formatShortDate(task.completed_at)}
                      </span>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => onReopenTask(task)}
                        className="col-span-3 text-right"
                      >
                        Reopen
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

        {view === "months" &&
          monthGroups.map((group, index) => (
            <MonthTile
              key={group.label}
              title={group.label}
              defaultExpanded={index === 0}
              accent
              className="text-sm"
            >
              <div className="space-y-2">
                {group.tasks.map((task) => {
                  const colors = getPriorityColor(task.priority);
                  return (
                    <div
                      key={task.id}
                      className={`grid w-full grid-cols-12 items-center gap-2 rounded-md border border-zinc-200 px-2 py-1.5 text-left text-sm dark:border-zinc-700 border-l-[3px] ${colors.border}`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectTask(task)}
                        className="col-span-4 cursor-pointer text-left font-semibold text-zinc-800 hover:text-zinc-900 dark:text-zinc-100 dark:hover:text-white"
                      >
                        {trunc(task.name, 42)}
                      </button>
                      <span className="col-span-2">
                        <PriorityBadge priority={task.priority} />
                      </span>
                      <span className="col-span-3 text-zinc-600 dark:text-zinc-300">
                        {formatShortDate(task.completed_at)}
                      </span>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => onReopenTask(task)}
                        className="col-span-3 text-right"
                      >
                        Reopen
                      </Button>
                    </div>
                  );
                })}
              </div>
            </MonthTile>
          ))}
      </div>
    </ModalFrame>
  );
}