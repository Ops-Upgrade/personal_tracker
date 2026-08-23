"use client";

import { ROUTES } from "@/routes/paths";
import GenericStorePage from "@/components/common/store/GenericStorePage";
import { BANK_FIELDS } from "@/components/vault/storeConfig";

/**
 * Bank list store. The vault_banks adapter supplies fetching, PIN-count
 * mapping, row navigation into bank details, and the bank modal.
 */
export default function BankListView() {
  return (
    <GenericStorePage
      storeType="record"
      domain="vault_banks"
      modalFields={BANK_FIELDS}
      title="Bank Details"
      description="Manage your saved bank accounts and PINs."
      backHref={ROUTES.VAULT}
      allowAdd
    />
  );
}
