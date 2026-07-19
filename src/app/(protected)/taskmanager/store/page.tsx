"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ROUTES } from "@/routes/paths";
import { getSession } from "@/api/auth";
import {
  fetchNotes,
  updateNote,
  deleteNote,
  createNote,
} from "@/api/taskmanager";
import {
  fetchDocuments,
  updateDocument,
} from "@/api/common/documents";
import { InputField } from "@/components/common/FormField";
import type { Note, NotePlaintext } from "@/types/taskmanager";
import type { Document, DocumentPlaintext } from "@/types/document";
import { useNoteActions } from "@/hooks/useNoteActions";
import GlobalStoreView from "@/components/common/store/GlobalStoreView";
import NoteModal from "@/components/taskmanager/NoteModal";

/**
 * Task Manager Document Store.
 * Uses GlobalStoreView with notes as parent records.
 *
 * Maintains parity with EducationStorePage:
 * - Clicking a linked doc opens NoteModal to edit the parent note
 * - Standalone upload offers inline "create new note" form
 */
export default function TaskManagerStorePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [parentRecords, setParentRecords] = useState<{ id: string; name: string }[]>([]);
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);

  // Inline modal state: linked document → open NoteModal for parent note
  const [linkedRecord, setLinkedRecord] = useState<Note | null>(null);

  // --- Auth + data loading ---
  useEffect(() => {
    const init = async () => {
      const session = await getSession();
      if (session?.user.id) setUserId(session.user.id);
    };
    init();
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      const [notes, docs] = await Promise.all([
        fetchNotes(userId),
        fetchDocuments(userId),
      ]);
      if (!cancelled) {
        setAllNotes(notes);
        setAllDocuments(docs);
        setParentRecords(notes.map((n) => ({ id: n.id, name: n.name?.trim() || "Untitled Note" })));
      }
    };
    load();
    return () => { cancelled = true; };
  }, [userId]);

  const refreshAll = useCallback(async () => {
    if (!userId) return;
    const [notes, docs] = await Promise.all([
      fetchNotes(userId),
      fetchDocuments(userId),
    ]);
    setAllNotes(notes);
    setAllDocuments(docs);
    setParentRecords(notes.map((n) => ({ id: n.id, name: n.name?.trim() || "Untitled Note" })));
  }, [userId]);

  // --- Action click: linked doc → open NoteModal inline for parent ---
  const handleActionClick = useCallback(
    (docId: string) => {
      const doc = allDocuments.find((d) => d.id === docId);
      if (!doc?.linked_id) return false;
      const record = allNotes.find((n) => n.id === doc.linked_id);
      if (record) {
        setLinkedRecord(record);
        return true; // Handled
      }
      return false; // Not handled
    },
    [allDocuments, allNotes],
  );

  const closeLinkedRecord = useCallback(() => {
    setLinkedRecord(null);
    refreshAll();
  }, [refreshAll]);

  // --- Parent CRUD handlers ---
  const handleDeleteParent = useCallback(
    async (parentId: string) => {
      if (!userId) return;
      await deleteNote(parentId);
      await refreshAll();
    },
    [userId, refreshAll],
  );

  const handleUnlinkFromParent = useCallback(
    async (documentId: string, parentId: string) => {
      if (!userId) return;
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
    [userId, refreshAll],
  );

  const handleBulkLinkToParent = useCallback(
    async (documentIds: string[], parentId: string) => {
      if (!userId) return;
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
    [userId, refreshAll],
  );

  // --- Inline note creation form state ---
  const [newNoteName, setNewNoteName] = useState("");

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
      </fieldset>
    ),
    [newNoteName],
  );

  const extractNewRecordData = useCallback((): Record<string, string> | null => {
    if (!newNoteName.trim()) return null;
    return { name: newNoteName.trim() };
  }, [newNoteName]);

  const onCreateParentFromStore = useCallback(
    async (data: Record<string, string>): Promise<string> => {
      if (!userId) throw new Error("No active session.");
      const nowIso = new Date().toISOString();
      const note = await createNote(userId, {
        name: data.name || "",
        content: "",
        document_ids: [],
        updated_at: nowIso,
      });
      await refreshAll();
      setNewNoteName("");
      return note.id;
    },
    [userId, refreshAll],
  );

  const { handleNoteSave, handleNoteDelete, handleDownloadDocument } =
    useNoteActions({ userId, refresh: refreshAll });

  return (
    <>
      <GlobalStoreView
        domain="taskmanager"
        title="Note Store"
        description="View all uploaded files across all your notes."
        backHref={ROUTES.TASK_MANAGER}
        backLabel="← Back to Task Manager"
        parentRecords={parentRecords}
        onDeleteParentRecord={handleDeleteParent}
        onUnlinkFromParent={handleUnlinkFromParent}
        onBulkLinkToParent={handleBulkLinkToParent}
        onActionClick={handleActionClick}
        renderNewRecordForm={renderNewRecordForm}
        extractNewRecordData={extractNewRecordData}
        onCreateParentFromStore={onCreateParentFromStore}
        hideParentRecordsList={true}
      />

      {/* NoteModal for linked record editing */}
      {linkedRecord && userId && (
        <NoteModal
          note={linkedRecord}
          documents={allDocuments}
          userId={userId}
          onClose={closeLinkedRecord}
          onSave={handleNoteSave}
          onDelete={handleNoteDelete}
          onDownloadDocument={handleDownloadDocument}
        />
      )}
    </>
  );
}
