"use client";

import { useState, useEffect, useCallback } from "react";
import { getSession } from "@/api/auth";
import { getServerDateIST, parseISTDate } from "@/api/serverDate";

export interface UseAuthBootstrapOptions {
  loadData: (userId: string) => Promise<void>;
  fetchServerDate?: boolean;
}

export interface UseAuthBootstrapReturn {
  userId: string | null;
  istDate: string;
  nowYear: number;
  nowMonth: number;
  isLoading: boolean;
  error: string | null;
  refreshData: (uid: string) => Promise<void>;
}

export function useAuthBootstrap({
  loadData,
  fetchServerDate = true,
}: UseAuthBootstrapOptions): UseAuthBootstrapReturn {
  const [userId, setUserId] = useState<string | null>(null);
  const [istDate, setIstDate] = useState("");
  const [nowYear, setNowYear] = useState(new Date().getFullYear());
  const [nowMonth, setNowMonth] = useState(new Date().getMonth());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshData = useCallback(
    async (uid: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await loadData(uid);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data.");
      } finally {
        setIsLoading(false);
      }
    },
    [loadData]
  );

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const [session, dateStr] = await Promise.all([
          getSession(),
          fetchServerDate ? getServerDateIST() : Promise.resolve(""),
        ]);
        const uid = session?.user.id;
        if (!uid) throw new Error("No active session.");
        if (cancelled) return;
        setUserId(uid);
        if (dateStr) {
          setIstDate(dateStr);
          const parsed = parseISTDate(dateStr);
          setNowYear(parsed.year);
          setNowMonth(parsed.month);
        }
        await refreshData(uid);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to bootstrap.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    bootstrap();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  return { userId, istDate, nowYear, nowMonth, isLoading, error, refreshData };
}
