"use client";

import { useCallback } from "react";
import { ROUTES } from "@/routes/paths";
import { fetchVaultEntriesBySection, deleteVaultEntry, createVaultEntry, updateVaultEntry } from "@/api/vault";
import GenericStorePage from "@/components/common/store/GenericStorePage";
import GenericDomainModal, { type FieldDef } from "@/components/common/GenericDomainModal";
import type { PasswordEntry, PasswordEntryPlaintext, VaultRecordItem } from "@/types/vault";

const PASSWORD_FIELDS: FieldDef[] = [
  { key: "site_name", type: "text", label: "Site Name", placeholder: "e.g. Gmail" },
  { key: "username", type: "text", label: "Username", placeholder: "Your username or email", isCopyable: true },
  { key: "password", type: "password", label: "Password", placeholder: "Password", isCopyable: true },
];

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
      recordModalSlot={({ record, userId, onSaved, onClose }) => {
        const isEditing = !!record;
        return (
          <GenericDomainModal
            mode="record"
            title={isEditing ? "Edit Credential" : "Add Credential"}
            onClose={onClose}
            fields={PASSWORD_FIELDS}
            layout={[["site_name"], ["username"], ["password"]]}
            initialData={{
              site_name: record?.site_name ?? "",
              username: record?.username ?? "",
              password: record?.password ?? "",
            }}
            onSave={async (formData) => {
              const sn = (formData.site_name as string).trim();
              const un = (formData.username as string).trim();
              const pw = (formData.password as string).trim();
              if (!sn || !un || !pw) throw new Error("Site name, username, and password are required.");
              const now = new Date().toISOString();
              const plaintext: PasswordEntryPlaintext = {
                section: "passwords", site_name: sn, username: un, password: pw, updated_at: now,
              };
              let saved: PasswordEntry;
              if (isEditing && record) {
                saved = await updateVaultEntry(userId, record.id, plaintext) as PasswordEntry;
              } else {
                saved = await createVaultEntry(userId, plaintext) as PasswordEntry;
              }
              onSaved(saved);
            }}
            onDelete={isEditing ? async () => { await deleteVaultEntry(record!.id); onClose(); } : undefined}
            deleteLabel="Delete Credential"
            maxWidthClassName="max-w-md"
          />
        );
      }}
    />
  );
}
