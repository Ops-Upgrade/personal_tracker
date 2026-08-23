"use client";

import { useMemo } from "react";
import type { Task } from "@/types/taskmanager";
import type { ColumnDef } from "@/components/common/GenericViewPage";
import GenericCompletedBox from "@/components/common/GenericCompletedBox";
import Button from "@/components/common/Button";
import { TASK_PRIORITY } from "./config";
import { colDate } from "@/components/common/columns";
import { sortByCompletedAsc } from "./helpers";

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
  // Newest 5, in chronological order: ascending sort + tail slice keeps
  // same-day rows in their original order (a descending slice would render
  // them backwards, and reversing it would flip same-day rows too).
  const sorted = [...tasks].sort(sortByCompletedAsc).slice(-5);

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
        token: {
          type: "text",
          accessor: (task) => task.mode,
          color: "faint",
          capitalize: true,
          size: "xs",
        },
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
