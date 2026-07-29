"use client";

import { useState, useEffect } from "react";
import GlobalActionModal from "@/components/common/GlobalActionModal";
import { InputField } from "@/components/common/FormField";
import { useActionForm } from "@/hooks/useActionForm";
import { createVaultEntry, updateVaultEntry, deleteVaultEntry } from "@/api/vault";
import type { PasswordEntry, PasswordEntryPlaintext } from "@/types/vault";

interface PasswordModalProps {
  userId: string;
  entry?: PasswordEntry | null;
  onClose: () => void;
  onSaved: (entry: PasswordEntry) => void;
}

export default function PasswordModal({ userId, entry, onClose, onSaved }: PasswordModalProps) {
  const isEditing = !!entry;

  const [siteName, setSiteName] = useState(entry?.site_name ?? "");
  const [username, setUsername] = useState(entry?.username ?? "");
  const [password, setPassword] = useState(entry?.password ?? "");

  const { isSaving, error, setError, withSubmit } = useActionForm();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- by-design: sync form state when editing a different entry
    setSiteName(entry?.site_name ?? "");
    setUsername(entry?.username ?? "");
    setPassword(entry?.password ?? "");
    setError(null);
  }, [entry, setError]);

  const hasFormChanges =
    siteName !== (entry?.site_name ?? "") ||
    username !== (entry?.username ?? "") ||
    password !== (entry?.password ?? "");
  const isDirty = hasFormChanges;

  const handleSave = async () => {
    if (!siteName.trim() || !username.trim() || !password.trim()) {
      setError("Site name, username, and password are required.");
      return;
    }
    const result = await withSubmit(async () => {
      const now = new Date().toISOString();
      const plaintext: PasswordEntryPlaintext = {
        section: "passwords",
        site_name: siteName.trim(),
        username: username.trim(),
        password: password.trim(),
        updated_at: now,
      };
      let saved: PasswordEntry;
      if (isEditing && entry) {
        saved = await updateVaultEntry(userId, entry.id, plaintext) as PasswordEntry;
      } else {
        saved = await createVaultEntry(userId, plaintext) as PasswordEntry;
      }
      onSaved(saved);
      onClose();
    });
    // If withSubmit returned undefined, the error was set by the hook
    void result;
  };

  const handleDelete = async () => {
    if (!entry) return;
    await withSubmit(async () => {
      await deleteVaultEntry(entry.id);
      onClose();
    });
  };

  return (
    <GlobalActionModal
      title={isEditing ? "Edit Credential" : "Add Credential"}
      onClose={onClose}
      isDirty={isDirty}
      onSave={handleSave}
      isSaving={isSaving}
      onDelete={isEditing ? handleDelete : undefined}
      deleteLabel="Delete Credential"
    >
      <div className="space-y-4">
        {error && (
          <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
        )}
        <InputField
          label="Site Name"
          value={siteName}
          onChange={setSiteName}
          placeholder="e.g. Gmail"
          disabled={isSaving}
        />
        <InputField
          label="Username"
          value={username}
          onChange={setUsername}
          placeholder="Your username or email"
          disabled={isSaving}
        />
        <InputField
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="Password"
          disabled={isSaving}
        />
      </div>
    </GlobalActionModal>
  );
}
