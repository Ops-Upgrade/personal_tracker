"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { getSession } from "@/api/auth";
import { getServerYear } from "@/api/serverYear";
import {
  createNote,
  createTask,
  deleteNote,
  deleteTask,
  fetchNotes,
  fetchTasks,
  updateNote,
  updateTask,
} from "@/api/taskmanager";
import Button from "@/components/common/Button";
import type { Note, Task, TaskView } from "@/types/taskmanager";
import ActiveTasksBox from "./ActiveTasksBox";
import CompletedTasksBox from "./CompletedTasksBox";
import CompletedTasksModal from "./CompletedTasksModal";
import NoteModal from "./NoteModal";
import NotesBox from "./NotesBox";
import NotesModal from "./NotesModal";
import TaskModal from "./TaskModal";

/**
 * Task Manager feature shell.
 * Phases 1.5-1.8: active/completed/notes boxes, modals, view toggles, and CRUD wiring.
 */
export default function TaskManagerView() {
  const [userId, setUserId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowYear, setNowYear] = useState<number>(new Date().getFullYear());

  const [activeView, setActiveView] = useLocalStorage<TaskView>("taskManagerActiveView", "months");
  const [completedView, setCompletedView] = useLocalStorage<TaskView>("taskManagerCompletedView", "months");
  const [expandedModal, setExpandedModal] = useState<"completed" | "notes" | null>(
    null
  );

  const [taskModalTarget, setTaskModalTarget] = useState<Task | "create" | null>(null);
  const [noteModalTarget, setNoteModalTarget] = useState<Note | "create" | null>(null);

  const activeTasks = useMemo(
    () => tasks.filter((task) => !task.is_completed),
    [tasks]
  );
  const completedTasks = useMemo(
    () => tasks.filter((task) => task.is_completed),
    [tasks]
  );

  const syncExpandedModalFromHash = useCallback(() => {
    const rawHash = window.location.hash.replace("#", "");
    if (rawHash === "completed" || rawHash === "notes") {
      setExpandedModal(rawHash);
      return;
    }
    setExpandedModal(null);
  }, []);

  const closeExpandedModal = useCallback(() => {
    if (!window.location.hash) {
      setExpandedModal(null);
      return;
    }
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`
    );
    setExpandedModal(null);
  }, []);

  const openExpandedModal = useCallback((kind: "completed" | "notes") => {
    window.location.hash = kind;
  }, []);

  const loadAllData = useCallback(async (uid: string) => {
    const [taskRows, noteRows] = await Promise.all([fetchTasks(uid), fetchNotes(uid)]);
    setTasks(taskRows);
    setNotes(noteRows);
  }, []);

  const refreshData = useCallback(
    async (uid: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await loadAllData(uid);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to refresh task manager data.");
      } finally {
        setIsLoading(false);
      }
    },
    [loadAllData]
  );

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const [session, serverYear] = await Promise.all([
          getSession(),
          getServerYear(),
        ]);
        const uid = session?.user.id;
        if (!uid) throw new Error("No active session.");
        if (cancelled) return;
        setUserId(uid);
        setNowYear(serverYear);
        await refreshData(uid);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load task manager data."
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [refreshData]);

  useEffect(() => {
    syncExpandedModalFromHash();
    window.addEventListener("hashchange", syncExpandedModalFromHash);
    return () => {
      window.removeEventListener("hashchange", syncExpandedModalFromHash);
    };
  }, [syncExpandedModalFromHash]);

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

    if (existingTask) {
      await updateTask(userId, existingTask.id, payload);
    } else {
      await createTask(userId, payload);
    }

    await refreshData(userId);
  }

  async function handleTaskDelete(taskId: string) {
    if (!userId) throw new Error("No active session.");
    await deleteTask(taskId);
    await refreshData(userId);
  }

  async function handleQuickComplete(task: Task) {
    if (!userId) throw new Error("No active session.");
    const nowIso = new Date().toISOString();
    await updateTask(userId, task.id, {
      ...task,
      is_completed: true,
      completed_at: nowIso,
      updated_at: nowIso,
    });
    await refreshData(userId);
  }

  async function handleQuickReopen(task: Task) {
    if (!userId) throw new Error("No active session.");
    const nowIso = new Date().toISOString();
    await updateTask(userId, task.id, {
      ...task,
      is_completed: false,
      completed_at: null,
      updated_at: nowIso,
    });
    await refreshData(userId);
  }

  async function handleNoteSave(content: string, existingNote: Note | null) {
    if (!userId) throw new Error("No active session.");
    const payload = {
      content,
      updated_at: new Date().toISOString(),
    };

    if (existingNote) {
      await updateNote(userId, existingNote.id, payload);
    } else {
      await createNote(userId, payload);
    }

    await refreshData(userId);
  }

  async function handleNoteDelete(noteId: string) {
    if (!userId) throw new Error("No active session.");
    await deleteNote(noteId);
    await refreshData(userId);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Task Manager
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Track active tasks, completed tasks, and notes.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <ActiveTasksBox
          tasks={activeTasks}
          isLoading={isLoading}
          view={activeView}
          nowYear={nowYear}
          onViewChange={setActiveView}
          onAdd={() => setTaskModalTarget("create")}
          onSelectTask={(task) => setTaskModalTarget(task)}
          onMarkComplete={handleQuickComplete}
        />

        <div className="grid gap-4 lg:grid-rows-2">
          <CompletedTasksBox
            tasks={completedTasks}
            isLoading={isLoading}
            onOpenExpanded={() => openExpandedModal("completed")}
            onSelectTask={(task) => setTaskModalTarget(task)}
            onReopenTask={handleQuickReopen}
          />

          <NotesBox
            notes={notes}
            isLoading={isLoading}
            onAdd={() => setNoteModalTarget("create")}
            onOpenExpanded={() => openExpandedModal("notes")}
            onSelectNote={(note) => setNoteModalTarget(note)}
          />
        </div>
      </section>

      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <span>{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => userId && refreshData(userId)}
            className="border border-red-300 hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-900/40"
          >
            Retry
          </Button>
        </div>
      )}

      {expandedModal === "completed" && (
        <CompletedTasksModal
          tasks={completedTasks}
          view={completedView}
          nowYear={nowYear}
          onViewChange={setCompletedView}
          onClose={closeExpandedModal}
          onSelectTask={(task) => {
            closeExpandedModal();
            setTaskModalTarget(task);
          }}
          onReopenTask={handleQuickReopen}
        />
      )}

      {expandedModal === "notes" && (
        <NotesModal
          notes={notes}
          onClose={closeExpandedModal}
          onSelectNote={(note) => {
            closeExpandedModal();
            setNoteModalTarget(note);
          }}
        />
      )}

      {taskModalTarget && (
        <TaskModal
          task={taskModalTarget === "create" ? null : taskModalTarget}
          onClose={() => setTaskModalTarget(null)}
          onSave={handleTaskSave}
          onDelete={handleTaskDelete}
        />
      )}

      {noteModalTarget && (
        <NoteModal
          note={noteModalTarget === "create" ? null : noteModalTarget}
          onClose={() => setNoteModalTarget(null)}
          onSave={handleNoteSave}
          onDelete={handleNoteDelete}
        />
      )}
    </div>
  );
}
