"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/routes/paths";
import { fetchVaultEntriesBySection, deleteVaultEntry, createVaultEntry, updateVaultEntry } from "@/api/vault";
import GenericStorePage from "@/components/common/store/GenericStorePage";
import GenericDomainModal, { type FieldDef } from "@/components/common/GenericDomainModal";
import type { BankEntry, BankEntryPlaintext, VaultRecordItem } from "@/types/vault";

const BANK_FIELDS: FieldDef[] = [
  { key: "bank_name", type: "text", label: "Bank Name", placeholder: "e.g. HDFC Bank" },
];

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
      emptyMessage="No banks added yet. Add your first bank."
      searchPlaceholder="Search banks..."
      onActionClick={(id) => router.push(ROUTES.VAULT_BANK_DETAIL(id))}
      recordModalSlot={({ record, userId, onSaved, onClose }) => {
        const isEditing = !!record;
        return (
          <GenericDomainModal
            mode="record"
            title={isEditing ? "Edit Bank" : "Add Bank"}
            onClose={onClose}
            fields={BANK_FIELDS}
            layout={[["bank_name"]]}
            initialData={{ bank_name: record?.bank_name ?? "" }}
            onSave={async (formData) => {
              const name = (formData.bank_name as string).trim();
              if (!name) throw new Error("Bank name is required.");
              const now = new Date().toISOString();
              const plaintext: BankEntryPlaintext = {
                section: "banks", bank_name: name, pins: record?.pins ?? [], updated_at: now,
              };
              let saved: BankEntry;
              if (isEditing && record) {
                saved = await updateVaultEntry(userId, record.id, plaintext) as BankEntry;
              } else {
                saved = await createVaultEntry(userId, plaintext) as BankEntry;
              }
              onSaved(saved);
            }}
            onDelete={isEditing ? async () => { await deleteVaultEntry(record!.id); onClose(); } : undefined}
            deleteLabel="Delete Bank"
            maxWidthClassName="max-w-md"
          />
        );
      }}
    />
  );
}
