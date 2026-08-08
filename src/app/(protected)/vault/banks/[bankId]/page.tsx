"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/routes/paths";
import { getSession } from "@/api/auth";
import { fetchVaultEntriesBySection, updateVaultEntry, deleteVaultEntry } from "@/api/vault";
import GenericStorePage from "@/components/common/store/GenericStorePage";
import type { BankEntry, VaultRecordItem } from "@/types/vault";
import BankPinModal from "@/components/vault/banks/BankPinModal";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import type { BankPinData } from "@/components/vault/banks/BankPinModal";

export default function BankDetailPage({ params }: { params: Promise<{ bankId: string }> }) {
  const { bankId } = use(params);
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [bank, setBank] = useState<BankEntry | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Load bank
  useEffect(() => {
    const init = async () => {
      const session = await getSession();
      if (!session?.user?.id) return;
      setUserId(session.user.id);
      try {
        const entries = await fetchVaultEntriesBySection(session.user.id, "banks");
        const found = entries.find((e) => e.id === bankId) as BankEntry | undefined;
        if (found) setBank(found);
        else setPageError("Bank not found.");
      } catch (err) {
        setPageError(err instanceof Error ? err.message : "Failed to load bank");
      }
    };
    init();
  }, [bankId]);

  // --- PIN CRUD ---

  const fetchData = useCallback(async (_userId: string): Promise<BankPinData[]> => {
    // Re-read bank from server to get fresh state
    const entries = await fetchVaultEntriesBySection(_userId, "banks");
    const current = entries.find((e) => e.id === bankId) as BankEntry | undefined;
    if (current) setBank(current);
    return (current?.pins ?? []).map((p) => ({ id: p.id, name: p.name, pin: p.pin }));
  }, [bankId]);

  const mapRecordToItem = useCallback(
    (pin: BankPinData): VaultRecordItem => ({
      id: pin.id,
      title: pin.name,
      values: [{ value: pin.pin, isSecret: true }],
    }),
    [],
  );

  const onDeleteRecord = useCallback(
    async (pinId: string) => {
      if (!userId || !bank) return;
      const now = new Date().toISOString();
      const newPins = bank.pins.filter((p) => p.id !== pinId);
      const updated = await updateVaultEntry(userId, bank.id, {
        section: "banks", bank_name: bank.bank_name, pins: newPins, updated_at: now,
      } as BankEntry);
      setBank(updated as BankEntry);
    },
    [userId, bank],
  );

  const onBulkDeleteRecords = useCallback(
    async (ids: string[]) => {
      if (!userId || !bank) return;
      const now = new Date().toISOString();
      const idsSet = new Set(ids);
      const newPins = bank.pins.filter((p) => !idsSet.has(p.id));
      const updated = await updateVaultEntry(userId, bank.id, {
        section: "banks", bank_name: bank.bank_name, pins: newPins, updated_at: now,
      } as BankEntry);
      setBank(updated as BankEntry);
    },
    [userId, bank],
  );

  const handleDeleteBank = useCallback(async () => {
    if (!bank) return;
    await deleteVaultEntry(bank.id);
    router.push(ROUTES.VAULT_BANKS);
  }, [bank, router]);

  const handlePinSave = useCallback(
    async (pinData: BankPinData) => {
      if (!userId || !bank) return;
      const now = new Date().toISOString();
      const existingIdx = bank.pins.findIndex((p) => p.id === pinData.id);
      let newPins: { id: string; name: string; pin: string }[];
      if (existingIdx >= 0) {
        newPins = [...bank.pins];
        newPins[existingIdx] = pinData;
      } else {
        newPins = [...bank.pins, pinData];
      }
      const updated = await updateVaultEntry(userId, bank.id, {
        section: "banks", bank_name: bank.bank_name, pins: newPins, updated_at: now,
      } as BankEntry);
      setBank(updated as BankEntry);
    },
    [userId, bank],
  );

  if (pageError) {
    return (
      <div className="px-4 py-6">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          {pageError}
        </div>
      </div>
    );
  }

  if (!bank) return null;

  return (
    <>
      <GenericStorePage<BankPinData>
        storeType="record"
        title={bank.bank_name}
        description="Edit cards and pins for this bank."
        backHref={ROUTES.VAULT_BANKS}
        fetchData={fetchData}
        onDeleteRecord={onDeleteRecord}
        onBulkDeleteRecords={onBulkDeleteRecords}
        itemName="PIN"
        mapRecordToItem={mapRecordToItem}
        emptyMessage="No PINs added yet."
        searchPlaceholder="Search PINs..."
        headerActions={
          <button
            onClick={() => setIsConfirmingDelete(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            Delete Bank
          </button>
        }
        recordModalSlot={({ record, onSaved, onClose }) => (
          <BankPinModal
            pin={record}
            onClose={onClose}
            onSave={(pinData) => {
              handlePinSave(pinData);
              onSaved(pinData);
            }}
            onDelete={
              record
                ? (pinId) => {
                    onDeleteRecord(pinId);
                    onClose();
                  }
                : undefined
            }
          />
        )}
      />

      {isConfirmingDelete && (
        <ConfirmDialog
          title="Delete Bank?"
          description="Are you sure you want to permanently delete this bank and all its PINs? This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => {
            setIsConfirmingDelete(false);
            handleDeleteBank();
          }}
          onCancel={() => setIsConfirmingDelete(false)}
        />
      )}
    </>
  );
}
