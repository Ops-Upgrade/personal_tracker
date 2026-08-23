"use client";

import { useCallback, useMemo, useState } from "react";
import { useTaskData } from "@/hooks/useTaskData";
import { ROUTES } from "@/routes/paths";
import type { Task } from "@/types/taskmanager";
import PageShell from "@/components/common/PageShell";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import GenericViewPage, { type ColumnDef } from "@/components/common/GenericViewPage";
import { useTaskActions } from "@/hooks/useTaskActions";
import { colPriority, colDate } from "@/components/common/columns";
import { getPriorityColor } from "@/lib/priorityColors";
import { TASK_FIELDS, TASK_LAYOUT } from "@/components/taskmanager/config";
import GenericDomainModal from "@/components/common/GenericDomainModal";

type SortColumn = "name" | "priority" | "date";

export default function CompletedTasksPage() {
  const { userId, nowYear, nowMonth, isLoading, error, refreshData, tasks } = useTaskData();

  const [taskModalTarget, setTaskModalTarget] = useState<Task | null>(null);

  const closeTaskModal = () => setTaskModalTarget(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    await refreshData(userId);
  }, [userId, refreshData]);

  const { handleTaskDelete, handleToggleComplete } =
    useTaskActions({ userId, refresh });

  // ── Column definitions (declarative tokens — the grid renders them) ──

  const completionColumns: ColumnDef<Task, SortColumn>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Name",
        sizing: "flex",
        weight: 2,
        sortColumn: "name",
        token: { type: "text", accessor: (task) => task.name, color: "strong" },
      },
      colPriority<Task, SortColumn>({ sortColumn: "priority" }),
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
      colDate<Task, SortColumn>(
        { key: "date", header: "Date", accessor: (task) => task.completed_at },
        { sortColumn: "date" },
      ),
    ],
    [],
  );

  const taskRowClass = (task: Task) => {
    const colors = getPriorityColor(task.priority);
    return `border-l-[3px] ${colors.border}`;
  };

  // ── Render ──

  return (
    <>
      <PageShell
        backHref={ROUTES.TASK_MANAGER}
        title="Completed Tasks"
        description="All your completed tasks."
        error={error}
        onRetry={() => userId && refreshData(userId)}
      >
        {isLoading && <LoadingSpinner />}

        {!isLoading && (
          <GenericViewPage
            data={tasks.filter((t) => t.is_completed)}
            columns={completionColumns}
            getItemKey={(t) => t.id}
            cacheKeyPrefix="taskmanager_completed"
            defaultSort={{ column: "date", direction: "desc" }}
            supportedViews={["all", "months", "priority"]}
            getDateKey={(t) => t.completed_at}
            getPriorityKey={(t) => t.priority}
            monthsMode="completed"
            itemNamePlural="completed tasks"
            onRowClick={(t) => setTaskModalTarget(t)}
            rowClassName={taskRowClass}
            rowAction={(task) => (
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleToggleComplete(task, false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    handleToggleComplete(task, false);
                  }
                }}
                className="cursor-pointer rounded-md border border-red-300 px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
              >
                Reopen
              </div>
            )}
            onBulkDelete={async (ids, clearFn) => {
              for (const id of ids) await handleTaskDelete(id);
              clearFn();
            }}
            nowYear={nowYear ?? undefined}
            nowMonth={nowMonth ?? undefined}
          />
        )}
      </PageShell>

      {taskModalTarget && userId && (
        <GenericDomainModal
          mode="record"
          domain="taskmanager"
          target={{
            type: "record",
            id: taskModalTarget.id,
            data: taskModalTarget as unknown as Record<string, unknown>,
          }}
          fields={TASK_FIELDS}
          layout={TASK_LAYOUT}
          onClose={closeTaskModal}
          onSaved={async () => {
            await refresh();
          }}
          onDeleted={async () => {
            await refresh();
          }}
        />
      )}
    </>
  );
}
