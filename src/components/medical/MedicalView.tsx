"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/routes/paths";
import BackButton from "@/components/common/BackButton";
import Button from "@/components/common/Button";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
import { useQueryModal } from "@/lib/useQueryModal";
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
import { parseISTDate } from "@/api/serverDate";
import type { MedicalRecord, MedicalPlaintext } from "@/types/medical";
import type { Document, DocumentPlaintext } from "@/types/document";
import { MONTHS } from "@/types/expense";
import { useLocalStorage } from "@/lib/useLocalStorage";
import ViewToggle from "@/components/common/ViewToggle";
import type { ViewToggleOption } from "@/components/common/ViewToggle";
import { List, LayoutGrid, Table } from "lucide-react";
import { FolderIcon } from "@/components/common/Icons";
import ErrorBanner from "@/components/common/ErrorBanner";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import BoxContainer, { SCROLLABLE_CLASSES } from "@/components/common/BoxContainer";
import MedicalModal from "./MedicalModal";
import MedicalTable from "./MedicalTable";
import MedicalMonthRow from "./MedicalMonthRow";
import MedicalYearRow from "./MedicalYearRow";

type MedicalViewMode = "all" | "single" | "multi";

/** SVG icon symbols for the medical view toggle */
const MEDICAL_VIEW_OPTIONS: readonly ViewToggleOption<MedicalViewMode>[] = [
  { value: "all", label: <Table className="h-4 w-4" /> },
  { value: "single", label: <List className="h-4 w-4" /> },
  { value: "multi", label: <LayoutGrid className="h-4 w-4" />, hideOnMobile: true },
];

/**
 * Medical Records feature shell.
 * Orchestrates month list, year dropdown, and create/edit medical record modals.
 * "View All" navigates to the dedicated /medical/all route with month/year params.
 * Query-param-driven modals (like ExpenseView).
 */
export default function MedicalView() {
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

  const { userId, istDate, isLoading, error, refreshData } =
    useAuthBootstrap({ loadData });

  const istParsed = useMemo(() => (istDate ? parseISTDate(istDate) : null), [istDate]);

  const currentYear = istParsed?.year ?? new Date().getFullYear();
  const [viewMode, setViewMode] = useLocalStorage<MedicalViewMode>("medicalViewMode", "all");

  // Query-param-driven modal state via shared hook
  const { modalTarget, openCreate, openEdit, closeModal } = useQueryModal(records, "medical");

  // Auto-scroll to the current month tile on load / view change
  useEffect(() => {
    if (isLoading || viewMode === "all") return;
    const timeout = setTimeout(() => {
      document
        .getElementById("current-month-tile")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => clearTimeout(timeout);
  }, [isLoading, viewMode]);

  // --- Derived data ---

  // Records grouped by month for the current year
  const recordsByMonth = useMemo(() => {
    return MONTHS.map((monthName, monthIndex) => {
      const filtered = records.filter((r) => {
        const d = new Date(r.date);
        return d.getFullYear() === currentYear && d.getMonth() === monthIndex;
      });
      return { monthName, monthIndex, records: filtered };
    });
  }, [records, currentYear]);

  // Past years: one group per year < currentYear, sorted descending
  const pastYearGroups = useMemo(() => {
    const pastYears = new Set<number>();
    for (const r of records) {
      const y = new Date(r.date).getFullYear();
      if (y < currentYear) pastYears.add(y);
    }
    return Array.from(pastYears)
      .sort((a, b) => b - a)
      .map((year) => ({
        year,
        records: records.filter((r) => new Date(r.date).getFullYear() === year),
      }));
  }, [records, currentYear]);

  // Combined groups: current year months + past years
  const allGroups = useMemo(() => {
    const months = recordsByMonth.map((m) => ({ ...m, type: "month" as const }));
    const years = pastYearGroups.map((y) => ({ ...y, type: "year" as const }));
    return [...months, ...years];
  }, [recordsByMonth, pastYearGroups]);

  // Total records across all time
  const totalRecords = records.length;

  // --- CRUD handlers ---

  async function handleSave(
    draft: {
      name: string;
      clinic: string;
      date: string;
      diagnosis_timeline: string;
    },
    existingRecord: MedicalRecord | null,
    fileAction?: { newFiles: File[]; removeDocIds: string[]; unlinkDocIds?: string[]; linkDocId?: string },
  ) {
    if (!userId) throw new Error("No active session.");

    const nowIso = new Date().toISOString();
    let document_ids = [...(existingRecord?.document_ids ?? [])];

    if (fileAction?.removeDocIds) {
      for (const docId of fileAction.removeDocIds) {
        const doc = documents.find((d) => d.id === docId);
        if (doc) {
          if (doc.file_name) {
            try { await deleteDocumentFile(userId, doc.file_name); } catch { /* best-effort */ }
          }
          try { await deleteDocument(docId); } catch { /* best-effort */ }
        }
        document_ids = document_ids.filter((id) => id !== docId);
      }
    }

    // --- Process unlinks: clear linked_id, remove from parent, keep file ---
    if (fileAction?.unlinkDocIds) {
      for (const docId of fileAction.unlinkDocIds) {
        const doc = documents.find((d) => d.id === docId);
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

    if (fileAction?.newFiles) {
      for (const file of fileAction.newFiles) {
        const { fileName, iv, mimeType } = await uploadDocumentFile(userId, file);
        const doc = await createDocument(userId, {
          label: file.name,
          file_name: fileName,
          file_iv: iv,
          file_mime: mimeType,
          domain: "medical",
          linked_id: existingRecord?.id ?? "",
          updated_at: nowIso,
        });
        document_ids.push(doc.id);
      }
    }

    // --- Link existing standalone document ---
    if (fileAction?.linkDocId) {
      const linkDoc = documents.find((d) => d.id === fileAction.linkDocId);
      if (linkDoc && !document_ids.includes(fileAction.linkDocId)) {
        document_ids.push(fileAction.linkDocId);
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

    // Update newly created/linked documents with the correct linked_id
    if (!existingRecord) {
      const freshDocs = await fetchDocuments(userId);
      for (const doc of freshDocs) {
        if (doc.domain === "medical" && doc.linked_id === "" && document_ids.includes(doc.id)) {
          await updateDocument(userId, doc.id, {
            ...doc,
            linked_id: savedRecord.id,
            updated_at: new Date().toISOString(),
          } as DocumentPlaintext);
        }
      }
    }
    // For existing records, update the linked document's linked_id
    if (existingRecord && fileAction?.linkDocId) {
      const linkDoc = documents.find((d) => d.id === fileAction.linkDocId);
      if (linkDoc) {
        await updateDocument(userId, fileAction.linkDocId, {
          ...linkDoc,
          linked_id: existingRecord.id,
          updated_at: new Date().toISOString(),
        } as DocumentPlaintext);
      }
    }

    await refreshData(userId);
  }

  async function handleDelete(recordId: string, cascadeMode: 'unlink' | 'cascade' = 'cascade') {
    if (!userId) throw new Error("No active session.");

    const record = records.find((r) => r.id === recordId);
    if (record?.document_ids) {
      if (cascadeMode === 'unlink') {
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
    await refreshData(userId);
  }

  // --- Render ---

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-start gap-4 w-full">
        <BackButton href={ROUTES.DASHBOARD} />
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between w-full">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              Medical Records
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Track and manage your medical history.
            </p>
          {!isLoading && (
            <p className="mt-2 text-base font-medium text-zinc-700 dark:text-zinc-300">
              Total Records:{" "}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {totalRecords} record{totalRecords !== 1 ? "s" : ""}
              </span>
            </p>
          )}
          </div>

          {/* Document Store link */}
          {!isLoading && (
            <div className="w-full md:w-auto md:min-w-[200px] lg:w-1/3">
              <Link
                href={ROUTES.MEDICAL_STORE}
                className="flex items-center justify-center gap-2 w-full rounded-xl border border-zinc-200 bg-white p-4 shadow-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800/80 transition-colors"
              >
                <FolderIcon className="h-5 w-5 text-red-500" />
                Document Store
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Loading state */}
      {isLoading && <LoadingSpinner />}

      {/* Error state */}
      {error && (
        <ErrorBanner
          message={error}
          onRetry={() => userId && refreshData(userId)}
        />
      )}

      {/* Table / Month view */}
      {!isLoading && (
        <BoxContainer>
          <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {viewMode === "all" ? "All Records" : "Records"}
              </h2>
              <ViewToggle
                value={viewMode}
                onChange={setViewMode}
                options={MEDICAL_VIEW_OPTIONS}
                ariaLabel="Medical view toggle"
                hideContainerOnMobile={false}
              />
            </div>
            <Button variant="secondary" size="md" onClick={() => openCreate()} disabled={isLoading}>
              + Add
            </Button>
          </header>
          {viewMode === "all" ? (
            <div className={SCROLLABLE_CLASSES}>
              <MedicalTable records={records} onSelectRecord={openEdit} />
            </div>
          ) : (
            <div className={`${SCROLLABLE_CLASSES} flex flex-col md:flex-row gap-4 items-start`}>
              {/* Left Column (or Single Column) */}
              <div className="flex-1 flex flex-col gap-4 w-full">
                {allGroups
                  .filter((_, i) => viewMode === "multi" ? i % 2 === 0 : true)
                  .map((group) => {
                    if (group.type === "month") {
                      const isCurrentMonth =
                        istParsed !== null &&
                        group.monthIndex === istParsed.month;
                      return (
                        <MedicalMonthRow
                          key={`month-${group.monthName}`}
                          monthName={group.monthName}
                          monthIndex={group.monthIndex}
                          year={currentYear}
                          records={group.records}
                          isCurrentMonth={isCurrentMonth}
                          onSelectRecord={(record) => openEdit(record)}
                          onViewAll={() => setViewMode("all")}
                        />
                      );
                    }
                    return (
                      <MedicalYearRow
                        key={`year-${group.year}`}
                        year={group.year}
                        records={group.records}
                        onSelectRecord={(record) => openEdit(record)}
                        onViewAll={() => setViewMode("all")}
                      />
                    );
                  })}
              </div>

              {/* Right Column (only visible in multi view) */}
              {viewMode === "multi" && (
                <div className="flex-1 flex-col gap-4 w-full hidden md:flex">
                  {allGroups
                    .filter((_, i) => i % 2 !== 0)
                    .map((group) => {
                      if (group.type === "month") {
                        const isCurrentMonth =
                          istParsed !== null &&
                          group.monthIndex === istParsed.month;
                        return (
                          <MedicalMonthRow
                            key={`month-${group.monthName}`}
                            monthName={group.monthName}
                            monthIndex={group.monthIndex}
                            year={currentYear}
                            records={group.records}
                            isCurrentMonth={isCurrentMonth}
                            onSelectRecord={(record) => openEdit(record)}
                            onViewAll={() => setViewMode("all")}
                          />
                        );
                      }
                      return (
                        <MedicalYearRow
                          key={`year-${group.year}`}
                          year={group.year}
                          records={group.records}
                          onSelectRecord={(record) => openEdit(record)}
                          onViewAll={() => setViewMode("all")}
                        />
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </BoxContainer>
      )}

      {/* Medical Modal (create / edit) — query-param-driven */}
      {modalTarget && userId && (
        <MedicalModal
          record={modalTarget === "create" ? null : modalTarget}
          attachedDocuments={
            modalTarget !== "create" && modalTarget
              ? documents.filter((d) => modalTarget.document_ids?.includes(d.id))
              : []
          }
          standaloneDocuments={documents.filter(
            (d) => d.domain === "medical" && !d.linked_id,
          )}
          userId={userId}
          onClose={closeModal}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
