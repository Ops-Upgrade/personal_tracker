"use client";

import { useCallback, useMemo } from "react";
import type { Task, TaskView } from "@/types/taskmanager";
import { PRIORITIES } from "@/types/common";
import type { ViewToggleOption } from "@/components/common/ViewToggle";
import GenericActiveBox from "@/components/common/GenericActiveBox";
import type { ColumnDef } from "@/components/common/GenericViewPage";
import PriorityBadge from "@/components/common/PriorityBadge";
import Button from "@/components/common/Button";
import { ROUTES } from "@/routes/paths";
import { formatShortDate, getPriorityColor, trunc } from "./helpers";

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
  // ── Column definitions (view-dependent for priority/due-date column) ──

  const taskColumns: ColumnDef<Task>[] = useMemo(
    () => {
      const isPriorityView = view === "priority";
      const cols: ColumnDef<Task>[] = [
        {
          key: "name",
          header: "Task Name",
          colSpan: 3,
          mdColSpan: isPriorityView ? 3 : 2,
          mobileBehavior: "truncate",
          render: (task) => (
            <span className="font-semibold text-zinc-800 dark:text-zinc-100">
              {trunc(task.name, 34)}
            </span>
          ),
        },
      ];

      if (!isPriorityView) {
        cols.push({
          key: "priority",
          header: "Priority",
          colSpan: 1,
          mdColSpan: 2,
          mobileBehavior: "fixed",
          align: "center",
          render: (task) => <PriorityBadge priority={task.priority} />,
        });
      }

      cols.push({
        key: "due_date",
        header: "Due Date",
        colSpan: 4,
        mobileBehavior: "fixed",
        render: (task) => (
          <span className="text-zinc-600 dark:text-zinc-300">
            {formatShortDate(task.due_date)}
          </span>
        ),
      });

      cols.push(
        {
          key: "mode",
          header: "Mode",
          colSpan: 2,
          mobileBehavior: "truncate",
          render: (task) => (
            <span className="text-zinc-600 dark:text-zinc-300">{task.mode}</span>
          ),
        },
        {
          key: "description",
          header: "Description",
          colSpan: isPriorityView ? 3 : 2,
          mobileBehavior: "truncate",
          render: (task) => (
            <span className="text-zinc-700 dark:text-zinc-200">
              {trunc(task.description, 38)}
            </span>
          ),
        },
      );

      return cols;
    },
    [view],
  );

  const getItemClassName = useCallback(
    (task: Task) => {
      const colors = getPriorityColor(task.priority);
      return `border-l-[3px] ${colors.border}`;
    },
    [],
  );

  const rowAction = useCallback(
    (task: Task) => (
      <Button
        variant="success"
        size="sm"
        className="w-[85px]"
        onClick={() => onMarkComplete(task)}
      >
        Complete
      </Button>
    ),
    [onMarkComplete],
  );

  const getSubtitle = useCallback(
    (items: Task[]) => (
      <>{items.length} task{items.length !== 1 ? "s" : ""}</>
    ),
    [],
  );

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
      renderPriorityBadge={(p) => <PriorityBadge priority={p as typeof PRIORITIES[number]} showTextOnMobile />}
      columns={taskColumns}
      onRowClick={onSelectTask}
      rowAction={rowAction}
      getItemClassName={getItemClassName}
      getSubtitle={getSubtitle}
      viewAllBaseHref={ROUTES.TASK_MANAGER_ALL}
    />
  );
}
