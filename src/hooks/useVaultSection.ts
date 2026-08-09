"use client";

import { useState, useEffect, useCallback } from "react";
import { getSession } from "@/api/auth";
import { fetchVaultEntriesBySection, deleteVaultEntry } from "@/api/vault";
import type { VaultSection } from "@/types/vault";

/**
 * Shared vault-section data hook — consolidates the session check, fetch,
 * optimistic save, and delete logic that was copy-pasted across
 * RecordsView, PasswordView, and BankListView.
 */
export function useVaultSection<T extends { id: string }>(section: VaultSection) {
  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      const entries = await fetchVaultEntriesBySection(userId, section);
      setData(entries as unknown as T[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to load ${section}`);
    }
  }, [userId, section]);

  // Resolve session on mount
  useEffect(() => {
    getSession().then((s) => {
      if (s?.user?.id) {
        setUserId(s.user.id);
        setIsLoading(false);
      }
    });
  }, []);

  // Fetch data once userId is known
  useEffect(() => {
    if (userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      reload();
    }
  }, [userId, reload]);

  /** Optimistic upsert + server reload. */
  const handleSaved = useCallback(
    (entry: T) => {
      setData((prev) => {
        const idx = prev.findIndex((r) => r.id === entry.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = entry;
          return next;
        }
        return [entry, ...prev];
      });
      reload();
    },
    [reload]
  );

  /** Delete by id + server reload. */
  const handleDeleted = useCallback(
    async (id: string) => {
      await deleteVaultEntry(id);
      reload();
    },
    [reload]
  );

  return { userId, data, isLoading, error, handleSaved, handleDeleted, reload };
}
