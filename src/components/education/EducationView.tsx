"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/routes/paths";
import { useEducationActions } from "@/hooks/useEducationActions";
import { useEducationData } from "@/hooks/useEducationData";
import GenericDomainPage from "@/components/common/GenericDomainPage";
import type { Education } from "@/types/education";
import { PRIORITIES, type Priority } from "@/types/common";
import GenericDomainModal from "@/components/common/GenericDomainModal";
import PriorityBadge from "@/components/common/PriorityBadge";
import Button from "@/components/common/Button";
import type { ColumnDef } from "@/components/common/GenericViewPage";
import { EDUCATION_FIELDS, EDUCATION_LAYOUT, EDU_PRIORITY, EDU_DUE_DATE } from "./config";
import { colRichtext, colFiles } from "@/components/common/columns";
import { getPriorityColor } from "@/lib/priorityColors";
import { useQueryModal } from "@/lib/useQueryModal";
import CompletedEducationsBox from "./CompletedEducationsBox";
import { FolderIcon } from "@/components/common/Icons";

/**
 * Education feature shell.
 * Query-param-driven modals via useQueryModal ("education" prefix).
 * All structural rendering (year dropdown, month buckets, view toggle,
 * priority grouping) is owned by GenericDomainPage.
 */
export default function EducationView() {
  const router = useRouter();

  const { userId, nowYear, nowMonth, isLoading, error, refreshData, educations, documents } =
    useEducationData();

  const refresh = useCallback(async () => {
    if (!userId) return;
    await refreshData(userId);
  }, [userId, refreshData]);

  const { handleDownloadDocument, handleToggleComplete } =
    useEducationActions({ userId, refresh });

  // ── Query-param-driven modal ──

  const { modalTarget, openCreate, openEdit, openEditId, closeModal } = useQueryModal(educations, "education");

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

  const docCountsByEdu = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of documents) {
      if (d.domain === "education" && d.linked_id) {
        map.set(d.linked_id, (map.get(d.linked_id) ?? 0) + 1);
      }
    }
    return map;
  }, [documents]);

  // ── Dashboard column definitions (GenericDomainPage drops the Priority
  //    column automatically in the priority view) ──

  const educationColumns: ColumnDef<Education>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Program Name",
        sizing: "flex",
        weight: 2,
        render: (edu) => (
          <span className="font-semibold text-zinc-800 dark:text-zinc-100">
            {edu.name}
          </span>
        ),
      },
      {
        key: "provider",
        header: "Provider",
        sizing: "flex",
        weight: 1,
        token: { type: "text", accessor: (edu) => edu.provider, color: "muted" },
      },
      EDU_PRIORITY,
      EDU_DUE_DATE,
      colRichtext<Education>({
        key: "description",
        header: "Description",
        accessor: (edu) => edu.description,
        weight: 2,
        className: "text-zinc-700 dark:text-zinc-200",
      }),
      colFiles<Education>({
        getCount: (edu) => docCountsByEdu.get(edu.id) ?? 0,
        iconColorClass: "text-amber-500",
      }),
    ],
    [docCountsByEdu],
  );

  // ── Row helpers passed to GenericDomainPage ──

  const rowAction = useCallback(
    (edu: Education) => (
      <Button
        variant="success"
        size="sm"
        className="w-[85px]"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          handleToggleComplete(edu, true);
        }}
      >
        Complete
      </Button>
    ),
    [handleToggleComplete],
  );

  const getSubtitle = useCallback(
    (items: Education[]) => (
      <>{items.length} education{items.length !== 1 ? "s" : ""}</>
    ),
    [],
  );

  // ── Render ──

  return (
    <GenericDomainPage<Education>
      data={activeEducations}
      columns={educationColumns}
      domain="education"
      getDateKey={(edu) => edu.due_date}
      getItemKey={(edu) => edu.id}
      supportedViews={["months", "priority"]}
      priorities={PRIORITIES}
      getPriorityKey={(edu) => edu.priority ?? "low"}
      getPriorityColor={(p) => getPriorityColor(p as Priority)}
      renderPriorityBadge={(p) => <PriorityBadge priority={p as Priority} showTextOnMobile />}
      title="Education"
      description="Track courses, certifications, and uploaded documents."
      backHref={ROUTES.DASHBOARD}
      onAdd={openNewEducation}
      isLoading={isLoading}
      error={error}
      onRetry={() => {
        void refresh();
      }}
      nowYear={nowYear}
      nowMonth={nowMonth}
      viewCacheKey="educationActiveView"
      viewAllBaseHref={ROUTES.EDUCATION_ALL}
      onRowClick={openEditEducation}
      rowClassName={(edu) => {
        const colors = edu.priority
          ? getPriorityColor(edu.priority)
          : { border: "border-zinc-200" };
        return `border-l-[3px] ${colors.border}`;
      }}
      rowAction={rowAction}
      getSubtitle={getSubtitle}
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
            domain="education"
            target={
              modalTarget === "create"
                ? undefined
                : {
                    type: "record",
                    id: modalTarget.id,
                    data: modalTarget as unknown as Record<string, unknown>,
                  }
            }
            fields={EDUCATION_FIELDS}
            layout={EDUCATION_LAYOUT}
            userId={userId || ""}
            onClose={closeModal}
            onSaved={async (saved) => {
              await refresh();
              if (modalTarget === "create") openEditId(saved.id);
            }}
            onDeleted={async () => {
              await refresh();
            }}
            onDownloadDocument={handleDownloadDocument}
          />
        )
      }
    />
  );
}
