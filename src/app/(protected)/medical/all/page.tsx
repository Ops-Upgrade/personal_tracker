"use client";

import { useCallback, useState } from "react";
import { ROUTES } from "@/routes/paths";
import type { MedicalRecord } from "@/types/medical";
import PageShell from "@/components/common/PageShell";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import GenericViewPage from "@/components/common/GenericViewPage";
import GenericDomainModal from "@/components/common/GenericDomainModal";
import { useMedicalActions } from "@/hooks/useMedicalActions";
import { useMedicalData } from "@/hooks/useMedicalData";
import { MEDICAL_FIELDS, MEDICAL_COLUMNS } from "@/components/medical/config";

export default function MedicalAllPage() {
  const { userId, nowYear, nowMonth, isLoading, error, refreshData, records } =
    useMedicalData();

  const [modalTarget, setModalTarget] = useState<MedicalRecord | null>(null);

  const closeModal = () => setModalTarget(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    await refreshData(userId);
  }, [userId, refreshData]);

  const { handleDelete } = useMedicalActions({ userId, refresh });

  return (
    <>
      <PageShell
        backHref={ROUTES.MEDICAL}
        title="All Medical Records"
        description="Browse all your medical records by year and month."
        error={error}
        onRetry={() => userId && refreshData(userId)}
      >
        {isLoading && <LoadingSpinner />}

        {!isLoading && (
          <GenericViewPage
            data={records}
            columns={MEDICAL_COLUMNS}
            getItemKey={(rec) => rec.id}
            cacheKeyPrefix="medical_all"
            defaultSort={{ column: "date", direction: "asc" }}
            supportedViews={["all"]}
            getDateKey={(rec) => rec.date}
            itemNamePlural="medical records"
            onRowClick={(rec) => setModalTarget(rec)}
            onBulkDelete={async (ids, clearFn) => {
              for (const id of ids) await handleDelete(id);
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
          domain="medical"
          target={{
            type: "record",
            id: modalTarget.id,
            data: modalTarget as unknown as Record<string, unknown>,
          }}
          fields={MEDICAL_FIELDS}
          userId={userId}
          onClose={closeModal}
          onSaved={async () => {
            await refresh();
          }}
          onDeleted={async () => {
            await refresh();
          }}
        />
      )}
    </>
  );
}
