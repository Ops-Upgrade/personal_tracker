"use client";

import { useCallback, useMemo, useState } from "react";
import { useTaskData } from "@/hooks/useTaskData";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useTaskActions } from "@/hooks/useTaskActions";
import { ROUTES } from "@/routes/paths";
import type { Task } from "@/types/taskmanager";
import { PRIORITIES } from "@/types/common";
import type { SortState } from "@/components/common/SortableHeader";
import PageShell from "@/components/common/PageShell";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import PriorityBadge from "@/components/common/PriorityBadge";
import GenericViewPage, { STANDARD_VIEWS } from "@/components/common/GenericViewPage";
import type { ColumnDef, MonthGroup, PriorityGroup } from "@/components/common/GenericViewPage";
import {
  byPriority,
  completedByMonths,
  sortByCompletedDesc,
  formatShortDate,
  getPriorityColor,
  trunc,
} from "@/components/taskmanager/helpers";
import TaskModal from "@/components/taskmanager/TaskModal";

export default function CompletedTasksPage() {
  const { userId, nowYear, nowMonth, isLoading, error, refreshData, tasks } = useTaskData();

  const [view, setView] = useLocalStorage<string>("taskManagerCompletedView", "all");
  const [taskModalTarget, setTaskModalTarget] = useState<Task | null>(null);

  // ── Year filtering ──

  const [selectedYear, setSelectedYear] = useState(nowYear);

  const completedTasks = useMemo(
    () => tasks.filter((t) => t.is_completed),
    [tasks]
  );

  const availableYears = useMemo(() => {
    const yearsFromData = new Set(
      completedTasks.map((t) => {
        if (!t.completed_at) return nowYear;
        return new Date(t.completed_at).getFullYear();
      })
    );
    yearsFromData.add(nowYear);
    return Array.from(yearsFromData).sort((a, b) => b - a);
  }, [completedTasks, nowYear]);

  const tasksForYear = useMemo(
    () =>
      completedTasks.filter((t) => {
        if (!t.completed_at) return false;
        return new Date(t.completed_at).getFullYear() === selectedYear;
      }),
    [completedTasks, selectedYear]
  );

  // ── Sort state for completion view ──

  const [sortState, setSortState] = useLocalStorage<SortState<"name" | "date">>(
    "taskManagerCompletedSort",
    { column: "date", direction: "desc" }
  );

  const completionTasks = useMemo(() => {
    const sorted = [...tasksForYear].sort((a, b) => {
      if (sortState.column === "name") {
        const cmp = (a.name ?? "").localeCompare(b.name ?? "");
        return sortState.direction === "asc" ? cmp : -cmp;
      }
      // date
      const aTs = a.completed_at ? new Date(a.completed_at).getTime() : 0;
      const bTs = b.completed_at ? new Date(b.completed_at).getTime() : 0;
      return sortState.direction === "asc" ? aTs - bTs : bTs - aTs;
    });
    return sorted;
  }, [tasksForYear, sortState]);

  // ── Grouped views ──

  const priorityGroupsRecord = byPriority(tasksForYear);
  const priorityGroups: PriorityGroup<Task>[] = useMemo(
    () =>
      PRIORITIES.map((p) => ({
        priority: p,
        items: [...(priorityGroupsRecord[p] ?? [])].sort(sortByCompletedDesc),
      })),
    [priorityGroupsRecord],
  );
  const monthGroups: MonthGroup<Task>[] = completedByMonths(tasksForYear, selectedYear);

  // ── Handlers ──

  const handleEditTask = (task: Task) => {
    setTaskModalTarget(task);
  };

  const closeTaskModal = () => setTaskModalTarget(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    await refreshData(userId);
  }, [userId, refreshData]);

  const { handleTaskSave: rawHandleTaskSave, handleTaskDelete, handleToggleComplete } =
    useTaskActions({ userId, refresh });

  // Void wrapper to match TaskModal's onSave signature (hook returns Promise<Task>)
  const handleTaskSave = useCallback(
    async (
      draft: {
        name: string;
        priority: Task["priority"];
        due_date: string | null;
        mode: Task["mode"];
        description: string;
        is_completed: boolean;
      },
      existingTask: Task | null,
    ) => {
      await rawHandleTaskSave(draft, existingTask);
    },
    [rawHandleTaskSave],
  );

  // ── Column definitions ──

  const renderTaskName = (task: Task) => (
    <span className="font-semibold text-zinc-800 dark:text-zinc-100">
      {trunc(task.name, 42)}
    </span>
  );

  const renderTaskPriority = (task: Task) => (
    <PriorityBadge priority={task.priority} />
  );

  const renderTaskMode = (task: Task) => (
    <span className="text-xs capitalize text-zinc-500 dark:text-zinc-400">
      {task.mode}
    </span>
  );

  const renderTaskDate = (task: Task) => (
    <span className="text-zinc-600 dark:text-zinc-300">
      {formatShortDate(task.completed_at)}
    </span>
  );

  const renderReopenAction = (task: Task) => (
    <div className="flex justify-end items-center">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); handleToggleComplete(task, false); }}
        className="cursor-pointer rounded-md border border-red-300 px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
      >
        Reopen
      </button>
    </div>
  );

  const completionColumns: ColumnDef<Task, "name" | "date">[] = useMemo(
    () => [
      { key: "name",     header: "Name",     colSpan: 4, sortColumn: "name", render: renderTaskName },
      { key: "priority", header: "Priority", colSpan: 2, render: renderTaskPriority },
      { key: "mode",     header: "Mode",     colSpan: 2, render: renderTaskMode },
      { key: "date",     header: "Date",     colSpan: 2, sortColumn: "date", render: renderTaskDate },
      { key: "actions",  header: "Actions",  colSpan: 2, render: renderReopenAction },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const priorityViewColumns: ColumnDef<Task>[] = useMemo(
    () => [
      { key: "name",    header: "Name",    colSpan: 4, render: renderTaskName },
      { key: "mode",    header: "Mode",    colSpan: 3, render: renderTaskMode },
      { key: "date",    header: "Date",    colSpan: 3, render: renderTaskDate },
      { key: "actions", header: "Actions", colSpan: 2, render: renderReopenAction },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const monthsViewColumns: ColumnDef<Task>[] = useMemo(
    () => [
      { key: "name",     header: "Name",     colSpan: 4, render: renderTaskName },
      { key: "priority", header: "Priority", colSpan: 2, render: renderTaskPriority },
      { key: "mode",     header: "Mode",     colSpan: 2, render: renderTaskMode },
      { key: "date",     header: "Date",     colSpan: 2, render: renderTaskDate },
      { key: "actions",  header: "Actions",  colSpan: 2, render: renderReopenAction },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const taskRowClass = (task: Task) => {
    const colors = getPriorityColor(task.priority);
    return `border-l-[3px] ${colors.border}`;
  };

  // ── Render ──

  return (
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
          items={completionTasks}
          columns={completionColumns}
          getItemKey={(t) => t.id}
          views={STANDARD_VIEWS.COMPLETION_MONTHS_PRIORITY}
          activeView={view}
          onViewChange={setView}
          yearFilter={{
            years: availableYears,
            selectedYear,
            onChange: setSelectedYear,
          }}
          sortState={sortState}
          onSortChange={setSortState}
          emptyMessage={`No tasks completed in ${selectedYear}.`}
          onRowClick={handleEditTask}
          rowClassName={taskRowClass}
          monthGroups={monthGroups}
          priorityGroups={priorityGroups}
          nowYear={nowYear}
          nowMonth={nowMonth}
          completionColumns={completionColumns}
          monthColumns={monthsViewColumns}
          priorityColumns={priorityViewColumns}
        />
      )}

      {taskModalTarget && (
        <TaskModal
          key={taskModalTarget.id}
          task={taskModalTarget}
          onClose={closeTaskModal}
          onSave={handleTaskSave}
          onDelete={handleTaskDelete}
        />
      )}
    </PageShell>
  );
}
