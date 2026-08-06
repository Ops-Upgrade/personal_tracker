"use client";

import { useCallback, useMemo, useState } from "react";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
import {
  createEducation,
  deleteEducation,
  fetchEducations,
  updateEducation,
} from "@/api/education";
import {
  fetchDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
} from "@/api/common/documents";
import {
  uploadDocumentFile,
  downloadDocumentFile,
  deleteDocumentFile,
} from "@/api/common/documentStorage";
import { ROUTES } from "@/routes/paths";
import type { Document, DocumentPlaintext } from "@/types/document";
import type { Education } from "@/types/education";
import type { Priority } from "@/types/common";
import { PRIORITIES } from "@/types/common";
import PageShell from "@/components/common/PageShell";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import PriorityBadge from "@/components/common/PriorityBadge";
import GenericViewPage, { STANDARD_VIEWS } from "@/components/common/GenericViewPage";
import type { ColumnDef, MonthGroup, PriorityGroup } from "@/components/common/GenericViewPage";
import { PaperClipIcon } from "@/components/common/Icons";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useTableSort, type SortConfig } from "@/hooks/useTableSort";
import { trunc } from "@/lib/viewHelpers";
import {
  completedByMonths,
  byPriority,
  sortByCompletedDesc,
} from "@/lib/viewHelpers";
import EducationModal from "@/components/education/EducationModal";

// ── Sort helpers ──

type SortColumn = "name" | "provider" | "priority" | "due_date" | "completed_at";

const PRIORITY_SORT_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const SORT_CONFIGS: SortConfig<SortColumn, Education>[] = [
  { column: "name", extractor: (edu) => edu.name.toLowerCase() },
  { column: "provider", extractor: (edu) => (edu.provider ?? "").toLowerCase() },
  { column: "priority", extractor: (edu) => PRIORITY_SORT_ORDER[edu.priority] ?? 99 },
  {
    column: "due_date",
    extractor: (edu) =>
      edu.due_date
        ? new Date(edu.due_date + "T00:00:00").getTime()
        : Number.MAX_SAFE_INTEGER,
  },
  {
    column: "completed_at",
    extractor: (edu) =>
      edu.completed_at ? new Date(edu.completed_at).getTime() : 0,
  },
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function CompletedEducationsPage() {
  const [educations, setEducations] = useState<Education[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  const loadData = useCallback(async (uid: string) => {
    const [eduRows, docRows] = await Promise.all([
      fetchEducations(uid),
      fetchDocuments(uid),
    ]);
    setEducations(eduRows);
    setDocuments(docRows);
  }, []);

  const { userId, nowYear, nowMonth, isLoading, error, refreshData } =
    useAuthBootstrap({ loadData, fetchServerDate: false });

  const [eduModalTarget, setEduModalTarget] = useState<Education | null>(null);

  // ── Year filtering ──

  const [selectedYear, setSelectedYear] = useState(nowYear);
  const [activeView, setActiveView] = useLocalStorage<string>("educationCompletedView", "all");

  const completedEducations = useMemo(
    () => educations.filter((e) => e.is_completed),
    [educations]
  );

  const availableYears = useMemo(() => {
    const yearsFromData = new Set(
      completedEducations.map((e) => {
        if (!e.completed_at) return nowYear;
        return new Date(e.completed_at).getFullYear();
      })
    );
    yearsFromData.add(nowYear);
    return Array.from(yearsFromData).sort((a, b) => b - a);
  }, [completedEducations, nowYear]);

  const educationsForYear = useMemo(
    () =>
      completedEducations.filter((e) => {
        if (!e.completed_at) return false;
        return new Date(e.completed_at).getFullYear() === selectedYear;
      }),
    [completedEducations, selectedYear]
  );

  const docCountsByEdu = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of documents) {
      if (d.domain === "education" && d.linked_id) {
        map.set(d.linked_id, (map.get(d.linked_id) ?? 0) + 1);
      }
    }
    return map;
  }, [documents]);

  const { sortState, handleSort, sorted } = useTableSort(
    "educationTableSortState",
    educationsForYear,
    SORT_CONFIGS,
  );

  // ── Grouped views ──

  const priorityGroupsRecord = byPriority(educationsForYear, PRIORITIES);
  const priorityGroups: PriorityGroup<Education>[] = useMemo(
    () =>
      PRIORITIES.map((p) => ({
        priority: p,
        items: [...(priorityGroupsRecord[p] ?? [])].sort(sortByCompletedDesc),
      })),
    [priorityGroupsRecord],
  );
  const monthGroups: MonthGroup<Education>[] = completedByMonths(educationsForYear, selectedYear);

  const eduColumns: ColumnDef<Education, SortColumn>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Program Name",
        colSpan: 3,
        sortColumn: "name",
        render: (edu) => (
          <span className="font-medium text-zinc-800 dark:text-zinc-100">
            {trunc(edu.name, 28) || "—"}
          </span>
        ),
      },
      {
        key: "provider",
        header: "Provider",
        colSpan: 2,
        sortColumn: "provider",
        render: (edu) => (
          <span className="text-zinc-600 dark:text-zinc-300">
            {trunc(edu.provider, 22) || "—"}
          </span>
        ),
      },
      {
        key: "priority",
        header: "Priority",
        colSpan: 2,
        sortColumn: "priority",
        render: (edu) =>
          edu.priority ? (
            <PriorityBadge priority={edu.priority as Priority} />
          ) : (
            <span className="text-zinc-400">—</span>
          ),
      },
      {
        key: "due_date",
        header: "Due Date",
        colSpan: 2,
        sortColumn: "due_date",
        render: (edu) => (
          <span className="text-zinc-600 dark:text-zinc-300">
            {edu.due_date ? formatDate(edu.due_date) : "—"}
          </span>
        ),
      },
      {
        key: "completed_at",
        header: "Completed",
        colSpan: 2,
        sortColumn: "completed_at",
        render: (edu) => (
          <span className="text-zinc-600 dark:text-zinc-300">
            {edu.completed_at ? formatDate(edu.completed_at) : "—"}
          </span>
        ),
      },
      {
        key: "files",
        header: "Files",
        colSpan: 1,
        render: (edu) => {
          const docCount = docCountsByEdu.get(edu.id) ?? 0;
          return docCount > 0 ? (
            <span
              className="inline-flex items-center justify-center gap-1 text-amber-500"
              title={`${docCount} document(s) attached`}
            >
              <PaperClipIcon className="h-4 w-4" />
              <span className="text-zinc-600 dark:text-zinc-300">({docCount})</span>
            </span>
          ) : (
            <span className="text-zinc-400">—</span>
          );
        },
      },
    ],
    [docCountsByEdu],
  );

  const handleEditEducation = (edu: Education) => {
    setEduModalTarget(edu);
  };

  const closeEduModal = () => setEduModalTarget(null);

  // ---- Education CRUD handlers ----

  async function handleEducationSave(
    draft: {
      name: string;
      provider: string;
      priority: Priority;
      due_date: string | null;
      description: string;
      is_completed: boolean;
    },
    existingEducation: Education | null,
    pendingDoc?: { file: File; label: string },
    pendingLinkDocId?: string,
    pendingUnlinkDocIds?: string[],
    pendingDeleteDocIds?: string[],
  ) {
    if (!userId) throw new Error("No active session.");

    const freshEdus = await fetchEducations(userId);
    const freshDocs = await fetchDocuments(userId);
    const freshEdu = existingEducation ? freshEdus.find(e => e.id === existingEducation.id) : null;

    let currentDocIds = [...(freshEdu?.document_ids ?? [])];

    const nowIso = new Date().toISOString();
    const completedAt = draft.is_completed
      ? freshEdu?.completed_at ?? nowIso
      : null;

    if (pendingUnlinkDocIds && pendingUnlinkDocIds.length > 0 && existingEducation) {
      for (const docId of pendingUnlinkDocIds) {
        const doc = freshDocs.find(d => d.id === docId);
        if (doc) {
          await updateDocument(userId, docId, {
            ...doc,
            linked_id: "",
            updated_at: nowIso,
          } as DocumentPlaintext);
        }
        currentDocIds = currentDocIds.filter(id => id !== docId);
      }
    }

    if (pendingDeleteDocIds && pendingDeleteDocIds.length > 0) {
      for (const docId of pendingDeleteDocIds) {
        const doc = freshDocs.find(d => d.id === docId);
        if (doc) {
          currentDocIds = currentDocIds.filter(id => id !== docId);
          if (doc.file_name) {
            try { await deleteDocumentFile(userId, doc.file_name); } catch { /* best-effort */ }
          }
          await deleteDocument(docId);
        }
      }
    }

    const payload = {
      ...draft,
      completed_at: completedAt,
      document_ids: currentDocIds,
      updated_at: nowIso,
    };

    let savedEdu: Education;
    if (existingEducation) {
      savedEdu = await updateEducation(userId, existingEducation.id, payload);
    } else {
      savedEdu = await createEducation(userId, payload);
    }

    let needsUpdate = false;
    const newDocIds = [...currentDocIds];

    if (pendingDoc) {
      const { fileName, iv, mimeType } = await uploadDocumentFile(userId, pendingDoc.file);
      const doc = await createDocument(userId, {
        label: pendingDoc.label,
        file_name: fileName,
        file_iv: iv,
        file_mime: mimeType,
        domain: "education",
        linked_id: savedEdu.id,
        updated_at: nowIso,
      });
      newDocIds.push(doc.id);
      needsUpdate = true;
    }

    if (pendingLinkDocId) {
      const pdoc = freshDocs.find(d => d.id === pendingLinkDocId);
      if (pdoc) {
        await updateDocument(userId, pendingLinkDocId, {
          ...pdoc,
          linked_id: savedEdu.id,
          updated_at: nowIso,
        } as DocumentPlaintext);
        if (!newDocIds.includes(pendingLinkDocId)) {
          newDocIds.push(pendingLinkDocId);
        }
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      await updateEducation(userId, savedEdu.id, {
        ...payload,
        document_ids: newDocIds,
        updated_at: new Date().toISOString(),
      });
    }

    await refreshData(userId);
  }

  async function handleEducationDelete(educationId: string, cascadeMode: 'unlink' | 'cascade') {
    if (!userId) throw new Error("No active session.");

    const eduDocs = documents.filter(
      (d) => d.domain === "education" && d.linked_id === educationId
    );

    if (cascadeMode === 'unlink') {
      const nowIso = new Date().toISOString();
      for (const doc of eduDocs) {
        await updateDocument(userId, doc.id, {
          ...doc,
          linked_id: "",
          updated_at: nowIso,
        } as DocumentPlaintext);
      }
    } else {
      for (const doc of eduDocs) {
        if (doc.file_name) {
          try { await deleteDocumentFile(userId, doc.file_name); } catch { /* best-effort */ }
        }
        await deleteDocument(doc.id);
      }
    }

    await deleteEducation(educationId);
    await refreshData(userId);
  }

  async function handleDownloadDocument(doc: Document) {
    if (!userId) throw new Error("No active session.");
    const blob = await downloadDocumentFile(
      userId,
      doc.file_name,
      doc.file_iv,
      doc.file_mime
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.label || "document";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageShell
        backHref={ROUTES.EDUCATION}
        title="Completed Educations"
        description="All your completed courses and certifications."
        error={error}
        onRetry={() => userId && refreshData(userId)}
      >
        {isLoading && <LoadingSpinner />}

        {!isLoading && (
          <GenericViewPage
            items={sorted}
            columns={eduColumns}
            getItemKey={(edu) => edu.id}
            views={STANDARD_VIEWS.COMPLETION_MONTHS_PRIORITY}
            activeView={activeView}
            onViewChange={setActiveView}
            yearFilter={{
              years: availableYears,
              selectedYear,
              onChange: setSelectedYear,
            }}
            sortState={sortState}
            onSortChange={handleSort}
            emptyMessage={`No educations completed in ${selectedYear}.`}
            onRowClick={handleEditEducation}
            monthGroups={monthGroups}
            priorityGroups={priorityGroups}
            nowYear={nowYear}
            nowMonth={nowMonth}
          />
        )}
      </PageShell>

      {eduModalTarget && (
        <EducationModal
          education={eduModalTarget}
          documents={documents}
          userId={userId || ""}
          onClose={closeEduModal}
          onSave={handleEducationSave}
          onDelete={handleEducationDelete}
          onDownloadDocument={handleDownloadDocument}
        />
      )}
    </>
  );
}
