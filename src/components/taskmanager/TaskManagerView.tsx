"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
 * Query-param-driven modals (?modal=new-task, ?modal=edit-task-<id>, ?modal=edit-note-<id>),
 * "View all" → dedicated routes.
 */
export default function TaskManagerView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modal = searchParams.get("modal");
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

  // --- Query-param-driven modal state (derived, not stored in useState) ---

  const taskModalTarget = useMemo<Task | "create" | null>(() => {
    if (modal === "new-task") return "create";
    if (modal?.startsWith("edit-task-")) {
      const taskId = modal.slice(10);
      return tasks.find((t) => t.id === taskId) ?? null;
    }
    return null;
  }, [modal, tasks]);

  const noteModalTarget = useMemo<Note | "create" | null>(() => {
    if (modal === "new-note") return "create";
    if (modal?.startsWith("edit-note-")) {
      const noteId = modal.slice(10);
      return notes.find((n) => n.id === noteId) ?? null;
    }
    return null;
  }, [modal, notes]);

  // --- Helpers to set query param from UI clicks ---

  const setModalParam = useCallback((value: string) => {
    router.replace(`?modal=${encodeURIComponent(value)}`, { scroll: false });
  }, [router]);

  const clearModalParam = useCallback(() => {
    router.replace(window.location.pathname, { scroll: false });
  }, [router]);

  const openNewTask = () => setModalParam("new-task");
  const openEditTask = (task: Task) => setModalParam(`edit-task-${task.id}`);
  const openEditNote = (note: Note) => setModalParam(`edit-note-${note.id}`);
  const openNewNote = () => setModalParam("new-note");

  const closeTaskModal = () => clearModalParam();
  const closeNoteModal = () => clearModalParam();

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
        <BackButton href={ROUTES.DASHBOARD} />
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

      {/* Query-param-driven modals */}
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
