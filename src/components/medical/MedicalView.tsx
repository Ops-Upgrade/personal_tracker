"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ROUTES } from "@/routes/paths";
import BackButton from "@/components/common/BackButton";
import Link from "next/link";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
import {
  createMedicalRecord,
  deleteMedicalRecord,
  fetchMedicalRecords,
  updateMedicalRecord,
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
import ErrorBanner from "@/components/common/ErrorBanner";
import type { MedicalRecord, MedicalPlaintext } from "@/types/medical";
import type { Document, DocumentPlaintext } from "@/types/document";
import GenericActiveBox from "@/components/common/GenericActiveBox";
import type { ViewToggleOption } from "@/components/common/ViewToggle";
import { PRIORITIES } from "@/types/taskmanager";
import PriorityBadge from "@/components/taskmanager/PriorityBadge";
import { getPriorityColor } from "@/lib/priorityColors";
import MedicalModal from "./MedicalModal";
import { trunc } from "@/lib/viewHelpers";

const VIEW_OPTIONS: readonly ViewToggleOption<string>[] = [
  { value: "months", label: "Months" },
];

interface MedicalItem {
  id: string;
  priority: string;
  due_date: string | null;
  name: string;
  clinic: string;
  date: string;
}

function FolderIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
    </svg>
  );
}

/**
 * Medical Records feature shell.
 * Similar to EducationView but without a "completed" section.
 * All records are active — there is no completion concept.
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

  const { userId, nowYear, nowMonth, isLoading, error, refreshData } =
    useAuthBootstrap({ loadData });

  const [view, setView] = useState<string>("months");

  // Hash-driven modal state
  const [modalTarget, setModalTarget] = useState<MedicalRecord | "create" | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = window.location.hash.replace("#", "");
    if (raw === "new-medical") return "create";
    return null;
  });

  const clearHash = useCallback(() => {
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  const resolveHash = useCallback(
    (raw: string) => {
      if (!raw) return null;
      if (raw === "new-medical") return "create" as const;
      if (raw.startsWith("edit-medical-")) {
        const id = raw.slice(13);
        const found = records.find((r) => r.id === id);
        if (found) return found;
      }
      return null;
    },
    [records],
  );

  // Sync initial hash when records load (e.g. navigating from store page)
  useEffect(() => {
    if (records.length === 0) return;
    const raw = window.location.hash.replace("#", "");
    if (raw.startsWith("edit-medical-")) {
      const id = raw.slice(13);
      const found = records.find((r) => r.id === id);
      if (found) setModalTarget(found);
    }
    if (raw === "new-medical" && modalTarget !== "create") {
      setModalTarget("create");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records]);

  // Listen for hash changes (Add button, edit clicks)
  useEffect(() => {
    const handler = () => {
      const raw = window.location.hash.replace("#", "");
      const resolved = resolveHash(raw);
      if (resolved) setModalTarget(resolved);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, [resolveHash]);

  const closeModal = useCallback(() => {
    setModalTarget(null);
    clearHash();
  }, [clearHash]);

  // Convert medical records to active items for GenericActiveBox
  const activeItems: MedicalItem[] = useMemo(
    () =>
      records.map((r) => ({
        id: r.id,
        priority: "medium", // default — medical records have no priority concept
        due_date: r.date,
        name: r.name,
        clinic: r.clinic,
        date: r.date,
      })),
    [records],
  );

  // --- CRUD handlers ---

  async function handleSave(
    draft: {
      name: string;
      clinic: string;
      date: string;
      diagnosis_timeline: string;
    },
    existingRecord: MedicalRecord | null,
    fileAction?: { newFiles: File[]; removeDocIds: string[]; linkDocId?: string },
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

  async function handleDelete(recordId: string) {
    if (!userId) throw new Error("No active session.");

    const record = records.find((r) => r.id === recordId);
    if (record?.document_ids) {
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

    await deleteMedicalRecord(recordId);
    await refreshData(userId);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-start gap-4">
        <BackButton href={ROUTES.DASHBOARD}>← Back</BackButton>
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Medical Records
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Track medical visits, diagnoses, and uploaded reports.
          </p>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <GenericActiveBox
          items={activeItems}
          isLoading={isLoading}
          view={view}
          nowYear={nowYear}
          nowMonth={nowMonth}
          onViewChange={setView}
          onAdd={() => {
            window.location.hash = "new-medical";
          }}
          title="Active Records"
          viewOptions={VIEW_OPTIONS}
          priorities={[...PRIORITIES]}
          getPriorityColor={(p) => getPriorityColor(p as "low" | "medium" | "high" | "critical")}
          renderItem={(item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                const record = records.find((r) => r.id === item.id);
                if (record) {
                  window.location.hash = `edit-medical-${record.id}`;
                }
              }}
              className="w-full text-left"
            >
              <div className="rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/50 transition-colors">
                <div className="font-semibold text-zinc-800 dark:text-zinc-100">
                  {trunc(item.name, 48)}
                </div>
                <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {item.clinic || "—"} &middot; {item.date}
                </div>
              </div>
            </button>
          )}
          renderPriorityBadge={(priority) => (
            <PriorityBadge priority={priority as "low" | "medium" | "high" | "critical"} />
          )}
        />

        <div className="flex flex-col gap-4">
          <Link
            href={ROUTES.MEDICAL_STORE}
            className="flex items-center justify-center gap-2 w-full rounded-xl border border-zinc-200 bg-white p-4 shadow-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800/80 transition-colors"
          >
            <FolderIcon className="h-5 w-5 text-red-500" />
            Document Store
          </Link>
        </div>
      </section>

      {error && (
        <ErrorBanner
          message={error}
          onRetry={() => userId && refreshData(userId)}
        />
      )}

      {/* CRUD modal (hash-driven) */}
      {modalTarget && (
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
          userId={userId ?? ""}
          onClose={closeModal}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
