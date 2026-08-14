"use client";

import { useMemo } from "react";
import type { Task } from "@/types/taskmanager";
import type { ColumnDef } from "@/components/common/GenericViewPage";
import GenericCompletedBox from "@/components/common/GenericCompletedBox";
import Button from "@/components/common/Button";
import { TASK_PRIORITY } from "./config";
import { colDate } from "@/components/common/columns";
import { sortByCompletedDesc } from "./helpers";

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

  // Fixed tracks size themselves to content; flex tracks share the rest.
  const columns: ColumnDef<Task>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Name",
        sizing: "flex",
        weight: 2,
        render: (task) => (
          <span className="font-semibold text-zinc-800 dark:text-zinc-100">
            {task.name}
          </span>
        ),
      },
      TASK_PRIORITY,
      {
        key: "mode",
        header: "Mode",
        sizing: "fixed",
        render: (task) => (
          <span className="text-xs capitalize text-zinc-500 dark:text-zinc-400">
            {task.mode}
          </span>
        ),
      },
      colDate<Task>({ key: "date", header: "Date", accessor: (task) => task.completed_at }),
      {
        key: "actions",
        header: "Actions",
        sizing: "fixed",
        align: "right",
        render: (task) => (
          <Button
            variant="danger"
            size="sm"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              onReopenTask(task);
            }}
          >
            Reopen
          </Button>
        ),
      },
    ],
    [onReopenTask],
  );

  return (
    <GenericCompletedBox
      items={sorted}
      isLoading={isLoading}
      onOpenExpanded={onOpenExpanded}
      columns={columns}
      onRowClick={onSelectTask}
    />
  );
}
