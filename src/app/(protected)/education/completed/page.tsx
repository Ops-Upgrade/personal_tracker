"use client";

import { useCallback, useMemo, useState } from "react";
import { ROUTES } from "@/routes/paths";
import type { Education } from "@/types/education";
import { PRIORITIES } from "@/types/common";
import PageShell from "@/components/common/PageShell";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import GenericViewPage, { STANDARD_VIEWS } from "@/components/common/GenericViewPage";
import type { ColumnDef, MonthGroup, PriorityGroup } from "@/components/common/GenericViewPage";
import { colFiles } from "@/components/common/columns";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useEducationActions } from "@/hooks/useEducationActions";
import { useEducationData } from "@/hooks/useEducationData";
import { useTableSort, type SortConfig } from "@/hooks/useTableSort";
import {
  completedByMonths,
  byPriority,
  sortByCompletedDesc,
} from "@/lib/viewHelpers";
import GenericDomainModal from "@/components/common/GenericDomainModal";
import { normalizeDateForInput } from "@/lib/utils";
import {
  EDUCATION_FIELDS,
  EDUCATION_LAYOUT,
  EDU_PRIORITY,
  EDU_DUE_DATE,
  EDU_DESCRIPTION,
} from "@/components/education/config";

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

export default function CompletedEducationsPage() {
  const { userId, nowYear, nowMonth, isLoading, error, refreshData, educations, documents } =
    useEducationData();

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
        sizing: "flex",
        weight: 2,
        sortColumn: "name",
        render: (edu) => (
          <span className="font-medium text-zinc-800 dark:text-zinc-100">
            {edu.name || "—"}
          </span>
        ),
      },
      {
        key: "provider",
        header: "Provider",
        sizing: "flex",
        weight: 1,
        sortColumn: "provider",
        render: (edu) => (
          <span className="text-zinc-600 dark:text-zinc-300">
            {edu.provider || "—"}
          </span>
        ),
      },
      EDU_PRIORITY,
      EDU_DUE_DATE,
      EDU_DESCRIPTION,
      colFiles<Education, SortColumn>({
        getCount: (edu) => docCountsByEdu.get(edu.id) ?? 0,
        iconColorClass: "text-amber-500",
      }),
    ],
    [docCountsByEdu],
  );

  const handleEditEducation = (edu: Education) => {
    setEduModalTarget(edu);
  };

  const closeEduModal = () => setEduModalTarget(null);

  // ---- Education CRUD handlers ----

  const refresh = useCallback(async () => {
    if (!userId) return;
    await refreshData(userId);
  }, [userId, refreshData]);

  const { createSaveAdapter, handleEducationDelete, handleDownloadDocument } =
    useEducationActions({ userId, refresh });

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
        <GenericDomainModal
          mode="record"
          title="Edit education"
          fields={EDUCATION_FIELDS}
          layout={EDUCATION_LAYOUT}
          initialData={{
            name: eduModalTarget.name,
            provider: eduModalTarget.provider,
            priority: eduModalTarget.priority,
            due_date: normalizeDateForInput(eduModalTarget.due_date),
            description: eduModalTarget.description,
            is_completed: eduModalTarget.is_completed,
          }}
          allowFiles
          userId={userId || ""}
          attachedDocuments={documents.filter(
            (d) => d.domain === "education" && d.linked_id === eduModalTarget.id,
          )}
          standaloneDocuments={documents.filter(
            (d) => d.domain === "education" && !d.linked_id,
          )}
          domain="education"
          onSave={createSaveAdapter(eduModalTarget)}
          onDeleteWithCascade={(cascadeMode) =>
            handleEducationDelete(eduModalTarget.id, cascadeMode)
          }
          deleteLabel="Delete"
          onDownloadDocument={handleDownloadDocument}
          onClose={closeEduModal}
        />
      )}
    </>
  );
}
