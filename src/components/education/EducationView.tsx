"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/routes/paths";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useQueryModal } from "@/lib/useQueryModal";
import { useEducationActions } from "@/hooks/useEducationActions";
import { useEducationData } from "@/hooks/useEducationData";
import GenericDomainPage from "@/components/common/GenericDomainPage";
import type { DomainPageContext } from "@/components/common/GenericDomainPage";
import type { Education, EducationViewMode } from "@/types/education";
import type { Priority } from "@/types/common";
import ActiveEducationsBox from "./ActiveEducationsBox";
import CompletedEducationsBox from "./CompletedEducationsBox";
import EducationModal from "./EducationModal";
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

  const { handleEducationSave: rawHandleEducationSave, handleEducationDelete, handleDownloadDocument } =
    useEducationActions({ userId, refresh });

  const [activeView, setActiveView] = useLocalStorage<EducationViewMode>("educationActiveView", "months");

  // ── Query-param-driven modal ──

  const { modalTarget, openCreate, openEdit, closeModal } = useQueryModal(educations, "education");

  // State bridge for quick-complete
  const [quickCompleteTarget, setQuickCompleteTarget] = useState<Education | null>(null);

  const eduModalTarget = quickCompleteTarget ?? modalTarget;
  const openNewEducation = openCreate;
  const openEditEducation = openEdit;

  const closeEduModal = useCallback(() => {
    closeModal();
    setQuickCompleteTarget(null);
  }, [closeModal]);

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

  const handleEducationSave = useCallback(
    async (
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
    ) => {
      const savedEdu = await rawHandleEducationSave(
        draft,
        existingEducation,
        pendingDoc,
        pendingLinkDocId,
        pendingUnlinkDocIds,
        pendingDeleteDocIds,
      );
      if (!existingEducation && savedEdu) {
        openEditEducation(savedEdu);
      }
    },
    [rawHandleEducationSave, openEditEducation],
  );

  function handleQuickComplete(education: Education) {
    setQuickCompleteTarget({ ...education, is_completed: true });
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
        eduModalTarget && (
          <EducationModal
            education={eduModalTarget === "create" ? null : eduModalTarget}
            defaultDate={eduModalTarget === "create" ? istDate : undefined}
            documents={documents}
            userId={userId || ""}
            onClose={closeEduModal}
            onSave={handleEducationSave}
            onDelete={handleEducationDelete}
            onDownloadDocument={handleDownloadDocument}
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
