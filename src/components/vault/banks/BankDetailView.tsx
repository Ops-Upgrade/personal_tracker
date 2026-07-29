"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import VaultRecordView from "@/components/vault/VaultRecordView";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import type { VaultRecordItem } from "@/types/vault";
import { getSession } from "@/api/auth";
import { updateVaultEntry, deleteVaultEntry } from "@/api/vault";
import type { BankEntry } from "@/types/vault";
import { ROUTES } from "@/routes/paths";
import BankPinModal from "./BankPinModal";
import type { BankPinData } from "./BankPinModal";

interface BankDetailViewProps {
  bankId: string;
}

export default function BankDetailView({ bankId }: BankDetailViewProps) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [bank, setBank] = useState<BankEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // null = create mode, BankPinData with id = edit mode, undefined = closed
  const [modalPin, setModalPin] = useState<BankPinData | null | undefined>(undefined);

  // Load bank
  useEffect(() => {
    async function init() {
      const session = await getSession();
      if (!session?.user?.id) return;
      setUserId(session.user.id);

      try {
        const { fetchVaultEntries } = await import("@/api/vault");
        const entries = await fetchVaultEntries(session.user.id);
        const found = entries.find(
          (e) => e.id === bankId && e.section === "banks"
        ) as BankEntry | undefined;
        if (found) {
          setBank(found);
        } else {
          setError("Bank not found.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load bank");
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [bankId]);

  // --- PIN CRUD handlers ---

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
        section: "banks",
        bank_name: bank.bank_name,
        pins: newPins,
        updated_at: now,
      } as BankEntry);
      setBank(updated as BankEntry);
    },
    [userId, bank]
  );

  const handlePinDelete = useCallback(
    async (pinId: string) => {
      if (!userId || !bank) return;
      const now = new Date().toISOString();
      const newPins = bank.pins.filter((p) => p.id !== pinId);

      const updated = await updateVaultEntry(userId, bank.id, {
        section: "banks",
        bank_name: bank.bank_name,
        pins: newPins,
        updated_at: now,
      } as BankEntry);
      setBank(updated as BankEntry);
    },
    [userId, bank]
  );

  const handleDeleteBank = async () => {
    if (!bank) return;
    try {
      await deleteVaultEntry(bank.id);
      router.push(ROUTES.VAULT_BANKS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete bank");
    }
  };

  // Map PINs to VaultRecordItem for VaultRecordView
  const items: VaultRecordItem[] = useMemo(
    () =>
      (bank?.pins ?? []).map((p) => ({
        id: p.id,
        title: p.name,
        values: [{ value: p.pin, isSecret: true }],
      })),
    [bank?.pins]
  );

  if (isLoading) {
    return <LoadingSpinner message="Loading..." />;
  }

  if (error && !bank) {
    return (
      <div className="px-4 py-6">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (!bank) return null;

  return (
    <div className="space-y-6 px-4 py-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      <VaultRecordView
        items={items}
        title={bank.bank_name}
        backHref={ROUTES.VAULT_BANKS}
        headerActions={
          <button
            onClick={handleDeleteBank}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            Delete Bank
          </button>
        }
        onActionClick={(id) => {
          const pin = bank.pins.find((p) => p.id === id);
          if (pin) setModalPin(pin);
        }}
        onAdd={userId ? () => setModalPin(null) : undefined}
        emptyMessage="No PINs added yet."
        searchPlaceholder="Search PINs..."
      />

      {/* Create / Edit PIN Modal */}
      {modalPin !== undefined && (
        <BankPinModal
          pin={modalPin}
          onClose={() => setModalPin(undefined)}
          onSave={handlePinSave}
          onDelete={handlePinDelete}
        />
      )}
    </div>
  );
}
