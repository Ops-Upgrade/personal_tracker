"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/routes/paths";
import { FolderIcon } from "@/components/common/Icons";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useQueryModal } from "@/lib/useQueryModal";
import { useTaskData } from "@/hooks/useTaskData";
import GenericDomainPage from "@/components/common/GenericDomainPage";
import type { DomainPageContext } from "@/components/common/GenericDomainPage";
import type { Note, Task, TaskView } from "@/types/taskmanager";
import { useNoteActions } from "@/hooks/useNoteActions";
import { useTaskActions } from "@/hooks/useTaskActions";
import { getUnifiedNotes } from "./helpers";
import ActiveTasksBox from "./ActiveTasksBox";
import CompletedTasksBox from "./CompletedTasksBox";
import NoteModal from "./NoteModal";
import NotesBox from "./NotesBox";
import TaskModal from "./TaskModal";

/**
 * Task Manager feature shell.
 * Query-param-driven modals via useQueryModal ("task" and "note" prefixes).
 * Layout shell delegated to GenericDomainPage (dual-column).
 */
export default function TaskManagerView() {
  const router = useRouter();
  const { userId, istDate, nowYear, nowMonth, isLoading, error, refreshData, tasks, notes, documents } = useTaskData({ includeNotes: true, includeDocuments: true });

  const [activeView, setActiveView] = useLocalStorage<TaskView>("taskManagerActiveView", "months");

  // ── Derived data ──

  const activeTasks = useMemo(
    () => tasks.filter((task) => !task.is_completed),
    [tasks],
  );
  const completedTasks = useMemo(
    () => tasks.filter((task) => task.is_completed),
    [tasks],
  );
  const unifiedNotes = useMemo(
    () => getUnifiedNotes(notes, documents),
    [notes, documents],
  );

  // ── Query-param-driven modals ──

  const {
    modalTarget: taskModalTarget,
    openCreate: openNewTask,
    openEdit: openEditTask,
    closeModal: closeTaskModal,
  } = useQueryModal(activeTasks, "task");

  const {
    modalTarget: noteModalTarget,
    openCreate: openNewNote,
    openEdit: openEditNote,
    closeModal: closeNoteModal,
  } = useQueryModal(notes, "note");

  // ── CRUD handlers (shared via useTaskActions) ──

  const refresh = useCallback(async () => {
    if (!userId) return;
    await refreshData(userId);
  }, [userId, refreshData]);

  const { handleTaskSave: rawHandleTaskSave, handleTaskDelete, handleToggleComplete } =
    useTaskActions({ userId, refresh });

  // Wrapper that transitions from "create-task" to "edit-task-<id>" after creation
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
      const savedTask = await rawHandleTaskSave(draft, existingTask);
      if (!existingTask && savedTask) {
        openEditTask(savedTask);
      }
    },
    [rawHandleTaskSave, openEditTask],
  );

  const { handleNoteSave: rawHandleNoteSave, handleNoteDelete, handleDownloadDocument } =
    useNoteActions({
      userId,
      refresh: async () => {
        if (userId) await refreshData(userId);
      },
    });

  // Wrapper that transitions from "new-note" to "edit-note-<id>" after creation
  const handleNoteSave = useCallback(
    async (
      draft: { name: string; content: string },
      existingNote: Note | null,
      pendingDoc?: { file: File; label: string },
      pendingLinkDocId?: string,
      pendingUnlinkDocIds?: string[],
      pendingDeleteDocIds?: string[],
    ) => {
      const savedNote = await rawHandleNoteSave(
        draft,
        existingNote,
        pendingDoc,
        pendingLinkDocId,
        pendingUnlinkDocIds,
        pendingDeleteDocIds,
      );
      if (!existingNote && savedNote) {
        openEditNote(savedNote);
      }
    },
    [rawHandleNoteSave, openEditNote],
  );

  // ── Context for GenericDomainPage ──

  const ctx: DomainPageContext = useMemo(
    () => ({ userId, istDate, nowYear, nowMonth, isLoading, error, refreshData }),
    [userId, istDate, nowYear, nowMonth, isLoading, error, refreshData],
  );

  // ── Render ──

  return (
    <GenericDomainPage
      ctx={ctx}
      title="Task Manager"
      description="Track active tasks, completed tasks, and notes."
      backHref={ROUTES.DASHBOARD}
      completedSlot={
        <CompletedTasksBox
          tasks={completedTasks}
          isLoading={isLoading}
          onOpenExpanded={() => router.push(ROUTES.TASK_MANAGER_COMPLETED)}
          onSelectTask={openEditTask}
          onReopenTask={(task: Task) => handleToggleComplete(task, false)}
        />
      }
      miscSlot={
        <div className="flex flex-col gap-4 h-full">
          <Link
            href={ROUTES.TASK_MANAGER_STORE}
            className="flex items-center justify-center gap-2 w-full rounded-xl border border-zinc-200 bg-white p-4 shadow-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800/80 transition-colors"
          >
            <FolderIcon className="h-5 w-5 text-blue-500" />
            Notes Store
          </Link>
          <NotesBox
            items={unifiedNotes}
            isLoading={isLoading}
            onAdd={openNewNote}
            onOpenExpanded={() => router.push(ROUTES.TASK_MANAGER_NOTES)}
            onSelectNote={(item) => openEditNote(item.data)}
            onSelectDocument={(doc) =>
              router.push(
                `${ROUTES.TASK_MANAGER_STORE}#edit-document-${doc.id}`,
              )
            }
          />
        </div>
      }
      modalSlot={
        <>
          {taskModalTarget && (
            <TaskModal
              key={taskModalTarget === "create" ? "create" : taskModalTarget.id}
              task={taskModalTarget === "create" ? null : taskModalTarget}
              defaultDate={taskModalTarget === "create" ? istDate : undefined}
              onClose={closeTaskModal}
              onSave={handleTaskSave}
              onDelete={handleTaskDelete}
            />
          )}
          {noteModalTarget && userId && (
            <NoteModal
              key={noteModalTarget === "create" ? "create" : noteModalTarget.id}
              note={noteModalTarget === "create" ? null : noteModalTarget}
              documents={documents}
              userId={userId}
              onClose={closeNoteModal}
              onSave={handleNoteSave}
              onDelete={handleNoteDelete}
              onDownloadDocument={handleDownloadDocument}
            />
          )}
        </>
      }
      renderBody={(pageCtx) => (
        <ActiveTasksBox
          tasks={activeTasks}
          isLoading={pageCtx.isLoading}
          view={activeView}
          nowYear={pageCtx.nowYear}
          nowMonth={pageCtx.nowMonth}
          onViewChange={setActiveView}
          onAdd={openNewTask}
          onSelectTask={openEditTask}
          onMarkComplete={(task: Task) => handleToggleComplete(task, true)}
        />
      )}
    />
  );
}
