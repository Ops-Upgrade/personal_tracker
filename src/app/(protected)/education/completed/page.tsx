"use client";

import { useCallback, useMemo, useState } from "react";
import { ROUTES } from "@/routes/paths";
import type { Education } from "@/types/education";
import PageShell from "@/components/common/PageShell";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import GenericViewPage, { type ColumnDef } from "@/components/common/GenericViewPage";
import { colFiles } from "@/components/common/columns";
import { useEducationActions } from "@/hooks/useEducationActions";
import { useEducationData } from "@/hooks/useEducationData";
import GenericDomainModal from "@/components/common/GenericDomainModal";
import {
  EDUCATION_FIELDS,
  EDUCATION_LAYOUT,
  EDU_PRIORITY,
  EDU_DUE_DATE,
  EDU_DESCRIPTION,
} from "@/components/education/config";

type SortColumn = "name" | "provider" | "priority" | "due_date";

export default function CompletedEducationsPage() {
  const { userId, nowYear, nowMonth, isLoading, error, refreshData, educations, documents } =
    useEducationData();

  const [eduModalTarget, setEduModalTarget] = useState<Education | null>(null);

  const closeEduModal = () => setEduModalTarget(null);

  const docCountsByEdu = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of documents) {
      if (d.domain === "education" && d.linked_id) {
        map.set(d.linked_id, (map.get(d.linked_id) ?? 0) + 1);
      }
    }
    return map;
  }, [documents]);

  // ── Column definitions (declarative tokens — the grid renders them) ──

  const eduColumns: ColumnDef<Education, SortColumn>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Program Name",
        sizing: "flex",
        weight: 2,
        sortColumn: "name",
        token: { type: "text", accessor: (edu) => edu.name, color: "strong" },
      },
      {
        key: "provider",
        header: "Provider",
        sizing: "flex",
        weight: 1,
        sortColumn: "provider",
        token: { type: "text", accessor: (edu) => edu.provider, color: "muted" },
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

  const refresh = useCallback(async () => {
    if (!userId) return;
    await refreshData(userId);
  }, [userId, refreshData]);

  const { handleEducationDelete, handleDownloadDocument } =
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
            data={educations.filter((e) => e.is_completed)}
            columns={eduColumns}
            getItemKey={(edu) => edu.id}
            cacheKeyPrefix="education_completed"
            // No default sort — preserve the unsorted API order until the user sorts.
            defaultSort={null}
            supportedViews={["all", "months", "priority"]}
            getDateKey={(e) => e.completed_at}
            getPriorityKey={(e) => e.priority}
            monthsMode="completed"
            itemNamePlural="completed educations"
            onRowClick={(edu) => setEduModalTarget(edu)}
            onBulkDelete={async (ids, clearFn) => {
              for (const id of ids) await handleEducationDelete(id, "cascade");
              clearFn();
            }}
            nowYear={nowYear ?? undefined}
            nowMonth={nowMonth ?? undefined}
          />
        )}
      </PageShell>

      {eduModalTarget && userId && (
        <GenericDomainModal
          mode="record"
          domain="education"
          target={{
            type: "record",
            id: eduModalTarget.id,
            data: eduModalTarget as unknown as Record<string, unknown>,
          }}
          fields={EDUCATION_FIELDS}
          layout={EDUCATION_LAYOUT}
          userId={userId}
          onClose={closeEduModal}
          onSaved={async () => {
            await refresh();
          }}
          onDeleted={async () => {
            await refresh();
          }}
          onDownloadDocument={handleDownloadDocument}
        />
      )}
    </>
  );
}
