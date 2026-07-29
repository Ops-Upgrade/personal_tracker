"use client";

import { useState, useMemo, useCallback } from "react";
import { Trash2 } from "lucide-react";
import VaultRecordView from "@/components/vault/VaultRecordView";
import BulkActionBar from "@/components/common/BulkActionBar";
import type { VaultRecordItem } from "@/types/vault";
import { deleteVaultEntry } from "@/api/vault";
import { ROUTES } from "@/routes/paths";
import type { PasswordEntry } from "@/types/vault";
import { useVaultSection } from "@/hooks/useVaultSection";
import { useSelection } from "@/hooks/useSelection";
import { useDeleteConfirm } from "@/hooks/useDeleteConfirm";
import PasswordModal from "./PasswordModal";

export default function PasswordView() {
  const { userId, data: passwords, isLoading, error, handleSaved, reload } = useVaultSection<PasswordEntry>("passwords");
  const { selectedIds, toggleSelection, selectAll, clearSelection } = useSelection();

  const [modalEntry, setModalEntry] = useState<PasswordEntry | null | undefined>(undefined);

  const { setItemToDelete, setIsBulkDeleting, deleteModals } = useDeleteConfirm({
    itemName: "password",
    itemNamePlural: "passwords",
    singleDescription: "This will permanently delete this password entry. This action cannot be undone.",
    onDelete: async (id) => { await deleteVaultEntry(id); reload(); },
    onBulkDelete: async (ids) => { for (const id of ids) await deleteVaultEntry(id); reload(); },
    onClearSelection: clearSelection,
    selectedIds,
  });

  const bulkActions = (
    <BulkActionBar selectedCount={selectedIds.size} onClear={clearSelection}>
      <button
        onClick={() => setIsBulkDeleting(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50 transition-colors"
      >
        <Trash2 className="h-4 w-4" /> Delete
      </button>
    </BulkActionBar>
  );

  const items: VaultRecordItem[] = useMemo(
    () =>
      passwords.map((p) => ({
        id: p.id,
        title: p.site_name,
        values: [
          { label: "Username", value: p.username },
          { label: "Password", value: p.password, isSecret: true },
        ],
      })),
    [passwords]
  );

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) selectAll(passwords.map((p) => p.id));
      else clearSelection();
    },
    [passwords, selectAll, clearSelection]
  );

  return (
    <div className="px-4 py-6">
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      <VaultRecordView
        items={items}
        isLoading={isLoading}
        title="Password Manager"
        description="Manage your saved passwords and credentials."
        backHref={ROUTES.VAULT}
        selectionEnabled={true}
        selectedIds={selectedIds}
        onSelectionChange={toggleSelection}
        onSelectAll={handleSelectAll}
        onDeleteClick={(id) => setItemToDelete(id)}
        bulkActions={bulkActions}
        onActionClick={(id) => {
          const entry = passwords.find((p) => p.id === id);
          if (entry) setModalEntry(entry);
        }}
        onAdd={userId ? () => setModalEntry(null) : undefined}
        emptyMessage="No passwords stored yet. Add your first credential."
        searchPlaceholder="Search passwords..."
      />

      {modalEntry !== undefined && userId && (
        <PasswordModal
          userId={userId}
          entry={modalEntry}
          onClose={() => setModalEntry(undefined)}
          onSaved={handleSaved}
        />
      )}

      {deleteModals}
    </div>
  );
}
