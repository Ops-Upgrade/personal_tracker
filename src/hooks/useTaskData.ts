"use client";

import { useState, useCallback } from "react";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
import { fetchTasks, fetchNotes } from "@/api/taskmanager";
import { fetchDocuments } from "@/api/common/documents";
import type { Task, Note } from "@/types/taskmanager";
import type { Document } from "@/types/document";

interface UseTaskDataOptions {
  includeNotes?: boolean;
  includeDocuments?: boolean;
}

/**
 * Shared data-fetching hook for Task Manager pages.
 * Wraps the useAuthBootstrap + useState + Promise.all boilerplate
 * duplicated across TaskManagerView, taskmanager/all, and taskmanager/completed.
 */
export function useTaskData(options?: UseTaskDataOptions) {
  const { includeNotes = false, includeDocuments = false } = options ?? {};

  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  const loadData = useCallback(
    async (uid: string) => {
      const fetchers: Promise<unknown>[] = [fetchTasks(uid)];
      if (includeNotes) fetchers.push(fetchNotes(uid));
      if (includeDocuments) fetchers.push(fetchDocuments(uid));

      const results = await Promise.all(fetchers);
      let idx = 0;
      setTasks(results[idx++] as Task[]);
      if (includeNotes) setNotes(results[idx++] as Note[]);
      if (includeDocuments) setDocuments(results[idx++] as Document[]);
    },
    [includeNotes, includeDocuments],
  );

  const { userId, istDate, nowYear, nowMonth, isLoading, error, refreshData } =
    useAuthBootstrap({ loadData });

  // Always return notes and documents (as empty arrays when not fetched)
  // to avoid conditional type gymnastics.
  return {
    userId,
    istDate,
    nowYear,
    nowMonth,
    isLoading,
    error,
    refreshData,
    tasks,
    notes,
    documents,
  };
}
