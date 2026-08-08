"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/routes/paths";
import { fetchVaultEntriesBySection, deleteVaultEntry } from "@/api/vault";
import GenericStorePage from "@/components/common/store/GenericStorePage";
import type { BankEntry, VaultRecordItem } from "@/types/vault";
import BankModal from "./BankModal";

export default function BankListView() {
  const router = useRouter();

  const fetchData = useCallback(
    (userId: string) => fetchVaultEntriesBySection(userId, "banks") as Promise<BankEntry[]>,
    [],
  );

  const mapRecordToItem = useCallback(
    (b: BankEntry): VaultRecordItem => ({
      id: b.id,
      title: b.bank_name,
      values: [{ label: "PINs", value: `${b.pins.length} saved`, isCopyable: false }],
    }),
    [],
  );

  const onDeleteRecord = useCallback(async (id: string) => { await deleteVaultEntry(id); }, []);
  const onBulkDeleteRecords = useCallback(async (ids: string[]) => {
    for (const id of ids) await deleteVaultEntry(id);
  }, []);

  return (
    <GenericStorePage<BankEntry>
      storeType="record"
      title="Bank Details"
      description="Manage your saved bank accounts and PINs."
      backHref={ROUTES.VAULT}
      fetchData={fetchData}
      onDeleteRecord={onDeleteRecord}
      onBulkDeleteRecords={onBulkDeleteRecords}
      itemName="bank account"
      itemNamePlural="bank accounts"
      singleDeleteDescription="This will permanently delete this bank entry and all its PINs. This action cannot be undone."
      mapRecordToItem={mapRecordToItem}
      disableSelection
      emptyMessage="No banks added yet. Add your first bank."
      searchPlaceholder="Search banks..."
      onActionClick={(id) => router.push(ROUTES.VAULT_BANK_DETAIL(id))}
      recordModalSlot={({ record, userId, onSaved, onClose }) => (
        <BankModal userId={userId} bank={record} onClose={onClose} onSaved={onSaved} />
      )}
    />
  );
}
