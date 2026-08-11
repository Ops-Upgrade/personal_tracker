"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTaskData } from "@/hooks/useTaskData";
import { ROUTES } from "@/routes/paths";
import type { Task } from "@/types/taskmanager";
import PageShell from "@/components/common/PageShell";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import GenericViewPage, { STANDARD_VIEWS } from "@/components/common/GenericViewPage";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useTableSort } from "@/hooks/useTableSort";
import { useTaskActions } from "@/hooks/useTaskActions";
import { TASK_COLUMNS, SORT_CONFIGS } from "@/components/taskmanager/config";
import GenericDomainModal, { type FieldDef } from "@/components/common/GenericDomainModal";

const TASK_FIELDS: FieldDef[] = [
  { key: "name", type: "text", label: "Task Name" },
  {
    key: "priority",
    type: "select",
    label: "Priority",
    options: [
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
      { value: "critical", label: "Critical" },
    ],
  },
  { key: "due_date", type: "date", label: "Due Date" },
  {
    key: "mode",
    type: "select",
    label: "Mode",
    options: [
      { value: "online", label: "Online" },
      { value: "offline", label: "Offline" },
    ],
  },
  {
    key: "description",
    type: "richtext",
    label: "Task Description",
    minHeight: "8rem",
  },
  { key: "is_completed", type: "checkbox", label: "Mark complete" },
];

// Every field must appear in the layout (GenericDomainModal only renders listed rows).
const TASK_LAYOUT: string[][] = [
  ["name"],
  ["priority", "due_date", "mode"],
  ["description"],
  ["is_completed"],
];

export default function TaskManagerAllPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { userId, nowYear, nowMonth, isLoading, error, refreshData, tasks } = useTaskData();

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

  const { createSaveAdapter, handleTaskDelete } =
    useTaskActions({ userId, refresh });

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
            views={STANDARD_VIEWS.ALL_ONLY}
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
            nowYear={nowYear ?? new Date().getFullYear()}
            nowMonth={nowMonth ?? new Date().getMonth()}
          />
        )}
      </PageShell>

      {modalTarget && userId && (
        <GenericDomainModal
          key={modalTarget.id}
          mode="record"
          title="Edit task"
          onClose={closeModal}
          fields={TASK_FIELDS}
          layout={TASK_LAYOUT}
          initialData={{
            name: modalTarget.name,
            priority: modalTarget.priority,
            due_date: modalTarget.due_date ?? "",
            mode: modalTarget.mode,
            description: modalTarget.description,
            is_completed: modalTarget.is_completed,
          }}
          onSave={createSaveAdapter(modalTarget)}
          onDelete={() => handleTaskDelete(modalTarget.id)}
          deleteLabel="Delete"
          maxWidthClassName="max-w-lg"
        />
      )}
    </>
  );
}
