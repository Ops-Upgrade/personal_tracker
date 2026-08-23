"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/routes/paths";
import { deleteVaultEntry } from "@/api/vault";
import GenericStorePage, { type HeaderAction } from "@/components/common/store/GenericStorePage";
import { PIN_FIELDS } from "@/components/vault/storeConfig";

/**
 * Bank detail store. The vault_bank_details adapter supplies fetching (bank
 * name becomes the page title; "Bank not found." surfaces as an error banner),
 * PIN CRUD against the bank entry, and the PIN modal.
 */
export default function BankDetailPage({ params }: { params: Promise<{ bankId: string }> }) {
  const { bankId } = use(params);
  const router = useRouter();

  const headerActions: HeaderAction[] = [
    {
      label: "Delete Bank",
      variant: "danger",
      requireConfirm: true,
      confirmTitle: "Delete Bank?",
      confirmDescription:
        "Are you sure you want to permanently delete this bank and all its PINs? This action cannot be undone.",
      confirmLabel: "Delete",
      onAction: async () => {
        await deleteVaultEntry(bankId);
        router.push(ROUTES.VAULT_BANKS);
      },
    },
  ];

  return (
    <GenericStorePage
      storeType="record"
      domain="vault_bank_details"
      scope={{ bankId }}
      modalFields={PIN_FIELDS}
      title=""
      description="Edit cards and pins for this bank."
      backHref={ROUTES.VAULT_BANKS}
      allowAdd
      headerActions={headerActions}
    />
  );
}
