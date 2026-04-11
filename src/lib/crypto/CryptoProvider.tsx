"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isReady } from "./manager";
import { ROUTES } from "@/routes/paths";

interface CryptoProviderProps {
  userId: string;
  children: React.ReactNode;
}

/**
 * Client-side guard that ensures the DEK is available in IndexedDB.
 *
 * - On mount, checks `isReady(userId)`.
 * - If the DEK is present, renders children normally.
 * - If missing (e.g. IndexedDB cleared, new browser), redirects to /login
 *   so the user re-enters their password and bootstrapCrypto runs again.
 */
export default function CryptoProvider({ userId, children }: CryptoProviderProps) {
  const router = useRouter();
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    isReady(userId).then((ok) => {
      if (cancelled) return;
      if (ok) {
        setReady(true);
      } else {
        router.replace(ROUTES.LOGIN);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [userId, router]);

  if (ready === null) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
      </div>
    );
  }

  return <>{children}</>;
}
