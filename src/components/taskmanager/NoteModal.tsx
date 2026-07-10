"use client";

import { useEffect, useMemo, useState } from "react";
import type { Note } from "@/types/taskmanager";
import ConfirmDialog from "./ConfirmDialog";
import GlobalActionModal from "@/components/common/GlobalActionModal";
import { TextareaField } from "@/components/common/FormField";
import ErrorBanner from "@/components/common/ErrorBanner";

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

  // ── Baseline: computed once, used by both reset AND dirty check ──
  const baseline = useMemo(() => ({
    content: note?.content ?? "",
  }), [note]);

  useEffect(() => {
    setContent(baseline.content);
    setError(null);
    setShowDeleteConfirm(false);
  }, [baseline]);

  const isDirty = content !== baseline.content;

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

  async function handleDeleteClick() {
    setShowDeleteConfirm(true);
  }

  return (
    <>
      <GlobalActionModal
        title={note ? "Edit note" : "Add note"}
        onClose={onClose}
        isDirty={isDirty}
        onSave={handleSave}
        isSaving={isSaving}
        onDelete={note ? handleDeleteClick : undefined}
        deleteLabel="Delete"
      >
        <div className="space-y-3">
          <TextareaField label="Content" value={content} onChange={setContent} rows={8} />
          {error && <ErrorBanner message={error} />}
        </div>
      </GlobalActionModal>

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
