"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/routes/paths";
import BackButton from "@/components/common/BackButton";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
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
import ErrorBanner from "@/components/common/ErrorBanner";
import type { Note, Task, TaskView } from "@/types/taskmanager";
import ActiveTasksBox from "./ActiveTasksBox";
import CompletedTasksBox from "./CompletedTasksBox";
import NoteModal from "./NoteModal";
import NotesBox from "./NotesBox";
import TaskModal from "./TaskModal";

/**
 * Task Manager feature shell.
 * Refactored: hash-driven modals (#new-task, #edit-<id>, #edit-note-<id>),
 * "View all" → dedicated routes.
 */
export default function TaskManagerView() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);

  const loadAllData = useCallback(async (uid: string) => {
    const [taskRows, noteRows] = await Promise.all([fetchTasks(uid), fetchNotes(uid)]);
    setTasks(taskRows);
    setNotes(noteRows);
  }, []);

  const { userId, istDate, nowYear, nowMonth, isLoading, error, refreshData } =
    useAuthBootstrap({ loadData: loadAllData });

  const [activeView, setActiveView] = useLocalStorage<TaskView>("taskManagerActiveView", "months");

  const [taskModalTarget, setTaskModalTarget] = useState<Task | "create" | null>(null);
  const [noteModalTarget, setNoteModalTarget] = useState<Note | "create" | null>(null);

  // --- Hash-driven modal triggers ---
  // Supported hashes: #new-task, #edit-<taskId>, #edit-note-<noteId>

  const clearHash = useCallback(() => {
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  // Hash change handler (does NOT call setState itself — returns the derived state)
  const resolveHashState = useCallback((raw: string, currentTasks: Task[], currentNotes: Note[]) => {
    if (raw === "new-task") {
      return { taskTarget: "create" as const, noteTarget: null };
    }
    if (raw.startsWith("edit-note-")) {
      const noteId = raw.slice(10);
      const note = currentNotes.find((n) => n.id === noteId);
      if (note) return { taskTarget: null, noteTarget: note };
    }
    if (raw.startsWith("edit-task-")) {
      const taskId = raw.slice(10);
      const task = currentTasks.find((t) => t.id === taskId);
      if (task) return { taskTarget: task, noteTarget: null };
    }
    return null;
  }, []);

  // Listen for hash changes
  useEffect(() => {
    const handler = () => {
      const raw = window.location.hash.replace("#", "");
      const resolved = resolveHashState(raw, tasks, notes);
      if (resolved) {
        if (resolved.taskTarget !== null) setTaskModalTarget(resolved.taskTarget);
        if (resolved.noteTarget !== null) setNoteModalTarget(resolved.noteTarget);
      }
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, [tasks, notes, resolveHashState]);

  // --- Helpers to set hash from UI clicks ---

  const openNewTask = () => {
    window.location.hash = "new-task";
  };

  const openEditTask = (task: Task) => {
    window.location.hash = `edit-task-${task.id}`;
  };

  const openEditNote = (note: Note) => {
    window.location.hash = `edit-note-${note.id}`;
  };

  const openNewNote = () => {
    setNoteModalTarget("create");
  };

  const closeTaskModal = () => {
    setTaskModalTarget(null);
    clearHash();
  };

  const closeNoteModal = () => {
    setNoteModalTarget(null);
    clearHash();
  };

  // --- Derived ---

  const activeTasks = useMemo(
    () => tasks.filter((task) => !task.is_completed),
    [tasks]
  );
  const completedTasks = useMemo(
    () => tasks.filter((task) => task.is_completed),
    [tasks]
  );

  // --- CRUD handlers ---

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

  // --- Render ---

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-start gap-4">
        <BackButton href={ROUTES.DASHBOARD}>← Back</BackButton>
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Task Manager
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Track active tasks, completed tasks, and notes.
          </p>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <ActiveTasksBox
          tasks={activeTasks}
          isLoading={isLoading}
          view={activeView}
          nowYear={nowYear}
          nowMonth={nowMonth}
          onViewChange={setActiveView}
          onAdd={openNewTask}
          onSelectTask={openEditTask}
          onMarkComplete={handleQuickComplete}
        />

        <div className="grid gap-4 lg:grid-rows-2">
          <CompletedTasksBox
            tasks={completedTasks}
            isLoading={isLoading}
            onOpenExpanded={() => router.push(ROUTES.TASK_MANAGER_COMPLETED)}
            onSelectTask={openEditTask}
            onReopenTask={handleQuickReopen}
          />

          <NotesBox
            notes={notes}
            isLoading={isLoading}
            onAdd={openNewNote}
            onOpenExpanded={() => router.push(ROUTES.TASK_MANAGER_NOTES)}
            onSelectNote={openEditNote}
          />
        </div>
      </section>

      {error && (
        <ErrorBanner
          message={error}
          onRetry={() => userId && refreshData(userId)}
        />
      )}

      {/* Hash-driven modals */}
      {taskModalTarget && (
        <TaskModal
          task={taskModalTarget === "create" ? null : taskModalTarget}
          defaultDate={taskModalTarget === "create" ? istDate : undefined}
          onClose={closeTaskModal}
          onSave={handleTaskSave}
          onDelete={handleTaskDelete}
        />
      )}

      {noteModalTarget && (
        <NoteModal
          note={noteModalTarget === "create" ? null : noteModalTarget}
          onClose={closeNoteModal}
          onSave={handleNoteSave}
          onDelete={handleNoteDelete}
        />
      )}
    </div>
  );
}
