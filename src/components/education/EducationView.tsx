"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/routes/paths";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useQueryModal } from "@/lib/useQueryModal";
import { useEducationActions } from "@/hooks/useEducationActions";
import { useEducationData } from "@/hooks/useEducationData";
import GenericDomainPage from "@/components/common/GenericDomainPage";
import type { DomainPageContext } from "@/components/common/GenericDomainPage";
import type { Education, EducationViewMode } from "@/types/education";
import GenericDomainModal from "@/components/common/GenericDomainModal";
import { docsForEducation } from "./helpers";
import { normalizeDateForInput } from "@/lib/utils";
import { EDUCATION_FIELDS, EDUCATION_LAYOUT } from "./config";
import ActiveEducationsBox from "./ActiveEducationsBox";
import CompletedEducationsBox from "./CompletedEducationsBox";
import { FolderIcon } from "@/components/common/Icons";

/**
 * Education feature shell.
 * Query-param-driven modals via useQueryModal ("education" prefix).
 * Layout shell delegated to GenericDomainPage (dual-column).
 */
export default function EducationView() {
  const router = useRouter();

  const { userId, istDate, nowYear, nowMonth, isLoading, error, refreshData, educations, documents } =
    useEducationData();

  const refresh = useCallback(async () => {
    if (!userId) return;
    await refreshData(userId);
  }, [userId, refreshData]);

  const { createSaveAdapter, handleEducationDelete, handleDownloadDocument, handleToggleComplete } =
    useEducationActions({ userId, refresh });

  const [activeView, setActiveView] = useLocalStorage<EducationViewMode>("educationActiveView", "months");

  // ── Query-param-driven modal ──

  const { modalTarget, openCreate, openEdit, closeModal } = useQueryModal(educations, "education");

  const openNewEducation = openCreate;
  const openEditEducation = openEdit;

  // ── Derived data ──

  const activeEducations = useMemo(
    () => educations.filter((e) => !e.is_completed),
    [educations],
  );
  const completedEducations = useMemo(
    () => educations.filter((e) => e.is_completed),
    [educations],
  );

  // ── CRUD handlers ──

  function handleQuickComplete(education: Education) {
    handleToggleComplete(education, true);
  }

  // ── Context for GenericDomainPage ──

  const ctx: DomainPageContext = useMemo(
    () => ({ userId, istDate, nowYear, nowMonth, isLoading, error, refreshData }),
    [userId, istDate, nowYear, nowMonth, isLoading, error, refreshData],
  );

  // ── Render ──

  return (
    <GenericDomainPage
      ctx={ctx}
      title="Education"
      description="Track courses, certifications, and uploaded documents."
      backHref={ROUTES.DASHBOARD}
      storeHref={ROUTES.EDUCATION_STORE}
      storeLabel="Certificate Store"
      storeIcon={<FolderIcon className="h-5 w-5 text-amber-500" />}
      completedSlot={
        <CompletedEducationsBox
          educations={completedEducations}
          documents={documents}
          isLoading={isLoading}
          onOpenExpanded={() => router.push(ROUTES.EDUCATION_COMPLETED)}
          onSelectEducation={openEditEducation}
        />
      }
      modalSlot={
        modalTarget && (
          <GenericDomainModal
            mode="record"
            title={modalTarget === "create" ? "Add education" : "Edit education"}
            fields={EDUCATION_FIELDS}
            layout={EDUCATION_LAYOUT}
            initialData={
              modalTarget === "create"
                ? {
                    name: "",
                    provider: "",
                    priority: "medium",
                    due_date: istDate,
                    description: "",
                    is_completed: false,
                  }
                : {
                    name: modalTarget.name,
                    provider: modalTarget.provider,
                    priority: modalTarget.priority,
                    due_date: normalizeDateForInput(modalTarget.due_date),
                    description: modalTarget.description,
                    is_completed: modalTarget.is_completed,
                  }
            }
            allowFiles
            userId={userId || ""}
            attachedDocuments={
              modalTarget !== "create"
                ? docsForEducation(modalTarget.id, documents)
                : []
            }
            standaloneDocuments={documents.filter(
              (d) => d.domain === "education" && !d.linked_id,
            )}
            domain="education"
            onSave={createSaveAdapter(
              modalTarget === "create" ? null : modalTarget,
              modalTarget === "create"
                ? (saved) => openEditEducation(saved)
                : undefined,
            )}
            onDeleteWithCascade={
              modalTarget !== "create"
                ? (cascadeMode) =>
                    handleEducationDelete(modalTarget.id, cascadeMode)
                : undefined
            }
            deleteLabel="Delete"
            onDownloadDocument={handleDownloadDocument}
            onClose={closeModal}
          />
        )
      }
      renderBody={(pageCtx) => (
        <ActiveEducationsBox
          educations={activeEducations}
          documents={documents}
          isLoading={pageCtx.isLoading}
          view={activeView}
          nowYear={pageCtx.nowYear}
          nowMonth={pageCtx.nowMonth}
          onViewChange={setActiveView}
          onAdd={openNewEducation}
          onSelectEducation={openEditEducation}
          onMarkComplete={handleQuickComplete}
        />
      )}
    />
  );
}
