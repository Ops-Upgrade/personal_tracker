"use client";

import { useEffect, useMemo, useState } from "react";
import type { Priority, Task, TaskMode } from "@/types/taskmanager";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import GlobalActionModal from "@/components/common/GlobalActionModal";
import { InputField, SelectField, CheckboxField } from "@/components/common/FormField";
import RichTextEditor from "@/components/common/RichTextEditor";
import ErrorBanner from "@/components/common/ErrorBanner";

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
  const [name, setName] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [mode, setMode] = useState<TaskMode>("online");
  const [description, setDescription] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Baseline: computed once, used by both reset AND dirty check ──
  const baseline = useMemo(() => ({
    name: task?.name ?? "",
    priority: task?.priority ?? "medium",
    dueDate: task?.due_date ?? defaultDate ?? "",
    mode: task?.mode ?? "online",
    description: task?.description ?? "",
    isCompleted: task?.is_completed ?? false,
  }), [task, defaultDate]);

  // Reset form to baseline whenever the record changes
  useEffect(() => {
    setName(baseline.name);
    setPriority(baseline.priority);
    setDueDate(baseline.dueDate);
    setMode(baseline.mode);
    setDescription(baseline.description);
    setIsCompleted(baseline.isCompleted);
    setError(null);
    setShowDeleteConfirm(false);
  }, [baseline]);

  // Dirty check: compare current state against the same baseline object
  const isDirty =
    name !== baseline.name ||
    priority !== baseline.priority ||
    dueDate !== baseline.dueDate ||
    mode !== baseline.mode ||
    description !== baseline.description ||
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

  async function handleDeleteClick() {
    setShowDeleteConfirm(true);
  }

  return (
    <>
      <GlobalActionModal
        title={task ? "Edit task" : "Add task"}
        onClose={onClose}
        isDirty={isDirty}
        onSave={handleSave}
        isSaving={isSaving}
        onDelete={task ? handleDeleteClick : undefined}
        deleteLabel="Delete"
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
