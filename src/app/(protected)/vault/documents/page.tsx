"use client";

import { useCallback, useState } from "react";
import { ROUTES } from "@/routes/paths";
import { fetchVaultEntries, createVaultEntry } from "@/api/vault";
import { fetchDocuments, updateDocument } from "@/api/common/documents";
import { InputField } from "@/components/common/FormField";
import type { DocumentPlaintext } from "@/types/document";
import type { PersonalRecordPlaintext, VaultEntry } from "@/types/vault";
import GenericStorePage from "@/components/common/store/GenericStorePage";

/**
 * Document Vault — shows all files with domain="vault".
 *
 * Linked files show the parent record name as a badge.
 * Uses GenericStorePage for auth, data loading, and display.
 */
export default function VaultDocumentsPage() {
  // --- Inline record creation form state ---
  const [newRecordName, setNewRecordName] = useState("");
  const [newRecordValue, setNewRecordValue] = useState("");
  // --- fetchData ---
  const fetchData = useCallback(async (userId: string) => {
    const [entries, docs] = await Promise.all([
      fetchVaultEntries(userId),
      fetchDocuments(userId),
    ]);
    return { domainRows: entries, documents: docs };
  }, []);

  // --- deriveParentRecords (only "records" section — banks/passwords excluded) ---
  const deriveParentRecords = useCallback((rows: VaultEntry[]) => {
    return rows
      .filter((e) => e.section === "records")
      .map((e) => ({ id: e.id, name: (e as { name: string }).name }));
  }, []);

  // --- Inline record creation form ---

  const renderNewRecordForm = useCallback(
    ({ disabled, isSaving }: { disabled: boolean; isSaving: boolean }) => (
      <fieldset disabled={disabled || isSaving} className="space-y-3">
        <InputField
          label="Record Name"
          value={newRecordName}
          onChange={setNewRecordName}
          disabled={isSaving || disabled}
          placeholder="e.g. Aadhaar Number"
        />
        <InputField
          label="Value"
          value={newRecordValue}
          onChange={setNewRecordValue}
          disabled={isSaving || disabled}
          placeholder="The reference number or ID"
        />
      </fieldset>
    ),
    [newRecordName, newRecordValue],
  );

  const extractNewRecordData = useCallback((): Record<string, string> | null => {
    if (!newRecordName.trim()) return null;
    return { name: newRecordName.trim(), value: newRecordValue.trim() };
  }, [newRecordName, newRecordValue]);

  const handleCreateParentFromStore = useCallback(
    async (
      data: Record<string, string>,
      userId: string,
      refreshAll: () => Promise<void>,
    ): Promise<string> => {
      const nowIso = new Date().toISOString();
      const plaintext: PersonalRecordPlaintext = {
        section: "records",
        name: data.name || "",
        value: data.value || "",
        updated_at: nowIso,
      };
      const entry = await createVaultEntry(userId, plaintext);
      await refreshAll();
      setNewRecordName("");
      setNewRecordValue("");
      return entry.id;
    },
    [],
  );

  // --- onUnlinkFromParent ---
  const handleUnlinkFromParent = useCallback(
    async (
      documentId: string,
      _parentId: string,
      userId: string,
    ) => {
      const docs = await fetchDocuments(userId);
      const d = docs.find((x) => x.id === documentId);
      if (!d) return;
      const now = new Date().toISOString();
      await updateDocument(userId, documentId, {
        ...d,
        linked_id: "",
        updated_at: now,
      } as DocumentPlaintext);
    },
    [],
  );

  return (
    <div className="px-4 pb-6">
      <GenericStorePage
        domain="vault"
        title="Document Vault"
        description="Identity documents, scans, and certificates. Files can be linked to any vault record."
        backHref={ROUTES.VAULT}
        fetchData={fetchData}
        deriveParentRecords={deriveParentRecords}
        onUnlinkFromParent={handleUnlinkFromParent}
        renderNewRecordForm={renderNewRecordForm}
        extractNewRecordData={extractNewRecordData}
        onCreateParentFromStore={handleCreateParentFromStore}
      />
    </div>
  );
}
