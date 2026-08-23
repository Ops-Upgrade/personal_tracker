"use client";

import { ROUTES } from "@/routes/paths";
import GenericStorePage from "@/components/common/store/GenericStorePage";
import { PASSWORD_FIELDS } from "@/components/vault/storeConfig";

/**
 * Password manager store. The vault_passwords adapter supplies fetching,
 * secret-value mapping, and the credential modal.
 */
export default function PasswordView() {
  return (
    <GenericStorePage
      storeType="record"
      domain="vault_passwords"
      modalFields={PASSWORD_FIELDS}
      title="Password Manager"
      description="Manage your saved passwords and credentials."
      backHref={ROUTES.VAULT}
      allowAdd
    />
  );
}
