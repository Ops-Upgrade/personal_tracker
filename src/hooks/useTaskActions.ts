"use client";

import { useCallback } from "react";
import type { Task } from "@/types/taskmanager";
import { deleteTask, updateTask } from "@/api/taskmanager";

interface UseTaskActionsParams {
  userId: string | null;
  refresh: () => Promise<void>;
}

/**
 * Shared hook for Task delete + quick-complete operations.
 * Task create/edit is owned by GenericDomainModal's taskmanager domain
 * config (see modalDomainConfig.ts).
 */
export function useTaskActions({ userId, refresh }: UseTaskActionsParams) {
  const handleTaskDelete = useCallback(
    async (taskId: string) => {
      if (!userId) throw new Error("No active session.");
      await deleteTask(taskId);
      await refresh();
    },
    [userId, refresh],
  );

  /** Toggle is_completed on a task (used for Quick Complete and Reopen). */
  const handleToggleComplete = useCallback(
    async (task: Task, isCompleted: boolean) => {
      if (!userId) throw new Error("No active session.");
      const nowIso = new Date().toISOString();
      await updateTask(userId, task.id, {
        ...task,
        is_completed: isCompleted,
        completed_at: isCompleted ? nowIso : null,
        updated_at: nowIso,
      });
      await refresh();
    },
    [userId, refresh],
  );

  return { handleTaskDelete, handleToggleComplete };
}
