"use client";

import { useCallback, useState } from "react";
import { ROUTES } from "@/routes/paths";
import type { Education } from "@/types/education";
import PageShell from "@/components/common/PageShell";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import GenericViewPage from "@/components/common/GenericViewPage";
import { useEducationActions } from "@/hooks/useEducationActions";
import { useEducationData } from "@/hooks/useEducationData";
import GenericDomainModal from "@/components/common/GenericDomainModal";
import { EDUCATION_COLUMNS, EDUCATION_FIELDS, EDUCATION_LAYOUT } from "@/components/education/config";

export default function EducationAllPage() {
  const { userId, nowYear, nowMonth, isLoading, error, refreshData, educations } =
    useEducationData();

  const [modalTarget, setModalTarget] = useState<Education | null>(null);

  const closeModal = () => setModalTarget(null);

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
        title="All Educations"
        description="Browse all your educations by year and month."
        error={error}
        onRetry={() => userId && refreshData(userId)}
      >
        {isLoading && <LoadingSpinner />}

        {!isLoading && (
          <GenericViewPage
            data={educations}
            columns={EDUCATION_COLUMNS}
            getItemKey={(e) => e.id}
            cacheKeyPrefix="education_all"
            defaultSort={{ column: "due_date", direction: "asc" }}
            supportedViews={["all", "months", "priority"]}
            getDateKey={(e) => e.due_date}
            getPriorityKey={(e) => e.priority}
            itemNamePlural="educations"
            onRowClick={(e) => setModalTarget(e)}
            onBulkDelete={async (ids, clearFn) => {
              for (const id of ids) await handleEducationDelete(id, "cascade");
              clearFn();
            }}
            nowYear={nowYear ?? undefined}
            nowMonth={nowMonth ?? undefined}
          />
        )}
      </PageShell>

      {modalTarget && userId && (
        <GenericDomainModal
          mode="record"
          domain="education"
          target={{
            type: "record",
            id: modalTarget.id,
            data: modalTarget as unknown as Record<string, unknown>,
          }}
          fields={EDUCATION_FIELDS}
          layout={EDUCATION_LAYOUT}
          userId={userId}
          onClose={closeModal}
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
