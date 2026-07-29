"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";
import { useVault } from "./VaultProvider";
import VaultPinReset from "./VaultPinReset";
import VaultHomeGrid from "./VaultHomeGrid";
import ModalFrame from "@/components/common/ModalFrame";
import BackButton from "@/components/common/BackButton";
import { ROUTES } from "@/routes/paths";

/** PIN entry screen with native password input. Shown when vault state is "locked". */
export default function VaultLockScreen() {
  const router = useRouter();
  const { unlock, lastVerifyResult, pinResetSuccess, clearPinResetSuccess } = useVault();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const attemptsLeft = lastVerifyResult?.attemptsLeft;
  const isLockedOut = lastVerifyResult?.lockedOut;

  // Show success message after PIN reset
  useEffect(() => {
    if (pinResetSuccess) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuccessMessage("PIN reset successfully. Enter your new PIN to unlock.");
      clearPinResetSuccess();
    }
  }, [pinResetSuccess, clearPinResetSuccess]);

  const submitPin = useCallback(
    async (pinValue: string) => {
      if (pinValue.length !== 4) return;
      setError(null);

      try {
        const ok = await unlock(pinValue);
        if (!ok) {
          setPin("");
          setShake(true);
          setTimeout(() => setShake(false), 500);

          if (isLockedOut) {
            setError("Vault is permanently locked. Reset your PIN using your login password.");
          } else if (attemptsLeft !== undefined && attemptsLeft <= 5 && attemptsLeft > 0) {
            setError(`Incorrect PIN. ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} remaining before lockout.`);
          } else if (attemptsLeft === 0) {
            setError("Vault is now locked. Reset your PIN using your login password.");
          } else {
            setError("Incorrect PIN.");
          }
        }
      } catch {
        setPin("");
        setError("An error occurred. Please try again.");
      }
    },
    [unlock, attemptsLeft, isLockedOut]
  );

  // Show warning when in the last-5 attempts zone
  const showWarning =
    !isLockedOut &&
    attemptsLeft !== undefined &&
    attemptsLeft <= 5 &&
    attemptsLeft > 0 &&
    lastVerifyResult !== null;

  if (showReset) {
    return <VaultPinReset onBack={() => setShowReset(false)} />;
  }

  return (
    <>
      {/* Background: non-interactive skeleton in normal flow to align below the header */}
      <div className="pointer-events-none select-none opacity-50 dark:opacity-30">
        <VaultHomeGrid interactive={false} />
      </div>

      {/* Standard modal card for PIN entry */}
      <ModalFrame
        title={<BackButton onClick={() => router.replace(ROUTES.DASHBOARD)} />}
        onClose={() => router.replace(ROUTES.DASHBOARD)}
        hideCloseButton
        maxWidthClassName="max-w-sm"
        zClassName="z-50"
      >
        <div className="flex flex-col items-center py-6">
          <Shield className="mb-4 h-10 w-10 text-zinc-500 dark:text-zinc-400" />

          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Enter your 4-digit PIN to unlock your Vault
          </p>

          {/* Success message */}
          {successMessage && (
            <div className="mt-4 w-full rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-center text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
              {successMessage}
            </div>
          )}

          {/* Native password input */}
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pin}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, "");
              setPin(val);
              if (val.length === 4) submitPin(val);
            }}
            className={`mt-6 w-48 rounded-xl border bg-white px-4 py-3 text-center text-2xl tracking-[0.5em] indent-[0.5em] shadow-sm focus:outline-none focus:ring-1 ${
              shake
                ? "animate-[shake_0.5s_ease-in-out] border-red-400 focus:border-red-500 focus:ring-red-500"
                : "border-zinc-300 focus:border-zinc-500 focus:ring-zinc-500 dark:border-zinc-700 dark:focus:border-zinc-500"
            } dark:bg-zinc-900 dark:text-zinc-100`}
            autoFocus
            aria-label="PIN entry"
          />

          {/* Error / warning messages */}
          {error && (
            <p
              className={`mt-4 text-sm font-medium ${
                showWarning
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {error}
            </p>
          )}

          {/* Forgot PIN link */}
          <button
            type="button"
            onClick={() => setShowReset(true)}
            className="mt-6 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            Forgot PIN?
          </button>
        </div>
      </ModalFrame>
    </>
  );
}
