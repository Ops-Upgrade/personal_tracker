"use client";

import { ROUTES } from "@/routes/paths";
import GenericStorePage from "@/components/common/store/GenericStorePage";
import { VAULT_RECORD_FIELDS } from "@/components/vault/storeConfig";

/**
 * Vault Document Store.
 * The vault adapter supplies vault "records" entries as parent records, inline
 * record creation, the linked-record editor, and unlink/bulk-link handlers.
 */
export default function VaultDocumentsPage() {
  return (
    <div className="px-4 pb-6">
      <GenericStorePage
        storeType="doc"
        domain="vault"
        modalFields={VAULT_RECORD_FIELDS}
        title="Document Vault"
        description="Identity documents, scans, and certificates. Files can be linked to any vault record."
        backHref={ROUTES.VAULT}
        allowAdd
      />
    </div>
  );
}
