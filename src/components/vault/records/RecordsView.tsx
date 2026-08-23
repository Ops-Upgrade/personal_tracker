"use client";

import { ROUTES } from "@/routes/paths";
import GenericStorePage from "@/components/common/store/GenericStorePage";
import { VAULT_RECORD_FIELDS } from "@/components/vault/storeConfig";

/**
 * Personal records store. The vault_records adapter supplies fetching,
 * attached-file mapping, and the record modal with file linking.
 */
export default function RecordsView() {
  return (
    <GenericStorePage
      storeType="record"
      domain="vault_records"
      modalFields={VAULT_RECORD_FIELDS}
      title="Personal Records"
      description="Manage your personal reference records."
      backHref={ROUTES.VAULT}
      allowAdd
    />
  );
}
