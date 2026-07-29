"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import VaultRecordView from "@/components/vault/VaultRecordView";
import BulkActionBar from "@/components/common/BulkActionBar";
import type { VaultRecordItem } from "@/types/vault";
import { deleteVaultEntry } from "@/api/vault";
import { ROUTES } from "@/routes/paths";
import type { BankEntry } from "@/types/vault";
import { useVaultSection } from "@/hooks/useVaultSection";
import { useSelection } from "@/hooks/useSelection";
import { useDeleteConfirm } from "@/hooks/useDeleteConfirm";
import BankModal from "./BankModal";

export default function BankListView() {
  const router = useRouter();
  const { userId, data: banks, isLoading, error, handleSaved, reload } = useVaultSection<BankEntry>("banks");
  const { selectedIds, toggleSelection, selectAll, clearSelection } = useSelection();

  const [modalBank, setModalBank] = useState<BankEntry | null | undefined>(undefined);

  const { setItemToDelete, setIsBulkDeleting, deleteModals } = useDeleteConfirm({
    itemName: "bank",
    singleDescription: "This will permanently delete this bank entry and all its PINs. This action cannot be undone.",
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
      banks.map((b) => ({
        id: b.id,
        title: b.bank_name,
        values: [{ label: "PINs", value: `${b.pins.length} saved` }],
      })),
    [banks]
  );

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) selectAll(banks.map((b) => b.id));
      else clearSelection();
    },
    [banks, selectAll, clearSelection]
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
        title="Bank Manager"
        description="Manage your saved bank accounts and PINs."
        backHref={ROUTES.VAULT}
        selectionEnabled={true}
        selectedIds={selectedIds}
        onSelectionChange={toggleSelection}
        onSelectAll={handleSelectAll}
        onDeleteClick={(id) => setItemToDelete(id)}
        bulkActions={bulkActions}
        onActionClick={(id) => {
          router.push(ROUTES.VAULT_BANK_DETAIL(id));
        }}
        onAdd={userId ? () => setModalBank(null) : undefined}
        emptyMessage="No banks added yet. Add your first bank."
        searchPlaceholder="Search banks..."
      />

      {modalBank !== undefined && userId && (
        <BankModal
          userId={userId}
          bank={modalBank}
          onClose={() => { setModalBank(undefined); reload(); }}
          onSaved={handleSaved}
        />
      )}

      {deleteModals}
    </div>
  );
}
