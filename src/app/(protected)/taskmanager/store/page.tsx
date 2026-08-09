"use client";

import { useCallback, useState } from "react";
import { ROUTES } from "@/routes/paths";
import {
  fetchNotes,
  updateNote,
  deleteNote,
  createNote,
} from "@/api/taskmanager";
import { fetchDocuments } from "@/api/common/documents";
import { InputField } from "@/components/common/FormField";
import RichTextEditor from "@/components/common/RichTextEditor";
import type { Note, NotePlaintext } from "@/types/taskmanager";
import type { Document } from "@/types/document";
import { useNoteActions } from "@/hooks/useNoteActions";
import GenericStorePage from "@/components/common/store/GenericStorePage";
import GenericDomainModal, { type FieldDef } from "@/components/common/GenericDomainModal";

const NOTE_FIELDS: FieldDef[] = [
  { key: "name", type: "text", label: "Name", placeholder: "Note title" },
  { key: "content", type: "richtext", label: "Content", minHeight: "10rem" },
];

/**
 * Task Manager Document Store.
 * Uses GenericStorePage with notes as parent records.
 *
 * Clicking a linked doc opens the note editor to edit the parent note.
 * Standalone upload offers inline "create new note" form.
 */
export default function TaskManagerStorePage() {
  // --- Inline note creation form state ---
  const [newNoteName, setNewNoteName] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");

  // --- fetchData ---
  const fetchData = useCallback(async (userId: string) => {
    const [notes, docs] = await Promise.all([
      fetchNotes(userId),
      fetchDocuments(userId),
    ]);
    return { domainRows: notes, documents: docs };
  }, []);

  // --- deriveParentRecords ---
  const deriveParentRecords = useCallback(
    (rows: Note[]) =>
      rows.map((n) => ({ id: n.id, name: n.name?.trim() || "Untitled Note" })),
    [],
  );

  // --- onLinkedRecordClick ---
  const onLinkedRecordClick = useCallback(
    (docId: string, allDocuments: Document[], allRows: Note[]) => {
      const doc = allDocuments.find((d) => d.id === docId);
      if (!doc?.linked_id) return null;
      return allRows.find((n) => n.id === doc.linked_id) ?? null;
    },
    [],
  );

  // --- Parent CRUD handlers (GenericStorePage injects userId + refreshAll) ---

  const handleDeleteParent = useCallback(
    async (parentId: string, _userId: string, refreshAll: () => Promise<void>) => {
      await deleteNote(parentId);
      await refreshAll();
    },
    [],
  );

  const handleUnlinkFromParent = useCallback(
    async (
      documentId: string,
      parentId: string,
      userId: string,
      refreshAll: () => Promise<void>,
    ) => {
      const notes = await fetchNotes(userId);
      const note = notes.find((n) => n.id === parentId);
      if (note) {
        const newDocIds = (note.document_ids ?? []).filter((id) => id !== documentId);
        await updateNote(userId, parentId, {
          ...note,
          document_ids: newDocIds,
          updated_at: new Date().toISOString(),
        } as NotePlaintext);
      }
      await refreshAll();
    },
    [],
  );

  const handleBulkLinkToParent = useCallback(
    async (
      documentIds: string[],
      parentId: string,
      userId: string,
      refreshAll: () => Promise<void>,
    ) => {
      const notes = await fetchNotes(userId);
      const note = notes.find((n) => n.id === parentId);
      if (note) {
        const merged = [...new Set([...(note.document_ids ?? []), ...documentIds])];
        await updateNote(userId, parentId, {
          ...note,
          document_ids: merged,
          updated_at: new Date().toISOString(),
        } as NotePlaintext);
      }
      await refreshAll();
    },
    [],
  );

  const handleDocumentSaved = useCallback(
    async (
      documentId: string,
      newLinkedId: string,
      oldLinkedId: string,
      userId: string,
      refreshAll: () => Promise<void>,
    ) => {
      if (oldLinkedId === newLinkedId) {
        await refreshAll();
        return;
      }

      const notes = await fetchNotes(userId);

      // Remove from old parent
      if (oldLinkedId) {
        const oldNote = notes.find((n) => n.id === oldLinkedId);
        if (oldNote) {
          const newDocIds = (oldNote.document_ids ?? []).filter((id) => id !== documentId);
          await updateNote(userId, oldLinkedId, {
            ...oldNote,
            document_ids: newDocIds,
            updated_at: new Date().toISOString(),
          } as NotePlaintext);
        }
      }

      // Add to new parent
      if (newLinkedId) {
        const newNote = notes.find((n) => n.id === newLinkedId);
        if (newNote) {
          const merged = [...new Set([...(newNote.document_ids ?? []), documentId])];
          await updateNote(userId, newLinkedId, {
            ...newNote,
            document_ids: merged,
            updated_at: new Date().toISOString(),
          } as NotePlaintext);
        }
      }

      await refreshAll();
    },
    [],
  );

  // --- Inline record creation ---
  const renderNewRecordForm = useCallback(
    ({ disabled, isSaving }: { disabled: boolean; isSaving: boolean }) => (
      <fieldset disabled={disabled || isSaving} className="space-y-3">
        <InputField
          label="Note Name"
          value={newNoteName}
          onChange={setNewNoteName}
          disabled={isSaving || disabled}
          placeholder="e.g. Meeting Notes"
        />
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Content
          </label>
          <RichTextEditor
            value={newNoteContent}
            onChange={setNewNoteContent}
            disabled={isSaving || disabled}
            minHeight="6rem"
          />
        </div>
      </fieldset>
    ),
    [newNoteName, newNoteContent],
  );

  const extractNewRecordData = useCallback((): Record<string, string> | null => {
    if (!newNoteName.trim()) return null;
    return { name: newNoteName.trim(), content: newNoteContent };
  }, [newNoteName, newNoteContent]);

  const handleCreateParentFromStore = useCallback(
    async (
      data: Record<string, string>,
      userId: string,
      refreshAll: () => Promise<void>,
    ): Promise<string> => {
      const nowIso = new Date().toISOString();
      const note = await createNote(userId, {
        name: data.name || "",
        content: data.content || "",
        document_ids: [],
        updated_at: nowIso,
      });
      await refreshAll();
      setNewNoteName("");
      setNewNoteContent("");
      return note.id;
    },
    [],
  );

  // --- Note handlers via useNoteActions ---
  // We use a ref-like pattern: the modalSlot gets refreshAll from GenericStorePage.
  // useNoteActions takes a `refresh` callback — we'll create it inside the modalSlot closure.

  // --- modalSlot: renders the note editor for the linked record ---
  const modalSlot = useCallback(
    ({
      linkedRecord,
      allDocuments,
      userId,
      refreshAll,
      onClose,
    }: {
      linkedRecord: Note;
      allRows: Note[];
      allDocuments: Document[];
      userId: string;
      refreshAll: () => Promise<void>;
      onClose: () => void;
    }) => {
      return (
        <NoteStoreModal
          note={linkedRecord}
          documents={allDocuments}
          userId={userId}
          refreshAll={refreshAll}
          onClose={onClose}
        />
      );
    },
    [],
  );

  return (
    <GenericStorePage
      domain="taskmanager"
      title="Note Store"
      description="View all uploaded files across all your notes."
      backHref={ROUTES.TASK_MANAGER}
      fetchData={fetchData}
      deriveParentRecords={deriveParentRecords}
      onLinkedRecordClick={onLinkedRecordClick}
      modalSlot={modalSlot}
      onDeleteParentRecord={handleDeleteParent}
      onUnlinkFromParent={handleUnlinkFromParent}
      onBulkLinkToParent={handleBulkLinkToParent}
      onDocumentSaved={handleDocumentSaved}
      renderNewRecordForm={renderNewRecordForm}
      extractNewRecordData={extractNewRecordData}
      onCreateParentFromStore={handleCreateParentFromStore}
      hideParentRecordsList
    />
  );
}

// --- Note store modal (hook bridge — calls useNoteActions) ---

function NoteStoreModal({
  note,
  documents,
  userId,
  refreshAll,
  onClose,
}: {
  note: Note;
  documents: Document[];
  userId: string;
  refreshAll: () => Promise<void>;
  onClose: () => void;
}) {
  const refresh = useCallback(async () => { await refreshAll(); }, [refreshAll]);
  const { createSaveAdapter, handleNoteDelete, handleDownloadDocument } =
    useNoteActions({ userId, refresh });

  return (
    <GenericDomainModal
      mode="record"
      title="Edit note"
      onClose={onClose}
      fields={NOTE_FIELDS}
      initialData={{
        name: note.name ?? "",
        content: note.content ?? "",
      }}
      allowFiles
      userId={userId}
      attachedDocuments={documents.filter(
        (d) => d.domain === "taskmanager" && d.linked_id === note.id,
      )}
      standaloneDocuments={documents.filter(
        (d) => d.domain === "taskmanager" && !d.linked_id,
      )}
      domain="taskmanager"
      onSave={async (formData, fileActions) => {
        await createSaveAdapter(note)(formData, fileActions);
        if (fileActions.docsToUnlink.length > 0) {
          onClose();
          const unlinkedId =
            fileActions.docsToUnlink[fileActions.docsToUnlink.length - 1];
          window.location.hash = `#edit-document-${unlinkedId}`;
        }
      }}
      onDeleteWithCascade={async (cascadeMode) => {
        await handleNoteDelete(note.id, cascadeMode);
      }}
      deleteLabel="Delete"
      onDownloadDocument={handleDownloadDocument}
    />
  );
}
