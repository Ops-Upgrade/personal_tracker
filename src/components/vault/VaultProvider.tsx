"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { checkVaultPinSet, verifyVaultPin } from "@/api/vault";
import type { VaultState, VaultContext as VaultContextType } from "@/types/vault";

const VaultCtx = createContext<VaultContextType | null>(null);

/** Hook to access vault state — must be used inside VaultProvider. */
export function useVault(): VaultContextType {
  const ctx = useContext(VaultCtx);
  if (!ctx) {
    throw new Error("useVault must be used within a VaultProvider");
  }
  return ctx;
}

// ── Provider ──

interface VaultProviderProps {
  userId: string;
  children: ReactNode;
}

export default function VaultProvider({ userId, children }: VaultProviderProps) {
  const [state, setState] = useState<VaultState>("loading");
  const [graceSecondsLeft, setGraceSecondsLeft] = useState<number | null>(null);
  const [lastVerifyResult, setLastVerifyResult] = useState<VaultContextType["lastVerifyResult"]>(null);
  const [pinResetSuccess, setPinResetSuccess] = useState(false);

  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pathname = usePathname();

  const isVaultRoute = useCallback((p: string) => p.startsWith("/vault"), []);

  // ── Initialise: check if PIN is set ──

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const hasPin = await checkVaultPinSet(userId);
        if (cancelled) return;
        setState(hasPin ? "locked" : "setup_required");
      } catch {
        if (!cancelled) setState("locked"); // fallback: show lock screen
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // ── Grace period: pathname-based navigation-away timer ──

  useEffect(() => {
    if (state !== "unlocked" && state !== "grace") return;

    if (isVaultRoute(pathname)) {
      // Returned to vault — cancel grace timer
      if (graceTimerRef.current) {
        clearTimeout(graceTimerRef.current);
        graceTimerRef.current = null;
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGraceSecondsLeft(null);
      if (state === "grace") setState("unlocked");
    } else {
      // Left vault — start grace timer if not already running
      if (!graceTimerRef.current) {
        let remaining = 30;
        setGraceSecondsLeft(remaining);
        setState("grace");

        countdownRef.current = setInterval(() => {
          remaining -= 1;
          setGraceSecondsLeft(remaining);
          if (remaining <= 0) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
        }, 1_000);

        graceTimerRef.current = setTimeout(() => {
          if (countdownRef.current) clearInterval(countdownRef.current);
          countdownRef.current = null;
          setState("locked");
          graceTimerRef.current = null;
          setGraceSecondsLeft(null);
        }, 30_000);
      }
    }

    return () => {
      // Cleanup handled in the next effect run — React handles this.
      // We don't clear here because we want the timer to survive re-renders.
    };
  }, [pathname, state, isVaultRoute]);

  // ── Actions ──

  const unlock = useCallback(
    async (pin: string): Promise<boolean> => {
      try {
        const result = await verifyVaultPin(userId, pin);
        setLastVerifyResult(result);
        if (result.success) {
          setState("unlocked");
          return true;
        }
        if (result.lockedOut) {
          // Lockout is handled by the verify result — stay on lock screen
        }
        return false;
      } catch {
        setLastVerifyResult({ success: false });
        return false;
      }
    },
    [userId]
  );

  const lock = useCallback(() => {
    if (graceTimerRef.current) {
      clearTimeout(graceTimerRef.current);
      graceTimerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setGraceSecondsLeft(null);
    setLastVerifyResult(null);
    setState("locked");
  }, []);

  const clearPinResetSuccess = useCallback(() => {
    setPinResetSuccess(false);
  }, []);

  // ── Provide context ──

  const value: VaultContextType = {
    state,
    unlock,
    lock,
    graceSecondsLeft,
    lastVerifyResult,
    pinResetSuccess,
    clearPinResetSuccess,
  };

  return <VaultCtx.Provider value={value}>{children}</VaultCtx.Provider>;
}
