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
import { useLocalStorage } from "@/lib/useLocalStorage";
import { ROUTES } from "@/routes/paths";
import type { Document, DocumentPlaintext } from "@/types/document";
import type { Education, EducationPlaintext, EducationViewMode } from "@/types/education";
import type { Priority } from "@/types/taskmanager";
import { PRIORITIES } from "@/types/taskmanager";
import type { ViewToggleOption } from "@/components/common/ViewToggle";
import ViewToggle from "@/components/common/ViewToggle";
import MonthTile from "@/components/common/MonthTile";
import BoxContainer, { SCROLLABLE_CLASSES } from "@/components/common/BoxContainer";
import PageShell from "@/components/common/PageShell";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import PriorityBadge from "@/components/taskmanager/PriorityBadge";
import { getPriorityColor } from "@/lib/priorityColors";
import {
  byPriority,
  docCountForEducation,
  completedByMonths,
  sortByCompletedDesc,
  formatShortDate,
  trunc,
} from "@/components/education/helpers";
import EducationModal from "@/components/education/EducationModal";
import { MONTH_NAMES } from "@/lib/constants";

const VIEW_OPTIONS: readonly ViewToggleOption<EducationViewMode>[] = [
  { value: "months", label: "Months" },
  { value: "priority", label: "Priority" },
];

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

  const [view, setView] = useLocalStorage<EducationViewMode>("educationCompletedView", "months");
  const [eduModalTarget, setEduModalTarget] = useState<Education | null>(null);

  const completedEducations = useMemo(
    () => educations.filter((e) => e.is_completed),
    [educations]
  );

  const priorityGroups = byPriority(completedEducations);
  const monthGroups = completedByMonths(completedEducations, nowYear);

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

  async function handleLinkDocument(educationId: string, documentId: string) {
    if (!userId) throw new Error("No active session.");
    const doc = documents.find((d) => d.id === documentId);
    if (!doc) return;
    const nowIso = new Date().toISOString();
    await updateDocument(userId, documentId, {
      ...doc,
      linked_id: educationId,
      updated_at: nowIso,
    } as DocumentPlaintext);
    const edu = educations.find(e => e.id === educationId);
    if (edu && !edu.document_ids.includes(documentId)) {
      await updateEducation(userId, educationId, {
        ...edu,
        document_ids: [...edu.document_ids, documentId],
        updated_at: nowIso
      } as EducationPlaintext);
    }
    await refreshData(userId);
  }

  async function handleUnlinkDocument(educationId: string, documentId: string) {
    if (!userId) throw new Error("No active session.");
    const doc = documents.find((d) => d.id === documentId);
    if (!doc) return;
    const nowIso = new Date().toISOString();
    await updateDocument(userId, documentId, {
      ...doc,
      linked_id: "",
      updated_at: nowIso,
    } as DocumentPlaintext);
    const edu = educations.find(e => e.id === educationId);
    if (edu) {
      const newDocIds = edu.document_ids.filter(id => id !== documentId);
      await updateEducation(userId, educationId, {
        ...edu,
        document_ids: newDocIds,
        updated_at: nowIso
      } as EducationPlaintext);
    }
    await refreshData(userId);
  }

  async function handleUploadDocumentForEducation(
    educationId: string,
    file: File,
    label: string
  ) {
    if (!userId) throw new Error("No active session.");
    const nowIso = new Date().toISOString();
    const { fileName, iv, mimeType } = await uploadDocumentFile(userId, file);
    const doc = await createDocument(userId, {
      label,
      file_name: fileName,
      file_iv: iv,
      file_mime: mimeType,
      domain: "education",
      linked_id: educationId,
      updated_at: nowIso,
    });
    const edu = educations.find(e => e.id === educationId);
    if (edu) {
      await updateEducation(userId, edu.id, {
        ...edu,
        document_ids: [...edu.document_ids, doc.id],
        updated_at: nowIso,
      } as EducationPlaintext);
    }
    await refreshData(userId);
    return doc;
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

  async function handleDeleteDocumentFromEducation(doc: Document, cascadeMode: 'unlink' | 'cascade') {
    if (!userId) throw new Error("No active session.");

    if (cascadeMode === 'cascade' && doc.linked_id) {
       await deleteEducation(doc.linked_id);
    } else if (cascadeMode === 'unlink' && doc.linked_id) {
      const edu = educations.find((e) => e.id === doc.linked_id);
      if (edu) {
        const nowIso = new Date().toISOString();
        const newDocIds = edu.document_ids.filter((id) => id !== doc.id);
        await updateEducation(userId, edu.id, {
          ...edu,
          document_ids: newDocIds,
          updated_at: nowIso,
        } as EducationPlaintext);
      }
    }

    if (doc.file_name) {
      try { await deleteDocumentFile(userId, doc.file_name); } catch {}
    }

    await deleteDocument(doc.id);
    await refreshData(userId);
  }

  return (
    <>
      <PageShell
        backHref={ROUTES.EDUCATION}
        backLabel="← Back to Education"
        title="Completed Educations"
        description="All your completed courses and certifications."
        error={error}
        onRetry={() => userId && refreshData(userId)}
      >
      {isLoading && <LoadingSpinner />}

      {!isLoading && (
        <BoxContainer>
          <header className="mb-3">
            <ViewToggle
              value={view}
              onChange={setView}
              options={VIEW_OPTIONS}
              ariaLabel="Completed educations view toggle"
            />
          </header>

          <div className={`${SCROLLABLE_CLASSES} space-y-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800`}>
            {completedEducations.length === 0 && (
              <div className="text-sm text-zinc-500 dark:text-zinc-400">None</div>
            )}

            {view === "priority" &&
              PRIORITIES.map((priority) => {
                const group = [...(priorityGroups[priority as Priority] ?? [])].sort(sortByCompletedDesc);
                if (group.length === 0) return null;
                const colors = getPriorityColor(priority as Priority);
                return (
                  <section
                    key={priority}
                    className={`rounded-lg border ${colors.border} ${colors.bg} p-2`}
                  >
                    <h3 className="mb-2">
                      <PriorityBadge priority={priority as Priority} />
                    </h3>
                    <div className="space-y-2">
                      {group.map((edu) => {
                        const docCount = docCountForEducation(edu.id, documents);
                        return (
                        <div
                          key={edu.id}
                          className={`grid w-full grid-cols-12 items-center gap-2 rounded-md border border-zinc-200 px-2 py-1.5 text-left text-sm dark:border-zinc-700 border-l-[3px] ${colors.border}`}
                        >
                          <button
                            type="button"
                            onClick={() => handleEditEducation(edu)}
                            className="col-span-7 cursor-pointer text-left font-semibold text-zinc-800 hover:text-zinc-900 dark:text-zinc-100 dark:hover:text-white"
                          >
                            {trunc(edu.name, 42)}
                          </button>
                          <span className="col-span-2 text-center">
                            {docCount > 0 ? (
                              <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                {docCount} file{docCount !== 1 ? "s" : ""}
                              </span>
                            ) : (
                              <span className="text-xs text-zinc-400">—</span>
                            )}
                          </span>
                          <span className="col-span-3 text-right pr-2 text-zinc-600 dark:text-zinc-300">
                            {formatShortDate(edu.completed_at)}
                          </span>
                        </div>
                      )})}
                    </div>
                  </section>
                );
              })}

            {view === "months" &&
              monthGroups.map((group, index) => {
                const isCurrentMonth = MONTH_NAMES[nowMonth] === group.label;
                return (
                  <MonthTile
                    key={group.label}
                    title={group.label}
                    defaultExpanded={index === 0}
                    accent
                    className="text-sm"
                    highlight={isCurrentMonth}
                  >
                    <div className="space-y-2">
                      {group.items.map((edu) => {
                        const colors = getPriorityColor((edu as Education).priority);
                        const docCount = docCountForEducation(edu.id, documents);
                        return (
                          <div
                            key={edu.id}
                            className={`grid w-full grid-cols-12 items-center gap-2 rounded-md border border-zinc-200 px-2 py-1.5 text-left text-sm dark:border-zinc-700 border-l-[3px] ${colors.border}`}
                          >
                            <button
                              type="button"
                              onClick={() => handleEditEducation(edu)}
                              className="col-span-5 cursor-pointer text-left font-semibold text-zinc-800 hover:text-zinc-900 dark:text-zinc-100 dark:hover:text-white"
                            >
                              {trunc(edu.name, 32)}
                            </button>
                            <span className="col-span-2">
                              {(edu as Education).priority ? (
                                <PriorityBadge priority={(edu as Education).priority} />
                              ) : (
                                "-"
                              )}
                            </span>
                            <span className="col-span-2 text-center">
                              {docCount > 0 ? (
                                <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                  {docCount} file{docCount !== 1 ? "s" : ""}
                                </span>
                              ) : (
                                <span className="text-xs text-zinc-400">—</span>
                              )}
                            </span>
                            <span className="col-span-3 text-right pr-2 text-zinc-600 dark:text-zinc-300">
                              {formatShortDate(edu.completed_at)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </MonthTile>
                );
              })}
          </div>
        </BoxContainer>
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
          onUploadDocument={handleUploadDocumentForEducation}
          onDownloadDocument={handleDownloadDocument}
          onDeleteDocument={handleDeleteDocumentFromEducation}
          onLinkDocument={handleLinkDocument}
          onUnlinkDocument={handleUnlinkDocument}
        />
      )}
    </>
  );
}
