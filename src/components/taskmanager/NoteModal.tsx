"use client";

import { useEffect, useState } from "react";
import type { Note } from "@/types/taskmanager";
import Button from "@/components/common/Button";
import ConfirmDialog from "./ConfirmDialog";
import ModalFrame from "./ModalFrame";

interface NoteModalProps {
  note: Note | null;
  onClose: () => void;
  onSave: (content: string, existingNote: Note | null) => Promise<void>;
  onDelete: (noteId: string) => Promise<void>;
}

export default function NoteModal({ note, onClose, onSave, onDelete }: NoteModalProps) {
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setContent(note?.content ?? "");
    setError(null);
    setShowDeleteConfirm(false);
  }, [note]);

  async function handleSave() {
    if (!content.trim()) {
      setError("Note content is required.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave(content.trim(), note);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!note) return;
    setIsSaving(true);
    setError(null);
    try {
      await onDelete(note.id);
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete note.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <ModalFrame title={note ? "Edit note" : "Add note"} onClose={onClose}>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Content
            </span>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-2">
            {note && (
              <Button
                variant="danger"
                size="md"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSaving}
              >
                Delete
              </Button>
            )}
            <Button
              variant="secondary"
              size="md"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSave}
              disabled={isSaving}
            >
              Save
            </Button>
          </div>
        </div>
      </ModalFrame>

      {showDeleteConfirm && note && (
        <ConfirmDialog
          title="Delete note?"
          description="Are you sure? This cannot be undone."
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}
