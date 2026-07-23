"use client";

import { useCallback, useMemo, useState } from "react";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
import { deleteTask, fetchTasks, updateTask } from "@/api/taskmanager";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { ROUTES } from "@/routes/paths";
import type { Task, TaskView } from "@/types/taskmanager";
import { PRIORITIES } from "@/types/common";
import type { ViewToggleOption } from "@/components/common/ViewToggle";
import ViewToggle from "@/components/common/ViewToggle";
import YearDropdown from "@/components/common/YearDropdown";
import SortableHeader from "@/components/common/SortableHeader";
import type { SortState } from "@/components/common/SortableHeader";
import MonthTile from "@/components/common/MonthTile";
import BoxContainer, { SCROLLABLE_CLASSES } from "@/components/common/BoxContainer";
import PageShell from "@/components/common/PageShell";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import PriorityBadge from "@/components/common/PriorityBadge";
import {
  byPriority,
  completedByMonths,
  sortByCompletedDesc,
  formatShortDate,
  getPriorityColor,
  trunc,
} from "@/components/taskmanager/helpers";
import TaskModal from "@/components/taskmanager/TaskModal";
import { MONTH_NAMES } from "@/lib/constants";

const VIEW_OPTIONS: readonly ViewToggleOption<TaskView>[] = [
  { value: "completion", label: "Completion" },
  { value: "months", label: "Months" },
  { value: "priority", label: "Priority" },
];

export default function CompletedTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);

  const loadData = useCallback(async (uid: string) => {
    const rows = await fetchTasks(uid);
    setTasks(rows);
  }, []);

  const { userId, nowYear, nowMonth, isLoading, error, refreshData } =
    useAuthBootstrap({ loadData });

  const [view, setView] = useLocalStorage<TaskView>("taskManagerCompletedView", "completion");
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

  const priorityGroups = byPriority(tasksForYear);
  const monthGroups = completedByMonths(tasksForYear, selectedYear);

  // ── Handlers ──

  const handleEditTask = (task: Task) => {
    setTaskModalTarget(task);
  };

  const closeTaskModal = () => setTaskModalTarget(null);

  async function handleTaskSave(
    draft: {
      name: string;
      priority: Task["priority"];
      due_date: string | null;
      mode: Task["mode"];
      description: string;
      is_completed: boolean;
    },
    existingTask: Task | null
  ) {
    if (!userId || !existingTask) return;
    const nowIso = new Date().toISOString();
    const completedAt = draft.is_completed
      ? existingTask.completed_at ?? nowIso
      : null;

    await updateTask(userId, existingTask.id, {
      ...draft,
      completed_at: completedAt,
      updated_at: nowIso,
    });

    await refreshData(userId);
  }

  async function handleTaskDelete(taskId: string) {
    if (!userId) return;
    await deleteTask(taskId);
    await refreshData(userId);
  }

  const handleReopen = async (task: Task) => {
    if (!userId) return;
    const nowIso = new Date().toISOString();
    await updateTask(userId, task.id, {
      ...task,
      is_completed: false,
      completed_at: null,
      updated_at: nowIso,
    });
    await refreshData(userId);
  };

  // ── Column header styling ──

  const headerClasses =
    "grid w-full grid-cols-12 gap-2 px-2 pb-1 text-xs font-semibold text-zinc-500 uppercase tracking-wider mt-2";

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
        <BoxContainer>
          <header className="mb-3 flex items-center justify-between gap-3">
            <ViewToggle
              value={view}
              onChange={setView}
              options={VIEW_OPTIONS}
              ariaLabel="Completed tasks view toggle"
            />
            <YearDropdown
              years={availableYears}
              selectedYear={selectedYear}
              onChange={setSelectedYear}
            />
          </header>

          <div className={`${SCROLLABLE_CLASSES} space-y-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800`}>
            {completedTasks.length === 0 && (
              <div className="text-sm text-zinc-500 dark:text-zinc-400">None</div>
            )}

            {/* ── Completion View ── */}

            {view === "completion" && (
              <>
                <div className={headerClasses}>
                  <SortableHeader<"name" | "date">
                    as="div"
                    column="name"
                    label="Name"
                    sortState={sortState}
                    onSort={setSortState}
                    className="col-span-4"
                  />
                  <div className="col-span-2">Priority</div>
                  <div className="col-span-2">Mode</div>
                  <SortableHeader<"name" | "date">
                    as="div"
                    column="date"
                    label="Date"
                    sortState={sortState}
                    onSort={setSortState}
                    className="col-span-2"
                  />
                  <div className="col-span-2 text-right">Actions</div>
                </div>

                {completionTasks.length === 0 && (
                  <div className="text-sm text-zinc-500 dark:text-zinc-400 px-2">
                    No tasks completed in {selectedYear}.
                  </div>
                )}

                <div className="space-y-2">
                  {completionTasks.map((task) => {
                    const colors = getPriorityColor(task.priority);
                    return (
                      <div
                        key={task.id}
                        className={`grid w-full grid-cols-12 items-center gap-2 rounded-md border border-zinc-200 px-2 py-1.5 text-left text-sm dark:border-zinc-700 border-l-[3px] ${colors.border}`}
                      >
                        <button
                          type="button"
                          onClick={() => handleEditTask(task)}
                          className="col-span-4 cursor-pointer text-left font-semibold text-zinc-800 hover:text-zinc-900 dark:text-zinc-100 dark:hover:text-white"
                        >
                          {trunc(task.name, 42)}
                        </button>
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
                          <button
                            type="button"
                            onClick={() => handleReopen(task)}
                            className="cursor-pointer rounded-md border border-red-300 px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
                          >
                            Reopen
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── Priority View ── */}

            {view === "priority" &&
              PRIORITIES.map((priority) => {
                const group = [...(priorityGroups[priority] ?? [])].sort(sortByCompletedDesc);
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

                    <div className={headerClasses}>
                      <div className="col-span-4">Name</div>
                      <div className="col-span-3">Mode</div>
                      <div className="col-span-3">Date</div>
                      <div className="col-span-2 text-right">Actions</div>
                    </div>

                    <div className="space-y-2">
                      {group.map((task) => (
                        <div
                          key={task.id}
                          className={`grid w-full grid-cols-12 items-center gap-2 rounded-md border border-zinc-200 px-2 py-1.5 text-left text-sm dark:border-zinc-700 border-l-[3px] ${colors.border}`}
                        >
                          <button
                            type="button"
                            onClick={() => handleEditTask(task)}
                            className="col-span-4 cursor-pointer text-left font-semibold text-zinc-800 hover:text-zinc-900 dark:text-zinc-100 dark:hover:text-white"
                          >
                            {trunc(task.name, 42)}
                          </button>
                          <span className="col-span-3 text-xs capitalize text-zinc-500 dark:text-zinc-400 flex items-center">
                            {task.mode}
                          </span>
                          <span className="col-span-3 text-zinc-600 dark:text-zinc-300 flex items-center">
                            {formatShortDate(task.completed_at)}
                          </span>
                          <div className="col-span-2 flex justify-end items-center">
                            <button
                              type="button"
                              onClick={() => handleReopen(task)}
                              className="cursor-pointer rounded-md border border-red-300 px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
                            >
                              Reopen
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}

            {/* ── Months View ── */}

            {view === "months" &&
              monthGroups.map((group, index) => {
                const isCurrentMonth =
                  selectedYear === nowYear && MONTH_NAMES[nowMonth] === group.label;
                return (
                  <MonthTile
                    key={group.label}
                    title={group.label}
                    defaultExpanded={index === 0}
                    accent
                    className="text-sm"
                    highlight={isCurrentMonth}
                  >
                    <div className={headerClasses}>
                      <div className="col-span-4">Name</div>
                      <div className="col-span-2">Priority</div>
                      <div className="col-span-2">Mode</div>
                      <div className="col-span-2">Date</div>
                      <div className="col-span-2 text-right">Actions</div>
                    </div>

                    <div className="space-y-2">
                      {group.items.map((task) => {
                        const colors = getPriorityColor(task.priority);
                        return (
                          <div
                            key={task.id}
                            className={`grid w-full grid-cols-12 items-center gap-2 rounded-md border border-zinc-200 px-2 py-1.5 text-left text-sm dark:border-zinc-700 border-l-[3px] ${colors.border}`}
                          >
                            <button
                              type="button"
                              onClick={() => handleEditTask(task)}
                              className="col-span-4 cursor-pointer text-left font-semibold text-zinc-800 hover:text-zinc-900 dark:text-zinc-100 dark:hover:text-white"
                            >
                              {trunc(task.name, 42)}
                            </button>
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
                              <button
                                type="button"
                                onClick={() => handleReopen(task)}
                                className="cursor-pointer rounded-md border border-red-300 px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
                              >
                                Reopen
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </MonthTile>
                );
              })}
          </div>
        </BoxContainer>
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
