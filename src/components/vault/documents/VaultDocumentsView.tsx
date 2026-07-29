"use client";

import { useState, useEffect, useCallback } from "react";
import GlobalStoreView from "@/components/common/store/GlobalStoreView";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { getSession } from "@/api/auth";
import { fetchVaultEntries } from "@/api/vault";
import { updateDocument } from "@/api/common/documents";
import type { DocumentPlaintext } from "@/types/document";
import type { StoreParentRecord } from "@/components/common/store/StoreDocumentModal";
import { ROUTES } from "@/routes/paths";

/**
 * Document Vault — shows all files with domain="vault".
 *
 * Linked files show the parent record name as a badge.
 * Standalone files show no badge.
 * Uses GlobalStoreView for full tile/list grid with upload, download, link, rename.
 */
export default function VaultDocumentsView() {
  const [userId, setUserId] = useState<string | null>(null);
  const [parentRecords, setParentRecords] = useState<StoreParentRecord[]>([]);

  useEffect(() => {
    async function init() {
      const session = await getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
        // Load all vault entries as parent records for linking
        try {
          const entries = await fetchVaultEntries(session.user.id);
          const records: StoreParentRecord[] = entries.map((e) => ({
            id: e.id,
            name:
              e.section === "banks"
                ? (e as { bank_name: string }).bank_name
                : e.section === "passwords"
                  ? (e as { site_name: string }).site_name
                  : (e as { name: string }).name,
          }));
          setParentRecords(records);
        } catch {
          // Non-critical — parent records just enable linking badges
        }
      }
    }
    init();
  }, []);

  const handleUnlinkFromParent = useCallback(
    async (documentId: string) => {
      if (!userId) return;
      const { fetchDocuments } = await import("@/api/common/documents");
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
    [userId]
  );

  if (!userId) {
    return <LoadingSpinner message="Loading..." />;
  }

  return (
    <div className="px-4 py-6">
      <GlobalStoreView
        domain="vault"
        title="Document Vault"
        description="Identity documents, scans, and certificates. Files can be linked to any vault record."
        backHref={ROUTES.VAULT}
        parentRecords={parentRecords}
        onUnlinkFromParent={handleUnlinkFromParent}
      />
    </div>
  );
}
