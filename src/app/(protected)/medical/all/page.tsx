"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
import {
  fetchMedicalRecords,
  createMedicalRecord,
  updateMedicalRecord,
  deleteMedicalRecord,
} from "@/api/medical";
import {
  fetchDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
} from "@/api/common/documents";
import {
  uploadDocumentFile,
  deleteDocumentFile,
} from "@/api/common/documentStorage";
import { ROUTES } from "@/routes/paths";
import type { MedicalRecord, MedicalPlaintext } from "@/types/medical";
import type { Document, DocumentPlaintext } from "@/types/document";
import PageShell from "@/components/common/PageShell";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import GenericViewPage, { STANDARD_VIEWS } from "@/components/common/GenericViewPage";
import type { ColumnDef, MonthGroup } from "@/components/common/GenericViewPage";
import { PaperClipIcon } from "@/components/common/Icons";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useTableSort, type SortConfig } from "@/hooks/useTableSort";
import { byMonth, trunc } from "@/lib/viewHelpers";
import MedicalModal from "@/components/medical/MedicalModal";
import type { MedicalFileAction } from "@/components/medical/MedicalModal";

// ── Sort helpers ──

type SortColumn = "name" | "clinic" | "date";

const SORT_CONFIGS: SortConfig<SortColumn, MedicalRecord>[] = [
  { column: "name", extractor: (rec) => rec.name.toLowerCase() },
  { column: "clinic", extractor: (rec) => (rec.clinic ?? "").toLowerCase() },
  { column: "date", extractor: (rec) => new Date(rec.date + "T00:00:00").getTime() },
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function MedicalAllPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  const loadData = useCallback(async (uid: string) => {
    const [recRows, docRows] = await Promise.all([
      fetchMedicalRecords(uid),
      fetchDocuments(uid),
    ]);
    setRecords(recRows);
    setDocuments(docRows);
  }, []);

  const { userId, nowYear, nowMonth, isLoading, error, refreshData } =
    useAuthBootstrap({ loadData });

  // ── Year / Month filter state from URL params ──

  const urlYear = searchParams.get("year");
  const urlMonth = searchParams.get("month");

  const initialYear = urlYear ? Number(urlYear) : nowYear || new Date().getFullYear();
  const initialMonth = urlMonth ? Number(urlMonth) : ("all" as const);

  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedMonth, setSelectedMonth] = useState<number | "all">(initialMonth);
  const [activeView, setActiveView] = useLocalStorage<string>("medicalAllView", "all");

  // ── Derived data ──

  const availableYears = useMemo(() => {
    const currentYear = nowYear || new Date().getFullYear();
    const yearsFromData = new Set(
      records.map((r) => new Date(r.date).getFullYear()),
    );
    yearsFromData.add(currentYear);
    return Array.from(yearsFromData).sort((a, b) => b - a);
  }, [records, nowYear]);

  const availableMonths = useMemo(() => {
    const months = new Set<number>();
    for (const r of records) {
      const d = new Date(r.date);
      if (d.getFullYear() === selectedYear) {
        months.add(d.getMonth());
      }
    }
    return Array.from(months).sort((a, b) => a - b);
  }, [records, selectedYear]);

  const recordsForYear = useMemo(
    () =>
      records.filter((r) => new Date(r.date).getFullYear() === selectedYear),
    [records, selectedYear],
  );

  const recordsForMonth = useMemo(
    () =>
      selectedMonth === "all"
        ? recordsForYear
        : recordsForYear.filter(
            (r) => new Date(r.date).getMonth() === selectedMonth,
          ),
    [recordsForYear, selectedMonth],
  );

  const monthGroups: MonthGroup<MedicalRecord>[] = useMemo(
    () => byMonth(recordsForYear, selectedYear),
    [recordsForYear, selectedYear],
  );

  // ── Sort ──

  const { sortState, handleSort, sorted } = useTableSort(
    "medicalAllSortState",
    recordsForMonth,
    SORT_CONFIGS,
  );

  // ── Modal state ──

  const [modalTarget, setModalTarget] = useState<MedicalRecord | null>(null);

  const closeModal = () => setModalTarget(null);

  // ── CRUD handlers ──

  const refresh = useCallback(async () => {
    if (!userId) return;
    await refreshData(userId);
  }, [userId, refreshData]);

  async function handleSave(
    draft: {
      name: string;
      clinic: string;
      date: string;
      diagnosis_timeline: string;
    },
    existingRecord: MedicalRecord | null,
    fileAction?: MedicalFileAction,
  ) {
    if (!userId) throw new Error("No active session.");

    const freshRecords = await fetchMedicalRecords(userId);
    const freshDocs = await fetchDocuments(userId);
    const freshRecord = existingRecord
      ? freshRecords.find((r) => r.id === existingRecord.id)
      : null;

    const nowIso = new Date().toISOString();
    let document_ids = [...(freshRecord?.document_ids ?? [])];

    // Process removals
    if (fileAction?.removeDocIds) {
      for (const docId of fileAction.removeDocIds) {
        const doc = freshDocs.find((d) => d.id === docId);
        if (doc) {
          if (doc.file_name) {
            try { await deleteDocumentFile(userId, doc.file_name); } catch { /* best-effort */ }
          }
          try { await deleteDocument(docId); } catch { /* best-effort */ }
        }
        document_ids = document_ids.filter((id) => id !== docId);
      }
    }

    // Process unlinks
    if (fileAction?.unlinkDocIds) {
      for (const docId of fileAction.unlinkDocIds) {
        const doc = freshDocs.find((d) => d.id === docId);
        if (doc) {
          await updateDocument(userId, docId, {
            ...doc,
            linked_id: "",
            updated_at: nowIso,
          } as DocumentPlaintext);
        }
        document_ids = document_ids.filter((id) => id !== docId);
      }
    }

    const payload: MedicalPlaintext = {
      name: draft.name,
      clinic: draft.clinic,
      date: draft.date,
      diagnosis_timeline: draft.diagnosis_timeline,
      document_ids,
      updated_at: nowIso,
    };

    let savedRecord: MedicalRecord;
    if (existingRecord) {
      savedRecord = await updateMedicalRecord(userId, existingRecord.id, payload);
    } else {
      savedRecord = await createMedicalRecord(userId, payload);
    }

    // Upload new files
    if (fileAction?.newFiles) {
      for (const file of fileAction.newFiles) {
        const { fileName, iv, mimeType } = await uploadDocumentFile(userId, file);
        const doc = await createDocument(userId, {
          label: file.name,
          file_name: fileName,
          file_iv: iv,
          file_mime: mimeType,
          domain: "medical",
          linked_id: savedRecord.id,
          updated_at: nowIso,
        });
        document_ids.push(doc.id);
      }
    }

    // Link existing standalone document
    if (fileAction?.linkDocId) {
      const linkDoc = freshDocs.find((d) => d.id === fileAction.linkDocId);
      if (linkDoc && !document_ids.includes(fileAction.linkDocId)) {
        document_ids.push(fileAction.linkDocId);
      }
    }

    // Update with final document IDs
    if (
      (fileAction?.newFiles && fileAction.newFiles.length > 0) ||
      fileAction?.linkDocId
    ) {
      await updateMedicalRecord(userId, savedRecord.id, {
        ...payload,
        document_ids,
        updated_at: new Date().toISOString(),
      });
    }

    // Fix linked_id for newly created/linked documents
    if (!existingRecord) {
      const allDocs = await fetchDocuments(userId);
      for (const doc of allDocs) {
        if (doc.domain === "medical" && doc.linked_id === "" && document_ids.includes(doc.id)) {
          await updateDocument(userId, doc.id, {
            ...doc,
            linked_id: savedRecord.id,
            updated_at: new Date().toISOString(),
          } as DocumentPlaintext);
        }
      }
    }
    if (existingRecord && fileAction?.linkDocId) {
      const linkDoc = freshDocs.find((d) => d.id === fileAction.linkDocId);
      if (linkDoc) {
        await updateDocument(userId, fileAction.linkDocId, {
          ...linkDoc,
          linked_id: existingRecord.id,
          updated_at: new Date().toISOString(),
        } as DocumentPlaintext);
      }
    }

    await refresh();
  }

  async function handleDelete(recordId: string, cascadeMode: "unlink" | "cascade") {
    if (!userId) throw new Error("No active session.");

    const record = records.find((r) => r.id === recordId);
    if (record?.document_ids) {
      if (cascadeMode === "unlink") {
        const nowIso = new Date().toISOString();
        for (const docId of record.document_ids) {
          const doc = documents.find((d) => d.id === docId);
          if (doc) {
            await updateDocument(userId, docId, {
              ...doc,
              linked_id: "",
              updated_at: nowIso,
            } as DocumentPlaintext);
          }
        }
      } else {
        for (const docId of record.document_ids) {
          const doc = documents.find((d) => d.id === docId);
          if (doc) {
            if (doc.file_name) {
              try { await deleteDocumentFile(userId, doc.file_name); } catch { /* best-effort */ }
            }
            try { await deleteDocument(docId); } catch { /* best-effort */ }
          }
        }
      }
    }

    await deleteMedicalRecord(recordId);
    await refresh();
  }

  // ── Column definitions ──

  const medicalColumns: ColumnDef<MedicalRecord, SortColumn>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Name",
        colSpan: 3,
        sortColumn: "name",
        render: (rec) => (
          <span className="font-medium text-zinc-800 dark:text-zinc-100">
            {trunc(rec.name, 24) || "—"}
          </span>
        ),
      },
      {
        key: "clinic",
        header: "Clinic",
        colSpan: 2,
        sortColumn: "clinic",
        render: (rec) => (
          <span className="text-zinc-600 dark:text-zinc-300">
            {trunc(rec.clinic, 20) || "—"}
          </span>
        ),
      },
      {
        key: "date",
        header: "Date",
        colSpan: 2,
        sortColumn: "date",
        render: (rec) => (
          <span className="text-zinc-600 dark:text-zinc-300">
            {formatDate(rec.date)}
          </span>
        ),
      },
      {
        key: "diagnosis",
        header: "Diagnosis",
        colSpan: 3,
        render: (rec) => (
          <span className="text-zinc-500 dark:text-zinc-400">
            {trunc(rec.diagnosis_timeline, 28) || "—"}
          </span>
        ),
      },
      {
        key: "files",
        header: "Files",
        colSpan: 2,
        render: (rec) => {
          const count = rec.document_ids?.length ?? 0;
          return count > 0 ? (
            <span
              className="inline-flex items-center justify-center gap-1 text-rose-500"
              title={`${count} document(s) attached`}
            >
              <PaperClipIcon className="h-4 w-4" />
              <span className="text-zinc-600 dark:text-zinc-300">
                ({count})
              </span>
            </span>
          ) : (
            <span className="text-zinc-400">—</span>
          );
        },
      },
    ],
    [],
  );

  const emptyMessage =
    selectedMonth === "all"
      ? `No medical records found in ${selectedYear}.`
      : `No medical records found in ${selectedYear} for the selected month.`;

  // ── Render ──

  return (
    <>
      <PageShell
        backHref={ROUTES.MEDICAL}
        title="All Medical Records"
        description="Browse all your medical records by year and month."
        error={error}
        onRetry={() => userId && refreshData(userId)}
      >
        {isLoading && <LoadingSpinner />}

        {!isLoading && (
          <GenericViewPage
            items={sorted}
            columns={medicalColumns}
            getItemKey={(rec) => rec.id}
            views={STANDARD_VIEWS.ALL_MONTHS}
            activeView={activeView}
            onViewChange={setActiveView}
            yearFilter={{
              years: availableYears,
              selectedYear,
              onChange: (year) => {
                setSelectedYear(year);
                setSelectedMonth("all");
                router.replace(
                  `${ROUTES.MEDICAL_ALL}?year=${year}`,
                  { scroll: false },
                );
              },
            }}
            monthFilter={{
              months: availableMonths,
              selectedMonth,
              onChange: (month) => {
                setSelectedMonth(month);
                const params = new URLSearchParams();
                params.set("year", String(selectedYear));
                if (month !== "all") params.set("month", String(month));
                router.replace(
                  `${ROUTES.MEDICAL_ALL}?${params.toString()}`,
                  { scroll: false },
                );
              },
            }}
            sortState={sortState}
            onSortChange={handleSort}
            emptyMessage={emptyMessage}
            onRowClick={(rec) => setModalTarget(rec)}
            monthGroups={monthGroups}
            nowYear={nowYear ?? new Date().getFullYear()}
            nowMonth={nowMonth ?? new Date().getMonth()}
          />
        )}
      </PageShell>

      {modalTarget && userId && (
        <MedicalModal
          record={modalTarget}
          attachedDocuments={documents.filter((d) =>
            modalTarget.document_ids?.includes(d.id),
          )}
          standaloneDocuments={documents.filter(
            (d) => d.domain === "medical" && !d.linked_id,
          )}
          userId={userId}
          onClose={closeModal}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </>
  );
}
