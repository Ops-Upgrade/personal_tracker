"use client";

import { useState, useMemo, useCallback } from "react";
import { Trash2 } from "lucide-react";
import VaultRecordView from "@/components/vault/VaultRecordView";
import BulkActionBar from "@/components/common/BulkActionBar";
import type { VaultRecordItem } from "@/types/vault";
import { deleteVaultEntry } from "@/api/vault";
import { ROUTES } from "@/routes/paths";
import type { PersonalRecord } from "@/types/vault";
import { useVaultSection } from "@/hooks/useVaultSection";
import { useSelection } from "@/hooks/useSelection";
import { useDeleteConfirm } from "@/hooks/useDeleteConfirm";
import RecordModal from "./RecordModal";

export default function RecordsView() {
  const { userId, data: records, isLoading, error, handleSaved, reload } = useVaultSection<PersonalRecord>("records");
  const { selectedIds, toggleSelection, selectAll, clearSelection } = useSelection();

  // null = create mode, PersonalRecord with id = edit mode, undefined = closed
  const [modalRecord, setModalRecord] = useState<PersonalRecord | null | undefined>(undefined);

  const { setItemToDelete, setIsBulkDeleting, deleteModals } = useDeleteConfirm({
    itemName: "record",
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
      records.map((r) => ({
        id: r.id,
        title: r.name,
        values: [{ value: r.value }],
      })),
    [records]
  );

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) selectAll(records.map((r) => r.id));
      else clearSelection();
    },
    [records, selectAll, clearSelection]
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
        title="Personal Records"
        description="Manage your personal reference records."
        backHref={ROUTES.VAULT}
        tileLayout="body-only"
        selectionEnabled={true}
        selectedIds={selectedIds}
        onSelectionChange={toggleSelection}
        onSelectAll={handleSelectAll}
        onDeleteClick={(id) => setItemToDelete(id)}
        bulkActions={bulkActions}
        onActionClick={(id) => {
          const record = records.find((r) => r.id === id);
          if (record) setModalRecord(record);
        }}
        onAdd={userId ? () => setModalRecord(null) : undefined}
      />

      {/* Create / Edit Modal */}
      {modalRecord !== undefined && userId && (
        <RecordModal
          userId={userId}
          record={modalRecord}
          onClose={() => setModalRecord(undefined)}
          onSaved={handleSaved}
        />
      )}

      {deleteModals}
    </div>
  );
}
