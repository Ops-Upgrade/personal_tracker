"use client";

import { useState, useCallback } from "react";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
import { fetchTasks } from "@/api/taskmanager";
import { fetchDocuments } from "@/api/common/documents";
import type { Task } from "@/types/taskmanager";
import type { Document } from "@/types/document";

interface UseTaskDataOptions {
  includeDocuments?: boolean;
}

/**
 * Shared data-fetching hook for Task Manager pages.
 * Wraps the useAuthBootstrap + useState + Promise.all boilerplate
 * duplicated across TaskManagerView, taskmanager/all, and taskmanager/completed.
 */
export function useTaskData(options?: UseTaskDataOptions) {
  const { includeDocuments = false } = options ?? {};

  const [tasks, setTasks] = useState<Task[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  const loadData = useCallback(
    async (uid: string) => {
      const fetchers: Promise<unknown>[] = [fetchTasks(uid)];
      if (includeDocuments) fetchers.push(fetchDocuments(uid));

      const results = await Promise.all(fetchers);
      let idx = 0;
      setTasks(results[idx++] as Task[]);
      if (includeDocuments) setDocuments(results[idx++] as Document[]);
    },
    [includeDocuments],
  );

  const { userId, istDate, nowYear, nowMonth, isLoading, error, refreshData } =
    useAuthBootstrap({ loadData });

  return {
    userId,
    istDate,
    nowYear,
    nowMonth,
    isLoading,
    error,
    refreshData,
    tasks,
    documents,
  };
}
