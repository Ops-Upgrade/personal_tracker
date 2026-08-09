"use client";

import { useCallback } from "react";
import type { Task } from "@/types/taskmanager";
import { createTask, updateTask, deleteTask } from "@/api/taskmanager";

interface UseTaskActionsParams {
  userId: string | null;
  refresh: () => Promise<void>;
}

/**
 * Shared hook for Task CRUD operations.
 * Consolidates ~50 lines of duplicated handleTaskSave/handleTaskDelete/
 * handleQuickComplete/handleReopen from TaskManagerView, taskmanager/all,
 * and taskmanager/completed pages.
 */
export function useTaskActions({ userId, refresh }: UseTaskActionsParams) {
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
      if (!userId) throw new Error("No active session.");
      const nowIso = new Date().toISOString();
      const completedAt = draft.is_completed
        ? existingTask?.completed_at ?? nowIso
        : null;

      const payload = {
        ...draft,
        completed_at: completedAt,
        updated_at: nowIso,
      };

      let savedTask: Task;
      if (existingTask) {
        savedTask = await updateTask(userId, existingTask.id, payload);
      } else {
        savedTask = await createTask(userId, payload);
      }

      await refresh();
      return savedTask;
    },
    [userId, refresh],
  );

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

  /** Schema-driven save adapter: formData → handleTaskSave (tasks have no file support) */
  const createSaveAdapter = useCallback(
    (existingTask: Task | null, onSuccess?: (saved: Task) => void) => {
      return async (formData: Record<string, unknown>) => {
        const name = (formData.name as string).trim();
        if (!name) throw new Error("Task name is required.");

        const saved = await handleTaskSave(
          {
            name,
            priority: formData.priority as Task["priority"],
            due_date: (formData.due_date as string) || null,
            mode: formData.mode as Task["mode"],
            description: (formData.description as string).trim(),
            is_completed: !!formData.is_completed,
          },
          existingTask,
        );

        onSuccess?.(saved);
      };
    },
    [handleTaskSave],
  );

  return { handleTaskSave, handleTaskDelete, handleToggleComplete, createSaveAdapter };
}
