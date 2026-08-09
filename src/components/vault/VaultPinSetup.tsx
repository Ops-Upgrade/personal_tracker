"use client";

import { useState, useCallback } from "react";

import { Shield, Lock } from "lucide-react";
import { setVaultPin } from "@/api/vault";

interface VaultPinSetupProps {
  userId: string;
  onComplete: () => void;
}

/** First-time PIN setup dialog. Shown when vault state is "setup_required". */
export default function VaultPinSetup({ userId, onComplete }: VaultPinSetupProps) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [step, setStep] = useState<"create" | "confirm">("create");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shake, setShake] = useState(false);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }, []);

  const handleSubmit = useCallback(
    async (createdPin: string, confirmedPin: string) => {
      if (createdPin !== confirmedPin) {
        setError("PINs don't match. Try again.");
        triggerShake();
        setConfirmPin("");
        return;
      }

      if (createdPin.length !== 4 || !/^\d{4}$/.test(createdPin)) {
        setError("PIN must be exactly 4 digits.");
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        await setVaultPin(userId, createdPin);
        onComplete();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to set PIN. Please try again."
        );
        setPin("");
        setConfirmPin("");
        setStep("create");
      } finally {
        setIsSubmitting(false);
      }
    },
    [userId, onComplete, triggerShake]
  );

  const handleDigit = useCallback(
    (digit: string) => {
      if (step === "create" && pin.length >= 4) return;
      if (step === "confirm" && confirmPin.length >= 4) return;

      if (step === "create") {
        const newPin = pin + digit;
        setPin(newPin);
        setError(null);
        if (newPin.length === 4) {
          // Small delay then move to confirm step
          setTimeout(() => setStep("confirm"), 300);
        }
      } else {
        const newConfirm = confirmPin + digit;
        setConfirmPin(newConfirm);
        setError(null);
        if (newConfirm.length === 4) {
          // Auto-verify when 4 digits entered
          handleSubmit(pin, newConfirm);
        }
      }
    },
    [pin, confirmPin, step, handleSubmit]
  );

  const handleDelete = useCallback(() => {
    if (step === "create") {
      setPin((prev) => prev.slice(0, -1));
    } else {
      setConfirmPin((prev) => prev.slice(0, -1));
    }
    setError(null);
  }, [step]);

  const handleBackToCreate = () => {
    setStep("create");
    setPin("");
    setConfirmPin("");
    setError(null);
  };

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "delete"] as const;

  const currentValue = step === "create" ? pin : confirmPin;
  const title = step === "create" ? "Set Your Vault PIN" : "Confirm Your PIN";
  const subtitle =
    step === "create"
      ? "Choose a 4-digit code to secure your vault"
      : "Re-enter your PIN to confirm";

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
      {/* Icon + title */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">
          <Shield className="h-8 w-8 text-zinc-500 dark:text-zinc-400" />
        </div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
      </div>

      {/* PIN dots */}
      <div className="mb-6 flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-4 w-4 rounded-full border-2 transition-colors ${
              shake ? "animate-[shake_0.5s_ease-in-out] border-red-400" : ""
            } ${
              currentValue.length > i
                ? "border-zinc-400 bg-zinc-400 dark:border-zinc-300 dark:bg-zinc-300"
                : "border-zinc-300 dark:border-zinc-600"
            }`}
          />
        ))}
      </div>

      {/* Error */}
      {error && (
        <p className="mb-4 text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {/* Numpad */}
      <div className="grid w-full max-w-[280px] grid-cols-3 gap-3">
        {digits.map((d) => {
          if (d === "") {
            return <div key="spacer" />;
          }
          if (d === "delete") {
            return (
              <button
                key="delete"
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="flex h-14 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400 transition-colors hover:bg-zinc-200 active:bg-zinc-300 disabled:opacity-40 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
                aria-label="Delete"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9.75 14.25 12m0 0 2.25 2.25M14.25 12l2.25-2.25M14.25 12 12 14.25m-2.58 4.92-6.374-6.375a1.125 1.125 0 0 1 0-1.59L9.42 4.83c.21-.211.497-.33.795-.33H19.5a2.25 2.25 0 0 1 2.25 2.25v10.5a2.25 2.25 0 0 1-2.25 2.25h-9.284c-.298 0-.585-.119-.795-.33Z"
                  />
                </svg>
              </button>
            );
          }
          return (
            <button
              key={d}
              type="button"
              onClick={() => handleDigit(d)}
              disabled={isSubmitting}
              className="flex h-14 items-center justify-center rounded-xl bg-zinc-100 text-lg font-semibold text-zinc-800 transition-colors hover:bg-zinc-200 active:bg-zinc-300 disabled:opacity-40 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
            >
              {d}
            </button>
          );
        })}
      </div>

      {/* Back button (confirm step only) */}
      {step === "confirm" && (
        <button
          type="button"
          onClick={handleBackToCreate}
          disabled={isSubmitting}
          className="mt-4 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          ← Back
        </button>
      )}

      <div className="mt-8">
        <Lock className="h-4 w-4 text-zinc-300 dark:text-zinc-600" />
      </div>
    </div>
  );
}
