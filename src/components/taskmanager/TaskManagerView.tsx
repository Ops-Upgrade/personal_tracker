"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/routes/paths";
import Button from "@/components/common/Button";
import PriorityBadge from "@/components/common/PriorityBadge";
import type { ColumnDef } from "@/components/common/GenericViewPage";
import { useQueryModal } from "@/lib/useQueryModal";
import { useTaskData } from "@/hooks/useTaskData";
import GenericDomainPage from "@/components/common/GenericDomainPage";
import GenericDomainModal from "@/components/common/GenericDomainModal";
import type { Task } from "@/types/taskmanager";
import { PRIORITIES, type Priority } from "@/types/common";
import { useTaskActions } from "@/hooks/useTaskActions";
import { getPriorityColor } from "./helpers";
import { TASK_FIELDS, TASK_LAYOUT, TASK_PRIORITY, TASK_DUE_DATE } from "./config";
import { colRichtext } from "@/components/common/columns";
import CompletedTasksBox from "./CompletedTasksBox";

// ── Dashboard column definitions (GenericDomainPage drops the Priority
//    column automatically in the priority view) ──

const ACTIVE_TASK_COLUMNS: ColumnDef<Task>[] = [
  {
    key: "name",
    header: "Task Name",
    sizing: "flex",
    weight: 2,
    render: (task) => (
      <span className="font-semibold text-zinc-800 dark:text-zinc-100">
        {task.name}
      </span>
    ),
  },
  TASK_PRIORITY,
  TASK_DUE_DATE,
  {
    key: "mode",
    header: "Mode",
    sizing: "fixed",
    token: { type: "text", accessor: (task) => task.mode, color: "muted" },
  },
  colRichtext<Task>({
    key: "description",
    header: "Description",
    accessor: (task) => task.description,
    weight: 2,
    className: "text-zinc-700 dark:text-zinc-200",
  }),
];

/**
 * Task Manager feature shell.
 * Query-param-driven modals via useQueryModal ("task" prefix).
 * All structural rendering (year dropdown, month buckets, view toggle,
 * priority grouping) is owned by GenericDomainPage.
 */
export default function TaskManagerView() {
  const router = useRouter();
  const { userId, nowYear, nowMonth, isLoading, error, refreshData, tasks } = useTaskData();

  // ── Derived data ──

  const activeTasks = useMemo(
    () => tasks.filter((task) => !task.is_completed),
    [tasks],
  );
  const completedTasks = useMemo(
    () => tasks.filter((task) => task.is_completed),
    [tasks],
  );

  // ── Query-param-driven modal ──

  const {
    modalTarget: taskModalTarget,
    openCreate: openNewTask,
    openEdit: openEditTask,
    openEditId: openEditTaskId,
    closeModal: closeTaskModal,
  } = useQueryModal(tasks, "task");

  // ── CRUD handlers ──

  const refresh = useCallback(async () => {
    if (!userId) return;
    await refreshData(userId);
  }, [userId, refreshData]);

  const { handleToggleComplete } = useTaskActions({ userId, refresh });

  // ── Row helpers passed to GenericDomainPage ──

  const rowAction = useCallback(
    (task: Task) => (
      <Button
        variant="success"
        size="sm"
        className="w-[85px]"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          handleToggleComplete(task, true);
        }}
      >
        Complete
      </Button>
    ),
    [handleToggleComplete],
  );

  const getSubtitle = useCallback(
    (items: Task[]) => (
      <>{items.length} task{items.length !== 1 ? "s" : ""}</>
    ),
    [],
  );

  // ── Render ──

  return (
    <GenericDomainPage<Task>
      data={activeTasks}
      columns={ACTIVE_TASK_COLUMNS}
      domain="taskmanager"
      getDateKey={(task) => task.due_date}
      getItemKey={(task) => task.id}
      supportedViews={["months", "priority"]}
      priorities={PRIORITIES}
      getPriorityKey={(task) => task.priority}
      getPriorityColor={(p) => getPriorityColor(p as Priority)}
      renderPriorityBadge={(p) => <PriorityBadge priority={p as Priority} showTextOnMobile />}
      title="Task Manager"
      description="Track active tasks and completed tasks."
      backHref={ROUTES.DASHBOARD}
      onAdd={openNewTask}
      isLoading={isLoading}
      error={error}
      onRetry={() => {
        void refresh();
      }}
      nowYear={nowYear}
      nowMonth={nowMonth}
      viewCacheKey="taskManagerActiveView"
      viewAllBaseHref={ROUTES.TASK_MANAGER_ALL}
      onRowClick={openEditTask}
      rowClassName={(task) => `border-l-[3px] ${getPriorityColor(task.priority).border}`}
      rowAction={rowAction}
      getSubtitle={getSubtitle}
      completedSlot={
        <CompletedTasksBox
          tasks={completedTasks}
          isLoading={isLoading}
          onOpenExpanded={() => router.push(ROUTES.TASK_MANAGER_COMPLETED)}
          onSelectTask={openEditTask}
          onReopenTask={(task: Task) => handleToggleComplete(task, false)}
        />
      }
      modalSlot={
        <>
          {taskModalTarget && (
            <GenericDomainModal
              mode="record"
              domain="taskmanager"
              target={
                taskModalTarget === "create"
                  ? undefined
                  : {
                      type: "record",
                      id: taskModalTarget.id,
                      data: taskModalTarget as unknown as Record<string, unknown>,
                    }
              }
              fields={TASK_FIELDS}
              layout={TASK_LAYOUT}
              onClose={closeTaskModal}
              onSaved={async (saved) => {
                await refresh();
                if (taskModalTarget === "create") openEditTaskId(saved.id);
              }}
              onDeleted={async () => {
                await refresh();
              }}
            />
          )}
        </>
      }
    />
  );
}
