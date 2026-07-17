"use client";

import { useState, useEffect, useCallback } from "react";
import { getSession } from "@/api/auth";
import { createClient } from "@/lib/supabase/client";
import { getServerDateIST, parseISTDate } from "@/api/serverDate";

export interface UseAuthBootstrapOptions {
  loadData: (userId: string) => Promise<void>;
  fetchServerDate?: boolean;
}

export interface UseAuthBootstrapReturn {
  userId: string | null;
  userName?: string;
  userAvatarUrl?: string;
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
  const [userName, setUserName] = useState<string | undefined>();
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | undefined>();
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

        // Extract user profile from metadata
        const meta = session.user.user_metadata as Record<string, unknown> | undefined;
        const name =
          typeof meta?.full_name === "string" && meta.full_name
            ? (meta.full_name as string)
            : undefined;
        setUserName(name);

        const avatarTs =
          typeof meta?.avatar_updated_at === "string"
            ? (meta.avatar_updated_at as string)
            : undefined;
        if (avatarTs) {
          const supabase = createClient();
          const { data } = supabase.storage
            .from("avatars")
            .getPublicUrl(`${uid}/avatar.jpg`);
          setUserAvatarUrl(
            `${data.publicUrl}?t=${encodeURIComponent(avatarTs)}`,
          );
        }

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

  return { userId, userName, userAvatarUrl, istDate, nowYear, nowMonth, isLoading, error, refreshData };
}
