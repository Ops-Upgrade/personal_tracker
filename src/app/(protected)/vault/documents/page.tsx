"use client";

import { useCallback } from "react";
import { ROUTES } from "@/routes/paths";
import { fetchVaultEntries } from "@/api/vault";
import { fetchDocuments, updateDocument } from "@/api/common/documents";
import type { DocumentPlaintext } from "@/types/document";
import type { VaultEntry } from "@/types/vault";
import GenericStorePage from "@/components/common/store/GenericStorePage";

/**
 * Document Vault — shows all files with domain="vault".
 *
 * Linked files show the parent record name as a badge.
 * Uses GenericStorePage for auth, data loading, and display.
 */
export default function VaultDocumentsPage() {
  // --- fetchData ---
  const fetchData = useCallback(async (userId: string) => {
    const [entries, docs] = await Promise.all([
      fetchVaultEntries(userId),
      fetchDocuments(userId),
    ]);
    return { domainRows: entries, documents: docs };
  }, []);

  // --- deriveParentRecords ---
  const deriveParentRecords = useCallback((rows: VaultEntry[]) => {
    return rows.map((e) => {
      let name: string;
      if (e.section === "banks") {
        name = (e as { bank_name: string }).bank_name;
      } else if (e.section === "passwords") {
        name = (e as { site_name: string }).site_name;
      } else {
        name = (e as { name: string }).name;
      }
      return { id: e.id, name };
    });
  }, []);

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
    <div className="px-4 py-6">
      <GenericStorePage
        domain="vault"
        title="Document Vault"
        description="Identity documents, scans, and certificates. Files can be linked to any vault record."
        backHref={ROUTES.VAULT}
        fetchData={fetchData}
        deriveParentRecords={deriveParentRecords}
        onUnlinkFromParent={handleUnlinkFromParent}
      />
    </div>
  );
}
