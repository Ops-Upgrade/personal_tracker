"use client";

import { useEffect, useState } from "react";
import type { Priority, Task, TaskMode } from "@/types/taskmanager";
import ConfirmDialog from "./ConfirmDialog";
import ModalFrame from "./ModalFrame";

interface TaskDraft {
  name: string;
  priority: Priority;
  due_date: string | null;
  mode: TaskMode;
  description: string;
  is_completed: boolean;
}

interface TaskModalProps {
  task: Task | null;
  onClose: () => void;
  onSave: (draft: TaskDraft, existingTask: Task | null) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
}

const PRIORITY_OPTIONS: Priority[] = ["low", "medium", "high", "critical"];

export default function TaskModal({ task, onClose, onSave, onDelete }: TaskModalProps) {
  const [name, setName] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [mode, setMode] = useState<TaskMode>("online");
  const [description, setDescription] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(task?.name ?? "");
    setPriority(task?.priority ?? "medium");
    setDueDate(task?.due_date ?? "");
    setMode(task?.mode ?? "online");
    setDescription(task?.description ?? "");
    setIsCompleted(task?.is_completed ?? false);
    setError(null);
    setShowDeleteConfirm(false);
  }, [task]);

  async function handleSave() {
    if (!name.trim()) {
      setError("Task name is required.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(
        {
          name: name.trim(),
          priority,
          due_date: dueDate || null,
          mode,
          description: description.trim(),
          is_completed: isCompleted,
        },
        task
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save task.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!task) return;
    setIsSaving(true);
    setError(null);
    try {
      await onDelete(task.id);
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <ModalFrame title={task ? "Edit task" : "Add task"} onClose={onClose}>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Task Name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Priority
              </span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option[0].toUpperCase() + option.slice(1)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Due Date
              </span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Mode
              </span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as TaskMode)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Task Description
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={isCompleted}
              onChange={(e) => setIsCompleted(e.target.checked)}
            />
            Mark complete
          </label>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-2">
            {task && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSaving}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Save
            </button>
          </div>
        </div>
      </ModalFrame>

      {showDeleteConfirm && task && (
        <ConfirmDialog
          title="Delete task?"
          description="Are you sure? This cannot be undone."
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}
