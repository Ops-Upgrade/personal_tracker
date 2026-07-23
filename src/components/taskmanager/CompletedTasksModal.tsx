"use client";

import type { Task, TaskView } from "@/types/taskmanager";
import { PRIORITIES } from "@/types/common";
import type { ViewToggleOption } from "@/components/common/ViewToggle";
import GenericCompletedModal from "@/components/common/GenericCompletedModal";
import PriorityBadge from "@/components/common/PriorityBadge";
import Button from "@/components/common/Button";
import {
  formatShortDate,
  getPriorityColor,
  trunc,
} from "./helpers";

const TASK_VIEW_OPTIONS: readonly ViewToggleOption<TaskView>[] = [
  { value: "months", label: "Months" },
  { value: "priority", label: "Priority" },
];

interface CompletedTasksModalProps {
  tasks: Task[];
  view: TaskView;
  nowYear: number;
  nowMonth: number;
  onViewChange: (next: TaskView) => void;
  onClose: () => void;
  onSelectTask: (task: Task) => void;
  onReopenTask: (task: Task) => void;
}

export default function CompletedTasksModal({
  tasks,
  view,
  nowYear,
  nowMonth,
  onViewChange,
  onClose,
  onSelectTask,
  onReopenTask,
}: CompletedTasksModalProps) {
  return (
    <GenericCompletedModal
      items={tasks}
      view={view}
      nowYear={nowYear}
      nowMonth={nowMonth}
      onViewChange={(v) => onViewChange(v as TaskView)}
      onClose={onClose}
      title="Completed Tasks"
      viewOptions={TASK_VIEW_OPTIONS}
      priorities={PRIORITIES}
      getPriorityColor={(p) => getPriorityColor(p as "low" | "medium" | "high" | "critical")}
      renderPriorityBadge={(p) => <PriorityBadge priority={p as "low" | "medium" | "high" | "critical"} />}
      renderItem={(task) => {
        const colors = getPriorityColor(task.priority);
        return (
          <div
            key={task.id}
            className={`grid w-full grid-cols-12 items-center gap-2 rounded-md border border-zinc-200 px-2 py-1.5 text-left text-sm dark:border-zinc-700 border-l-[3px] ${colors.border}`}
          >
            {view === "priority" ? (
              <>
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
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        );
      }}
    />
  );
}
