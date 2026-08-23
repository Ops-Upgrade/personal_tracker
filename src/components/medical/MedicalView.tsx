"use client";

import { useCallback } from "react";
import { ROUTES } from "@/routes/paths";
import { useQueryModal } from "@/lib/useQueryModal";
import { FolderIcon } from "@/components/common/Icons";
import GenericDomainPage from "@/components/common/GenericDomainPage";
import GenericDomainModal from "@/components/common/GenericDomainModal";
import { useMedicalData } from "@/hooks/useMedicalData";
import type { MedicalRecord } from "@/types/medical";
import { MEDICAL_FIELDS, MEDICAL_COLUMNS } from "./config";

/**
 * Medical Records feature shell.
 * "View All" navigates to the dedicated /medical/all route with month/year params.
 * Query-param-driven modals via useQueryModal ("medical" prefix).
 * All structural rendering (year dropdown, month buckets, view toggle,
 * all/single/multi layouts) is owned by GenericDomainPage (full-width).
 */
export default function MedicalView() {
  const { userId, nowYear, nowMonth, isLoading, error, refreshData, records } =
    useMedicalData();

  // Query-param-driven modal state via shared hook
  const { modalTarget, openCreate, openEdit, openEditId, closeModal } = useQueryModal(records, "medical");

  // ── Month row subtitle (record count per month) ──

  const getSubtitle = useCallback((items: MedicalRecord[]) => {
    const count = items.length;
    return <>{count} record{count !== 1 ? "s" : ""}</>;
  }, []);

  // ── Render ──

  return (
    <GenericDomainPage<MedicalRecord>
      data={records}
      columns={MEDICAL_COLUMNS}
      domain="medical"
      getDateKey={(record) => record.date}
      getItemKey={(record) => record.id}
      supportedViews={["all", "single", "multi"]}
      emptyMessage="No medical records found."
      title="Medical Records"
      description="Track and manage your medical history."
      backHref={ROUTES.DASHBOARD}
      onAdd={() => openCreate()}
      isLoading={isLoading}
      error={error}
      onRetry={() => {
        if (userId) void refreshData(userId);
      }}
      nowYear={nowYear}
      nowMonth={nowMonth}
      viewCacheKey="medicalViewMode"
      storeHref={ROUTES.MEDICAL_STORE}
      storeLabel="Document Store"
      storeIcon={<FolderIcon className="h-5 w-5 text-red-500" />}
      headerStat={({ itemsForYear }) => {
        const totalRecords = itemsForYear.filter((r) => !!r.date).length;
        return (
          <p className="mt-2 text-base font-medium text-zinc-700 dark:text-zinc-300">
            Total Records:{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {totalRecords} record{totalRecords !== 1 ? "s" : ""}
            </span>
          </p>
        );
      }}
      viewAllBaseHref={ROUTES.MEDICAL_ALL}
      getSubtitle={getSubtitle}
      onRowClick={openEdit}
      modalSlot={
        modalTarget && userId && (
          <GenericDomainModal
            mode="record"
            domain="medical"
            target={
              modalTarget === "create"
                ? undefined
                : {
                    type: "record",
                    id: modalTarget.id,
                    data: modalTarget as unknown as Record<string, unknown>,
                  }
            }
            fields={MEDICAL_FIELDS}
            userId={userId}
            onClose={closeModal}
            onSaved={async (saved) => {
              await refreshData(userId);
              if (modalTarget === "create") openEditId(saved.id);
            }}
            onDeleted={async () => {
              await refreshData(userId);
            }}
          />
        )
      }
    />
  );
}
