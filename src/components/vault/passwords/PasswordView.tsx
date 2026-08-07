"use client";

import { useCallback } from "react";
import { ROUTES } from "@/routes/paths";
import { fetchVaultEntriesBySection, deleteVaultEntry } from "@/api/vault";
import GenericStorePage from "@/components/common/store/GenericStorePage";
import type { PasswordEntry, VaultRecordItem } from "@/types/vault";
import PasswordModal from "./PasswordModal";

export default function PasswordView() {
  const fetchData = useCallback(
    (userId: string) => fetchVaultEntriesBySection(userId, "passwords") as Promise<PasswordEntry[]>,
    [],
  );

  const mapRecordToItem = useCallback(
    (p: PasswordEntry): VaultRecordItem => ({
      id: p.id,
      title: p.site_name,
      values: [
        { label: "Username", value: p.username },
        { label: "Password", value: p.password, isSecret: true },
      ],
    }),
    [],
  );

  const onDeleteRecord = useCallback(async (id: string) => { await deleteVaultEntry(id); }, []);
  const onBulkDeleteRecords = useCallback(async (ids: string[]) => {
    for (const id of ids) await deleteVaultEntry(id);
  }, []);

  return (
    <GenericStorePage<PasswordEntry>
      storeType="record"
      title="Password Manager"
      description="Manage your saved passwords and credentials."
      backHref={ROUTES.VAULT}
      fetchData={fetchData}
      onDeleteRecord={onDeleteRecord}
      onBulkDeleteRecords={onBulkDeleteRecords}
      itemName="password"
      itemNamePlural="passwords"
      mapRecordToItem={mapRecordToItem}
      emptyMessage="No passwords stored yet. Add your first credential."
      searchPlaceholder="Search passwords..."
      recordModalSlot={({ record, userId, onSaved, onClose }) => (
        <PasswordModal userId={userId} entry={record} onClose={onClose} onSaved={onSaved} />
      )}
    />
  );
}
