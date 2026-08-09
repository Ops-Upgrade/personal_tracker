"use client";

import type { Task } from "@/types/taskmanager";
import GenericCompletedBox from "@/components/common/GenericCompletedBox";
import Button from "@/components/common/Button";
import PriorityBadge from "@/components/common/PriorityBadge";
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

  const listHeader = (
    <div className="grid grid-cols-12 px-2 pb-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
      <div className="col-span-4">Name</div>
      <div className="col-span-2">Priority</div>
      <div className="col-span-2">Mode</div>
      <div className="col-span-2">Date</div>
      <div className="col-span-2 text-right">Actions</div>
    </div>
  );

  return (
    <GenericCompletedBox
      items={sorted}
      isLoading={isLoading}
      onOpenExpanded={onOpenExpanded}
      listHeader={listHeader}
      renderItem={(task) => {
        return (
          <div
            key={task.id}
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onSelectTask(task); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectTask(task); } }}
            className="grid grid-cols-12 items-center gap-2 w-full rounded-md border border-zinc-200 px-2 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100 cursor-pointer dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <span className="col-span-4 font-semibold text-zinc-800 dark:text-zinc-100 truncate">
              {trunc(task.name, 44)}
            </span>
            <div className="col-span-2 flex items-center">
              <PriorityBadge priority={task.priority} />
            </div>
            <span className="col-span-2 text-xs capitalize text-zinc-500 dark:text-zinc-400 flex items-center">
              {task.mode}
            </span>
            <span className="col-span-2 text-zinc-600 dark:text-zinc-300 flex items-center">
              {formatShortDate(task.completed_at)}
            </span>
            <div className="col-span-2 flex justify-end items-center">
              <Button
                variant="danger"
                size="sm"
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); onReopenTask(task); }}
              >
                Reopen
              </Button>
            </div>
          </div>
        );
      }}
    />
  );
}
