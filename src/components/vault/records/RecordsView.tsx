"use client";

import { useCallback } from "react";
import { ROUTES } from "@/routes/paths";
import { fetchVaultEntriesBySection, deleteVaultEntry } from "@/api/vault";
import GenericStorePage from "@/components/common/store/GenericStorePage";
import type { PersonalRecord, VaultRecordItem } from "@/types/vault";
import RecordModal from "./RecordModal";

export default function RecordsView() {
  const fetchData = useCallback(
    (userId: string) => fetchVaultEntriesBySection(userId, "records") as Promise<PersonalRecord[]>,
    [],
  );

  const mapRecordToItem = useCallback(
    (r: PersonalRecord): VaultRecordItem => ({
      id: r.id,
      title: r.name,
      values: [{ value: r.value }],
    }),
    [],
  );

  const onDeleteRecord = useCallback(async (id: string) => { await deleteVaultEntry(id); }, []);
  const onBulkDeleteRecords = useCallback(async (ids: string[]) => {
    for (const id of ids) await deleteVaultEntry(id);
  }, []);

  return (
    <GenericStorePage<PersonalRecord>
      storeType="record"
      title="Personal Records"
      description="Manage your personal reference records."
      backHref={ROUTES.VAULT}
      fetchData={fetchData}
      onDeleteRecord={onDeleteRecord}
      onBulkDeleteRecords={onBulkDeleteRecords}
      itemName="record"
      mapRecordToItem={mapRecordToItem}
      tileLayout="body-only"
      recordModalSlot={({ record, userId, onSaved, onClose }) => (
        <RecordModal userId={userId} record={record} onClose={onClose} onSaved={onSaved} />
      )}
    />
  );
}
