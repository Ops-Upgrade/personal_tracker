"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTaskData } from "@/hooks/useTaskData";
import { ROUTES } from "@/routes/paths";
import type { Task } from "@/types/taskmanager";
import PageShell from "@/components/common/PageShell";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import GenericViewPage, { STANDARD_VIEWS } from "@/components/common/GenericViewPage";
import type { MonthGroup } from "@/components/common/GenericViewPage";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useTableSort } from "@/hooks/useTableSort";
import { useTaskActions } from "@/hooks/useTaskActions";
import { byDueMonth } from "@/lib/viewHelpers";
import { TASK_COLUMNS, SORT_CONFIGS } from "@/components/taskmanager/config";
import TaskModal from "@/components/taskmanager/TaskModal";

export default function TaskManagerAllPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { userId, istDate, nowYear, nowMonth, isLoading, error, refreshData, tasks } = useTaskData();

  // ── Year / Month filter state from URL params ──

  const urlYear = searchParams.get("year");
  const urlMonth = searchParams.get("month");

  const initialYear = urlYear ? Number(urlYear) : nowYear || new Date().getFullYear();
  const initialMonth = urlMonth ? Number(urlMonth) : ("all" as const);

  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedMonth, setSelectedMonth] = useState<number | "all">(initialMonth);
  const [activeView, setActiveView] = useLocalStorage<string>("taskAllView", "all");

  // ── Derived data ──

  const availableYears = useMemo(() => {
    const currentYear = nowYear || new Date().getFullYear();
    const yearsFromData = new Set(
      tasks.filter((t) => t.due_date).map((t) => new Date(t.due_date!).getFullYear()),
    );
    yearsFromData.add(currentYear);
    return Array.from(yearsFromData).sort((a, b) => b - a);
  }, [tasks, nowYear]);

  const availableMonths = useMemo(() => {
    const months = new Set<number>();
    for (const t of tasks) {
      if (!t.due_date) continue;
      const d = new Date(t.due_date + "T00:00:00");
      if (d.getFullYear() === selectedYear) {
        months.add(d.getMonth());
      }
    }
    return Array.from(months).sort((a, b) => a - b);
  }, [tasks, selectedYear]);

  const tasksForYear = useMemo(
    () =>
      tasks.filter((t) => {
        if (!t.due_date) return selectedMonth === "all";
        return new Date(t.due_date + "T00:00:00").getFullYear() === selectedYear;
      }),
    [tasks, selectedYear, selectedMonth],
  );

  const tasksForMonth = useMemo(
    () =>
      selectedMonth === "all"
        ? tasksForYear
        : tasksForYear.filter((t) => {
            if (!t.due_date) return false;
            return new Date(t.due_date + "T00:00:00").getMonth() === selectedMonth;
          }),
    [tasksForYear, selectedMonth],
  );

  const monthGroups: MonthGroup<Task>[] = useMemo(
    () => byDueMonth(tasksForYear, selectedYear),
    [tasksForYear, selectedYear],
  );

  // ── Sort ──

  const { sortState, handleSort, sorted } = useTableSort(
    "taskAllSortState",
    tasksForMonth,
    SORT_CONFIGS,
  );

  // ── Modal state ──

  const [modalTarget, setModalTarget] = useState<Task | null>(null);

  const closeModal = () => setModalTarget(null);

  // ── CRUD handlers (shared via useTaskActions) ──

  const refresh = useCallback(async () => {
    if (!userId) return;
    await refreshData(userId);
  }, [userId, refreshData]);

  const { handleTaskSave: rawHandleTaskSave, handleTaskDelete } =
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

  const emptyMessage =
    selectedMonth === "all"
      ? `No tasks found in ${selectedYear}.`
      : `No tasks found in ${selectedYear} for the selected month.`;

  // ── Render ──

  return (
    <>
      <PageShell
        backHref={ROUTES.TASK_MANAGER}
        title="All Tasks"
        description="Browse all your tasks by year and month."
        error={error}
        onRetry={() => userId && refreshData(userId)}
      >
        {isLoading && <LoadingSpinner />}

        {!isLoading && (
          <GenericViewPage
            items={sorted}
            columns={TASK_COLUMNS}
            getItemKey={(t) => t.id}
            views={STANDARD_VIEWS.ALL_MONTHS}
            activeView={activeView}
            onViewChange={setActiveView}
            yearFilter={{
              years: availableYears,
              selectedYear,
              onChange: (year) => {
                setSelectedYear(year);
                setSelectedMonth("all");
                router.replace(
                  `${ROUTES.TASK_MANAGER_ALL}?year=${year}`,
                  { scroll: false },
                );
              },
            }}
            monthFilter={{
              months: availableMonths,
              selectedMonth,
              onChange: (month) => {
                setSelectedMonth(month);
                const params = new URLSearchParams();
                params.set("year", String(selectedYear));
                if (month !== "all") params.set("month", String(month));
                router.replace(
                  `${ROUTES.TASK_MANAGER_ALL}?${params.toString()}`,
                  { scroll: false },
                );
              },
            }}
            sortState={sortState}
            onSortChange={handleSort}
            emptyMessage={emptyMessage}
            onRowClick={(t) => setModalTarget(t)}
            monthGroups={monthGroups}
            nowYear={nowYear ?? new Date().getFullYear()}
            nowMonth={nowMonth ?? new Date().getMonth()}
          />
        )}
      </PageShell>

      {modalTarget && userId && (
        <TaskModal
          key={modalTarget.id}
          task={modalTarget}
          defaultDate={istDate}
          onClose={closeModal}
          onSave={handleTaskSave}
          onDelete={handleTaskDelete}
        />
      )}
    </>
  );
}
