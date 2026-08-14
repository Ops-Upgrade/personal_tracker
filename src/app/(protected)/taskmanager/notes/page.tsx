"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
import {
  fetchNotes,
} from "@/api/taskmanager";
import {
  fetchDocuments,
} from "@/api/common/documents";
import { ROUTES } from "@/routes/paths";
import { useNoteActions } from "@/hooks/useNoteActions";
import type { Note } from "@/types/taskmanager";
import type { Document } from "@/types/document";
import PageShell from "@/components/common/PageShell";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import GenericViewPage, { STANDARD_VIEWS } from "@/components/common/GenericViewPage";
import type { ColumnDef } from "@/components/common/GenericViewPage";
import { PaperClipIcon } from "@/components/common/Icons";
import { useLocalStorage } from "@/lib/useLocalStorage";
import {
  getNoteTitle,
  getUnifiedNotes,
  type UnifiedNoteRecord,
} from "@/components/taskmanager/helpers";
import { colRichtext, colDate } from "@/components/common/columns";
import GenericDomainModal, { type FieldDef } from "@/components/common/GenericDomainModal";

const NOTE_FIELDS: FieldDef[] = [
  { key: "name", type: "text", label: "Name", placeholder: "Note title" },
  { key: "content", type: "richtext", label: "Content", minHeight: "10rem" },
];

export default function NotesPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  const loadData = useCallback(async (uid: string) => {
    const [noteRows, docRows] = await Promise.all([
      fetchNotes(uid),
      fetchDocuments(uid),
    ]);
    setNotes(noteRows);
    setDocuments(docRows);
  }, []);

  const { userId, isLoading, error, refreshData } =
    useAuthBootstrap({ loadData });

  const unifiedNotes = useMemo(
    () => getUnifiedNotes(notes, documents),
    [notes, documents],
  );

  const [activeView, setActiveView] = useLocalStorage<string>("notesView", "all");

  const [noteModalTarget, setNoteModalTarget] = useState<Note | null>(null);

  const closeNoteModal = () => {
    setNoteModalTarget(null);
    if (userId) refreshData(userId);
  };

  const { createSaveAdapter, handleNoteDelete, handleDownloadDocument } =
    useNoteActions({
      userId,
      refresh: async () => {
        if (userId) await refreshData(userId);
      },
    });

  const handleSelectDocument = (doc: Document) => {
    router.push(`${ROUTES.TASK_MANAGER_STORE}#edit-document-${doc.id}`);
  };

  // ── Column definitions ──

  const noteColumns: ColumnDef<UnifiedNoteRecord>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Name",
        sizing: "flex",
        weight: 2,
        render: (item) =>
          item.type === "note" ? (
            <div className="truncate font-medium">{getNoteTitle(item.data)}</div>
          ) : (
            <div className="text-zinc-400 dark:text-zinc-500">—</div>
          ),
      },
      colRichtext<UnifiedNoteRecord>({
        key: "note",
        header: "Note",
        accessor: (item) => (item.type === "note" ? item.data.content : ""),
        weight: 3,
      }),
      colDate<UnifiedNoteRecord>({
        key: "date",
        header: "Date Added",
        accessor: (item) => item.dateStr,
        className: "text-zinc-500 dark:text-zinc-400",
      }),
      {
        key: "files",
        header: "Files",
        // Flex (not fixed): the document branch renders a variable-length
        // label in this column, so it must be able to truncate.
        sizing: "flex",
        weight: 1,
        align: "right",
        render: (item) =>
          item.type === "note" ? (
            item.attachedDocs.length > 0 ? (
              <span
                className="inline-flex items-center gap-1 text-sky-500"
                title={`${item.attachedDocs.length} document(s) attached`}
              >
                <PaperClipIcon className="h-4 w-4" />
                <span className="text-zinc-500 dark:text-zinc-400">
                  ({item.attachedDocs.length})
                </span>
              </span>
            ) : (
              <span className="text-zinc-400">—</span>
            )
          ) : (
            <div className="truncate text-zinc-500 dark:text-zinc-400">
              {item.data.label || "Unnamed"}
            </div>
          ),
      },
    ],
    [],
  );

  // ── Render ──

  return (
    <PageShell
      backHref={ROUTES.TASK_MANAGER}
      title="Notes"
      description="All your notes and standalone files."
      error={error}
      onRetry={() => userId && refreshData(userId)}
    >
      {isLoading && <LoadingSpinner />}

      {!isLoading && (
        <GenericViewPage
          items={unifiedNotes}
          columns={noteColumns}
          getItemKey={(item) => item.id}
          views={STANDARD_VIEWS.ALL_ONLY}
          activeView={activeView}
          onViewChange={setActiveView}
          emptyMessage="None"
          onRowClick={(item) => {
            if (item.type === "note") {
              setNoteModalTarget(item.data);
            } else {
              handleSelectDocument(item.data);
            }
          }}
        />
      )}

      {noteModalTarget && userId && (
        <GenericDomainModal
          mode="record"
          title="Edit note"
          onClose={closeNoteModal}
          fields={NOTE_FIELDS}
          initialData={{
            name: noteModalTarget.name ?? "",
            content: noteModalTarget.content ?? "",
          }}
          allowFiles
          userId={userId}
          attachedDocuments={documents.filter(
            (d) =>
              d.domain === "taskmanager" &&
              d.linked_id === noteModalTarget.id,
          )}
          standaloneDocuments={documents.filter(
            (d) => d.domain === "taskmanager" && !d.linked_id,
          )}
          domain="taskmanager"
          onSave={createSaveAdapter(noteModalTarget)}
          onDeleteWithCascade={async (cascadeMode) => {
            await handleNoteDelete(noteModalTarget.id, cascadeMode);
          }}
          deleteLabel="Delete"
          onDownloadDocument={handleDownloadDocument}
        />
      )}
    </PageShell>
  );
}
