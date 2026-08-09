"use client";

import type { Task, TaskView } from "@/types/taskmanager";
import { PRIORITIES } from "@/types/common";
import type { ViewToggleOption } from "@/components/common/ViewToggle";
import GenericActiveBox from "@/components/common/GenericActiveBox";
import PriorityBadge from "@/components/common/PriorityBadge";
import Button from "@/components/common/Button";
import { getPriorityColor, trunc } from "./helpers";

const TASK_VIEW_OPTIONS: readonly ViewToggleOption<TaskView>[] = [
  { value: "months", label: "Months" },
  { value: "priority", label: "Priority" },
];

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
  return (
    <GenericActiveBox
      items={tasks}
      isLoading={isLoading}
      view={view}
      nowYear={nowYear}
      nowMonth={nowMonth}
      onViewChange={(v) => onViewChange(v as TaskView)}
      onAdd={onAdd}
      title="Tasks"
      viewOptions={TASK_VIEW_OPTIONS}
      priorities={PRIORITIES}
      getPriorityColor={(p) => getPriorityColor(p as typeof PRIORITIES[number])}
      renderPriorityBadge={(p) => <PriorityBadge priority={p as typeof PRIORITIES[number]} />}
      renderHeader={() => (
        <div className="hidden sm:flex items-center justify-between gap-2 px-2 pb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
          <div className="grid flex-1 gap-2 sm:grid-cols-12 pl-[3px]">
            <div className="col-span-4">Task Name</div>
            <div className="col-span-2">{view === "priority" ? "Due Date" : "Priority"}</div>
            <div className="col-span-2">Mode</div>
            <div className="col-span-4">Description</div>
          </div>
          <div className="w-[85px]" />
        </div>
      )}
      renderItem={(task) => {
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
              {/* Priority or Due date depending on view */}
              {view === "priority" ? (
                <span className="text-zinc-600 dark:text-zinc-300 sm:col-span-2">
                  <span className="mr-1 inline sm:hidden">Due:</span>
                  {dueDisplay(task.due_date)}
                </span>
              ) : (
                <span className="text-zinc-600 dark:text-zinc-300 sm:col-span-2">
                  <span className="mr-1 inline sm:hidden">Priority:</span>
                  <PriorityBadge priority={task.priority} />
                </span>
              )}
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
        );
      }}
    />
  );
}
