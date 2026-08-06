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
import { trunc } from "@/lib/viewHelpers";
import { formatShortDate } from "@/lib/format";
import NoteModal from "@/components/taskmanager/NoteModal";

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

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

  const { handleNoteSave, handleNoteDelete, handleDownloadDocument } =
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
        colSpan: 3,
        render: (item) =>
          item.type === "note" ? (
            <div className="truncate font-medium">{getNoteTitle(item.data)}</div>
          ) : (
            <div className="text-zinc-400 dark:text-zinc-500">—</div>
          ),
      },
      {
        key: "note",
        header: "Note",
        colSpan: 5,
        render: (item) =>
          item.type === "note" ? (
            <div className="truncate text-zinc-500 dark:text-zinc-400">
              {(() => {
                const stripped = stripHtml(item.data.content || "");
                return stripped ? trunc(stripped, 60) : "—";
              })()}
            </div>
          ) : (
            <div className="text-zinc-400 dark:text-zinc-500">—</div>
          ),
      },
      {
        key: "date",
        header: "Date Added",
        colSpan: 2,
        render: (item) => (
          <div className="text-zinc-500 dark:text-zinc-400">
            {formatShortDate(item.dateStr)}
          </div>
        ),
      },
      {
        key: "files",
        header: "Files",
        colSpan: 2,
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
        <NoteModal
          note={noteModalTarget}
          documents={documents}
          userId={userId}
          onClose={closeNoteModal}
          onSave={handleNoteSave}
          onDelete={handleNoteDelete}
          onDownloadDocument={handleDownloadDocument}
        />
      )}
    </PageShell>
  );
}
