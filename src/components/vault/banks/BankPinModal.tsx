"use client";

import { useState, useEffect } from "react";
import GlobalActionModal from "@/components/common/GlobalActionModal";
import { InputField } from "@/components/common/FormField";
import { useActionForm } from "@/hooks/useActionForm";

export interface BankPinData {
  id: string;
  name: string;
  pin: string;
}

interface BankPinModalProps {
  /** Existing pin data (null for create mode) */
  pin?: BankPinData | null;
  onClose: () => void;
  onSave: (pin: BankPinData) => void;
  onDelete?: (pinId: string) => void;
}

export default function BankPinModal({ pin, onClose, onSave, onDelete }: BankPinModalProps) {
  const isEditing = !!pin;

  const [name, setName] = useState(pin?.name ?? "");
  const [pinValue, setPinValue] = useState(pin?.pin ?? "");

  const { isSaving, error, setError, withSubmit } = useActionForm();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- by-design: sync form state when editing a different pin
    setName(pin?.name ?? "");
    setPinValue(pin?.pin ?? "");
    setError(null);
  }, [pin, setError]);

  const hasFormChanges =
    name !== (pin?.name ?? "") || pinValue !== (pin?.pin ?? "");
  const isDirty = hasFormChanges;

  const handleSave = async () => {
    if (!name.trim() || !pinValue.trim()) {
      setError("Name and PIN are required.");
      return;
    }
    const result = await withSubmit(async () => {
      const saved: BankPinData = {
        id: pin?.id ?? crypto.randomUUID(),
        name: name.trim(),
        pin: pinValue.trim(),
      };
      onSave(saved);
      onClose();
    });
    void result;
  };

  const handleDelete = async () => {
    if (!pin || !onDelete) return;
    await withSubmit(async () => {
      onDelete(pin.id);
      onClose();
    });
  };

  return (
    <GlobalActionModal
      title={isEditing ? "Edit PIN" : "Add PIN"}
      onClose={onClose}
      isDirty={isDirty}
      onSave={handleSave}
      isSaving={isSaving}
      onDelete={isEditing && onDelete ? handleDelete : undefined}
      deleteLabel="Delete PIN"
    >
      <div className="space-y-4">
        {error && (
          <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
        )}
        <InputField
          label="Name"
          value={name}
          onChange={setName}
          placeholder="e.g. ATM PIN, MPIN"
          disabled={isSaving}
        />
        <InputField
          label="PIN"
          type="password"
          value={pinValue}
          onChange={setPinValue}
          placeholder="PIN value"
          disabled={isSaving}
        />
      </div>
    </GlobalActionModal>
  );
}
