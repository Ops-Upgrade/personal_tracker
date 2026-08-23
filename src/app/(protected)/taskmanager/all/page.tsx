"use client";

import { useCallback, useState } from "react";
import { useTaskData } from "@/hooks/useTaskData";
import { ROUTES } from "@/routes/paths";
import type { Task } from "@/types/taskmanager";
import PageShell from "@/components/common/PageShell";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import GenericViewPage from "@/components/common/GenericViewPage";
import { useTaskActions } from "@/hooks/useTaskActions";
import { TASK_COLUMNS, TASK_FIELDS, TASK_LAYOUT } from "@/components/taskmanager/config";
import GenericDomainModal from "@/components/common/GenericDomainModal";

export default function TaskManagerAllPage() {
  const { userId, nowYear, nowMonth, isLoading, error, refreshData, tasks } = useTaskData();

  const [modalTarget, setModalTarget] = useState<Task | null>(null);

  const closeModal = () => setModalTarget(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    await refreshData(userId);
  }, [userId, refreshData]);

  const { handleTaskDelete } = useTaskActions({ userId, refresh });

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
            data={tasks}
            columns={TASK_COLUMNS}
            getItemKey={(t) => t.id}
            cacheKeyPrefix="taskmanager_all"
            defaultSort={{ column: "due_date", direction: "asc" }}
            supportedViews={["all", "months", "priority"]}
            getDateKey={(t) => t.due_date}
            getPriorityKey={(t) => t.priority}
            itemNamePlural="tasks"
            onRowClick={(t) => setModalTarget(t)}
            onBulkDelete={async (ids, clearFn) => {
              for (const id of ids) await handleTaskDelete(id);
              clearFn();
            }}
            nowYear={nowYear ?? undefined}
            nowMonth={nowMonth ?? undefined}
          />
        )}
      </PageShell>

      {modalTarget && userId && (
        <GenericDomainModal
          mode="record"
          domain="taskmanager"
          target={{
            type: "record",
            id: modalTarget.id,
            data: modalTarget as unknown as Record<string, unknown>,
          }}
          fields={TASK_FIELDS}
          layout={TASK_LAYOUT}
          onClose={closeModal}
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
