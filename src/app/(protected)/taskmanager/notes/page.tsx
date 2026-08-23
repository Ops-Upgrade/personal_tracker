"use client";

import { useCallback, useMemo, useState } from "react";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
import { fetchNotes } from "@/api/taskmanager";
import { fetchDocuments } from "@/api/common/documents";
import { ROUTES } from "@/routes/paths";
import { useNoteActions } from "@/hooks/useNoteActions";
import type { Note } from "@/types/taskmanager";
import type { Document } from "@/types/document";
import PageShell from "@/components/common/PageShell";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import GenericViewPage, { type ColumnDef } from "@/components/common/GenericViewPage";
import { getNoteTitle } from "@/components/taskmanager/helpers";
import { NOTE_FIELDS } from "@/components/taskmanager/config";
import { colRichtext, colDate, colFiles } from "@/components/common/columns";
import GenericDomainModal from "@/components/common/GenericDomainModal";

type SortColumn = "name" | "date";

export default function NotesPage() {
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

  const { userId, nowYear, nowMonth, isLoading, error, refreshData } =
    useAuthBootstrap({ loadData });

  const [noteModalTarget, setNoteModalTarget] = useState<Note | null>(null);

  const closeNoteModal = () => {
    setNoteModalTarget(null);
    if (userId) refreshData(userId);
  };

  const { handleNoteDelete, handleDownloadDocument } =
    useNoteActions({
      userId,
      refresh: async () => {
        if (userId) await refreshData(userId);
      },
    });

  // Strict record grid: only Note rows render here — standalone files belong
  // in the Store. Documents are fetched solely for the modal + files count.
  const docCountsByNote = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of documents) {
      if (d.domain === "taskmanager" && d.linked_id) {
        map.set(d.linked_id, (map.get(d.linked_id) ?? 0) + 1);
      }
    }
    return map;
  }, [documents]);

  // ── Column definitions (declarative tokens — the grid renders them) ──

  const noteColumns: ColumnDef<Note, SortColumn>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Name",
        sizing: "flex",
        weight: 2,
        sortColumn: "name",
        token: { type: "text", accessor: (n) => getNoteTitle(n), color: "strong" },
      },
      colRichtext<Note, SortColumn>({
        key: "note",
        header: "Note",
        accessor: (n) => n.content,
        weight: 3,
      }),
      colDate<Note, SortColumn>(
        {
          key: "date",
          header: "Date Added",
          accessor: (n) => n.created_at,
          className: "text-zinc-500 dark:text-zinc-400",
        },
        { sortColumn: "date" },
      ),
      colFiles<Note, SortColumn>({
        getCount: (n) => docCountsByNote.get(n.id) ?? 0,
        iconColorClass: "text-sky-500",
        countClass: "text-zinc-500 dark:text-zinc-400",
      }),
    ],
    [docCountsByNote],
  );

  // ── Render ──

  return (
    <PageShell
      backHref={ROUTES.TASK_MANAGER}
      title="Notes"
      description="All your notes."
      error={error}
      onRetry={() => userId && refreshData(userId)}
    >
      {isLoading && <LoadingSpinner />}

      {!isLoading && (
        <GenericViewPage
          data={notes}
          columns={noteColumns}
          getItemKey={(n) => n.id}
          cacheKeyPrefix="taskmanager_notes"
          defaultSort={{ column: "date", direction: "desc" }}
          supportedViews={["all"]}
          getDateKey={(n) => n.created_at}
          itemNamePlural="notes"
          onRowClick={(n) => setNoteModalTarget(n)}
          onBulkDelete={async (ids, clearFn) => {
            for (const id of ids) await handleNoteDelete(id, "cascade");
            clearFn();
          }}
          nowYear={nowYear ?? undefined}
          nowMonth={nowMonth ?? undefined}
        />
      )}

      {noteModalTarget && userId && (
        <GenericDomainModal
          mode="record"
          domain="taskmanager_notes"
          target={{
            type: "record",
            id: noteModalTarget.id,
            data: noteModalTarget as unknown as Record<string, unknown>,
          }}
          fields={NOTE_FIELDS}
          userId={userId}
          onClose={closeNoteModal}
          onSaved={async () => {
            if (userId) await refreshData(userId);
          }}
          onDeleted={async () => {
            if (userId) await refreshData(userId);
          }}
          onDownloadDocument={handleDownloadDocument}
        />
      )}
    </PageShell>
  );
}
