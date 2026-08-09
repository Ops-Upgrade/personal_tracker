"use client";

import { useMemo, useState } from "react";
import type { Task, TaskMode } from "@/types/taskmanager";
import type { Priority } from "@/types/common";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import GlobalActionModal from "@/components/common/GlobalActionModal";
import { InputField, SelectField, CheckboxField } from "@/components/common/FormField";
import RichTextEditor from "@/components/common/RichTextEditor";
import ErrorBanner from "@/components/common/ErrorBanner";
import Toast from "@/components/common/Toast";
import { useModalBaseState } from "@/hooks/useModalBaseState";
import { stripHtml, normalizeDateForInput } from "@/lib/utils";

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
  defaultDate?: string;
  onClose: () => void;
  onSave: (draft: TaskDraft, existingTask: Task | null) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
}

const PRIORITY_OPTIONS: Priority[] = ["low", "medium", "high", "critical"];

export default function TaskModal({ task, defaultDate, onClose, onSave, onDelete }: TaskModalProps) {
  const [name, setName] = useState(task?.name ?? "");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "medium");
  const [dueDate, setDueDate] = useState(task?.due_date ?? defaultDate ?? "");
  const [mode, setMode] = useState<TaskMode>(task?.mode ?? "online");
  const [description, setDescription] = useState(task?.description ?? "");
  const [isCompleted, setIsCompleted] = useState(task?.is_completed ?? false);
  const {
    isSaving,
    setIsSaving,
    error,
    setError,
    showDeleteConfirm,
    setShowDeleteConfirm,
    toastConfig,
    triggerToast,
  } = useModalBaseState();

  // ── Baseline: computed once, used by both reset AND dirty check ──
  const baseline = useMemo(() => ({
    name: task?.name ?? "",
    priority: task?.priority ?? "medium",
    dueDate: normalizeDateForInput(task?.due_date, defaultDate ?? ""),
    mode: task?.mode ?? "online",
    description: task?.description ?? "",
    isCompleted: task?.is_completed ?? false,
  }), [task, defaultDate]);

  // Dirty check: compare current state against the same baseline object
  const isDirty =
    name !== baseline.name ||
    priority !== baseline.priority ||
    dueDate !== baseline.dueDate ||
    mode !== baseline.mode ||
    stripHtml(description) !== stripHtml(baseline.description) ||
    isCompleted !== baseline.isCompleted;

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
      triggerToast("✓ Saved", "success");
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

  async function handleDeleteClick() {
    setShowDeleteConfirm(true);
  }

  return (
    <>
      <Toast isVisible={toastConfig.isVisible} message={toastConfig.message} type={toastConfig.type} />

      <GlobalActionModal
        title={task ? "Edit task" : "Add task"}
        onClose={onClose}
        isDirty={isDirty}
        onSave={handleSave}
        isSaving={isSaving}
        onDelete={task ? handleDeleteClick : undefined}
        deleteLabel="Delete"
        maxWidthClassName="max-w-lg"
      >
        <div className="space-y-3">
          <InputField label="Task Name" value={name} onChange={setName} />

          <div className="grid gap-3 sm:grid-cols-3">
            <SelectField
              label="Priority"
              value={priority}
              onChange={(v) => setPriority(v as Priority)}
              options={PRIORITY_OPTIONS.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) }))}
            />
            <InputField label="Due Date" type="date" value={dueDate} onChange={setDueDate} />
            <SelectField
              label="Mode"
              value={mode}
              onChange={(v) => setMode(v as TaskMode)}
              options={[{ value: "online", label: "Online" }, { value: "offline", label: "Offline" }]}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Task Description
            </label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              minHeight="8rem"
            />
          </div>

          <CheckboxField label="Mark complete" checked={isCompleted} onChange={setIsCompleted} />

          {error && <ErrorBanner message={error} />}
        </div>
      </GlobalActionModal>

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
