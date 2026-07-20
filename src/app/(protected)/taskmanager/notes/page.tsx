"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import BoxContainer, { SCROLLABLE_CLASSES } from "@/components/common/BoxContainer";
import PageShell from "@/components/common/PageShell";
import LoadingSpinner from "@/components/common/LoadingSpinner";
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

function PaperClipIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-5.7-1.477-1.477" />
    </svg>
  );
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

  const [noteModalTarget, setNoteModalTarget] = useState<Note | null>(null);

  const handleEditNote = (item: UnifiedNoteRecord & { type: "note" }) =>
    setNoteModalTarget(item.data);
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
        <BoxContainer>
          <div className={`${SCROLLABLE_CLASSES} space-y-1 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800`}>
            {/* Column headers */}
            <div className="grid grid-cols-12 px-2 pb-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
              <div className="col-span-3">Name</div>
              <div className="col-span-5">Note</div>
              <div className="col-span-2">Date Added</div>
              <div className="col-span-2">Files</div>
            </div>

            {unifiedNotes.length === 0 && (
              <div className="px-2 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                None
              </div>
            )}

            {unifiedNotes.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.type === "note") {
                    setNoteModalTarget(item.data);
                  } else {
                    handleSelectDocument(item.data);
                  }
                }}
                className="grid grid-cols-12 items-center gap-2 w-full rounded-md border border-zinc-200 px-2 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
              >
                {item.type === "note" ? (
                  <>
                    <div className="col-span-3 truncate font-medium">
                      {getNoteTitle(item.data)}
                    </div>
                    <div className="col-span-5 truncate text-zinc-500 dark:text-zinc-400">
                      {(() => {
                        const stripped = stripHtml(item.data.content || "");
                        return stripped ? trunc(stripped, 60) : "—";
                      })()}
                    </div>
                    <div className="col-span-2 text-zinc-500 dark:text-zinc-400">
                      {formatShortDate(item.data.created_at)}
                    </div>
                    <div className="col-span-2">
                      {item.attachedDocs.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-sky-500" title={`${item.attachedDocs.length} document(s) attached`}>
                          <PaperClipIcon className="h-4 w-4" />
                          <span className="font-medium text-zinc-500 dark:text-zinc-400">({item.attachedDocs.length})</span>
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="col-span-3 text-zinc-400 dark:text-zinc-500">—</div>
                    <div className="col-span-5 text-zinc-400 dark:text-zinc-500">—</div>
                    <div className="col-span-2 text-zinc-500 dark:text-zinc-400">
                      {formatShortDate(item.data.created_at)}
                    </div>
                    <div className="col-span-2 truncate text-zinc-500 dark:text-zinc-400">
                      {item.data.label || "Unnamed"}
                    </div>
                  </>
                )}
              </button>
            ))}
          </div>
        </BoxContainer>
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
