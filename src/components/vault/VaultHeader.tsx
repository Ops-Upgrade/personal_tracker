"use client";

import { Lock, Timer, ShieldCheck } from "lucide-react";
import { useVault } from "./VaultProvider";

/**
 * Floating header badge — absolutely positioned in the top-right corner.
 * Shows vault status (unlocked + countdown) and a prominent lock button.
 * Anchored to a parent with `position: relative` (VaultClientLayout).
 */
export default function VaultHeader() {
  const { lock, graceSecondsLeft, state } = useVault();

  const showCountdown = state === "grace" && graceSecondsLeft !== null;

  return (
    <div className="absolute top-0 right-0 sm:right-4 z-30 flex items-center gap-3">
      {/* Unlocked badge */}
      <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm dark:bg-emerald-900/30 dark:text-emerald-400">
        <ShieldCheck className="h-3.5 w-3.5" />
        Vault unlocked
      </div>

      {/* Grace countdown */}
      {showCountdown && (
        <div className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 shadow-sm dark:bg-amber-900/30 dark:text-amber-400">
          <Timer className="h-3.5 w-3.5" />
          Locking in {graceSecondsLeft}s
        </div>
      )}

      {/* Lock button */}
      <button
        type="button"
        onClick={lock}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        <Lock className="h-3.5 w-3.5" />
        Lock
      </button>
    </div>
  );
}
