"use client";

import { useState, useEffect } from "react";
import GlobalActionModal from "@/components/common/GlobalActionModal";
import { InputField } from "@/components/common/FormField";
import { useActionForm } from "@/hooks/useActionForm";
import { createVaultEntry, updateVaultEntry, deleteVaultEntry } from "@/api/vault";
import type { BankEntry, BankEntryPlaintext } from "@/types/vault";

interface BankModalProps {
  userId: string;
  bank?: BankEntry | null;
  onClose: () => void;
  onSaved: (entry: BankEntry) => void;
}

export default function BankModal({ userId, bank, onClose, onSaved }: BankModalProps) {
  const isEditing = !!bank;

  const [bankName, setBankName] = useState(bank?.bank_name ?? "");

  const { isSaving, error, setError, withSubmit } = useActionForm();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- by-design: sync form state when editing a different bank
    setBankName(bank?.bank_name ?? "");
    setError(null);
  }, [bank, setError]);

  const hasFormChanges = bankName !== (bank?.bank_name ?? "");
  const isDirty = hasFormChanges;

  const handleSave = async () => {
    if (!bankName.trim()) {
      setError("Bank name is required.");
      return;
    }
    const result = await withSubmit(async () => {
      const now = new Date().toISOString();
      const plaintext: BankEntryPlaintext = {
        section: "banks",
        bank_name: bankName.trim(),
        pins: bank?.pins ?? [],
        updated_at: now,
      };
      let saved: BankEntry;
      if (isEditing && bank) {
        saved = await updateVaultEntry(userId, bank.id, plaintext) as BankEntry;
      } else {
        saved = await createVaultEntry(userId, plaintext) as BankEntry;
      }
      onSaved(saved);
      onClose();
    });
    void result;
  };

  const handleDelete = async () => {
    if (!bank) return;
    await withSubmit(async () => {
      await deleteVaultEntry(bank.id);
      onClose();
    });
  };

  return (
    <GlobalActionModal
      title={isEditing ? "Edit Bank" : "Add Bank"}
      onClose={onClose}
      isDirty={isDirty}
      onSave={handleSave}
      isSaving={isSaving}
      onDelete={isEditing ? handleDelete : undefined}
      deleteLabel="Delete Bank"
    >
      <div className="space-y-4">
        {error && (
          <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
        )}
        <InputField
          label="Bank Name"
          value={bankName}
          onChange={setBankName}
          placeholder="e.g. HDFC Bank"
          disabled={isSaving}
        />
      </div>
    </GlobalActionModal>
  );
}
