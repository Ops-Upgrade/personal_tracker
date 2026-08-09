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
import GenericDomainModal, { type FieldDef } from "@/components/common/GenericDomainModal";
import type { DomainPageContext } from "@/components/common/GenericDomainPage";
import type { Task, TaskView } from "@/types/taskmanager";
import { useNoteActions } from "@/hooks/useNoteActions";
import { useTaskActions } from "@/hooks/useTaskActions";
import { getUnifiedNotes } from "./helpers";
import ActiveTasksBox from "./ActiveTasksBox";
import CompletedTasksBox from "./CompletedTasksBox";
import NotesBox from "./NotesBox";

const TASK_FIELDS: FieldDef[] = [
  { key: "name", type: "text", label: "Task Name" },
  { key: "priority", type: "select", label: "Priority", options: [
    { value: "low", label: "Low" }, { value: "medium", label: "Medium" },
    { value: "high", label: "High" }, { value: "critical", label: "Critical" },
  ]},
  { key: "due_date", type: "date", label: "Due Date" },
  { key: "mode", type: "select", label: "Mode", options: [
    { value: "online", label: "Online" }, { value: "offline", label: "Offline" },
  ]},
  { key: "description", type: "richtext", label: "Task Description", minHeight: "8rem" },
  { key: "is_completed", type: "checkbox", label: "Mark complete" },
];

const TASK_LAYOUT: string[][] = [["name"], ["priority", "due_date", "mode"], ["description"], ["is_completed"]];

const NOTE_FIELDS: FieldDef[] = [
  { key: "name", type: "text", label: "Name", placeholder: "Note title" },
  { key: "content", type: "richtext", label: "Content", minHeight: "10rem" },
];

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
  } = useQueryModal(tasks, "task");

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

  const { createSaveAdapter: createTaskSaveAdapter, handleTaskDelete, handleToggleComplete } =
    useTaskActions({ userId, refresh });

  const { createSaveAdapter: createNoteSaveAdapter, handleNoteDelete, handleDownloadDocument } =
    useNoteActions({
      userId,
      refresh: async () => {
        if (userId) await refreshData(userId);
      },
    });

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
            <GenericDomainModal
              key={taskModalTarget === "create" ? "create" : taskModalTarget.id}
              mode="record"
              title={taskModalTarget === "create" ? "Add task" : "Edit task"}
              onClose={closeTaskModal}
              fields={TASK_FIELDS}
              layout={TASK_LAYOUT}
              initialData={{
                name: taskModalTarget === "create" ? "" : taskModalTarget.name,
                priority: taskModalTarget === "create" ? "medium" : taskModalTarget.priority,
                due_date: taskModalTarget === "create" ? (istDate ?? "") : (taskModalTarget.due_date ?? ""),
                mode: taskModalTarget === "create" ? "online" : taskModalTarget.mode,
                description: taskModalTarget === "create" ? "" : taskModalTarget.description,
                is_completed: taskModalTarget === "create" ? false : taskModalTarget.is_completed,
              }}
              onSave={createTaskSaveAdapter(
                taskModalTarget === "create" ? null : taskModalTarget,
                taskModalTarget === "create"
                  ? (saved) => openEditTask(saved)
                  : undefined,
              )}
              onDelete={
                taskModalTarget !== "create"
                  ? async () => { await handleTaskDelete(taskModalTarget.id); }
                  : undefined
              }
              deleteLabel="Delete"
              maxWidthClassName="max-w-lg"
            />
          )}
          {noteModalTarget && userId && (
            <GenericDomainModal
              key={noteModalTarget === "create" ? "create" : noteModalTarget.id}
              mode="record"
              title={noteModalTarget === "create" ? "Add note" : "Edit note"}
              onClose={closeNoteModal}
              fields={NOTE_FIELDS}
              initialData={{
                name: noteModalTarget === "create" ? "" : noteModalTarget.name,
                content: noteModalTarget === "create" ? "" : noteModalTarget.content,
              }}
              allowFiles
              userId={userId}
              attachedDocuments={
                noteModalTarget !== "create"
                  ? documents.filter((d) => d.domain === "taskmanager" && d.linked_id === noteModalTarget.id)
                  : []
              }
              standaloneDocuments={documents.filter((d) => d.domain === "taskmanager" && !d.linked_id)}
              domain="taskmanager"
              onSave={createNoteSaveAdapter(
                noteModalTarget === "create" ? null : noteModalTarget,
                noteModalTarget === "create"
                  ? (saved) => openEditNote(saved)
                  : undefined,
              )}
              onDeleteWithCascade={
                noteModalTarget !== "create"
                  ? async (cascadeMode) => { await handleNoteDelete(noteModalTarget.id, cascadeMode); }
                  : undefined
              }
              deleteLabel="Delete"
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
