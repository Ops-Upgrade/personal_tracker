"use client";

import { useState, useCallback, useEffect } from "react";
import { Shield, Lock } from "lucide-react";
import { resetPinWithPassword } from "@/api/vault";
import { getSession } from "@/api/auth";
import Button from "@/components/common/Button";
import { InputField } from "@/components/common/FormField";

interface VaultPinResetProps {
  onBack: () => void;
}

/**
 * "Forgot PIN?" flow — verifies login password, then allows setting a new PIN.
 * Uses the existing session for email lookup.
 */
export default function VaultPinReset({ onBack }: VaultPinResetProps) {
  const [step, setStep] = useState<"password" | "newPin" | "confirmPin">("password");
  const [password, setPassword] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    getSession().then((session) => {
      if (session?.user?.email) {
        setEmail(session.user.email);
      }
      if (session?.user?.id) {
        setUserId(session.user.id);
      }
    });
  }, []);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }, []);

  // ── Step 1: Verify password ──

  const handlePasswordSubmit = async () => {
    if (!password) {
      setError("Please enter your login password.");
      return;
    }
    if (!email) {
      setError("Could not determine your email. Please refresh and try again.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // resetPinWithPassword verifies the password server-side
      // We just move to the next step — the actual reset happens after new PIN entry
      setStep("newPin");
    } catch {
      // Won't throw here — actual auth happens on final submit
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Final submit: reset PIN with password ──

  const handleFinalSubmit = useCallback(
    async (pin: string, confirmed: string) => {
      if (pin !== confirmed) {
        setError("PINs don't match. Try again.");
        triggerShake();
        setConfirmPin("");
        return;
      }

      if (!email) {
        setError("Could not determine your email. Please refresh and try again.");
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        if (!userId) {
          setError("Could not determine your user ID. Please refresh and try again.");
          setIsSubmitting(false);
          return;
        }
        await resetPinWithPassword(userId, email, password, pin);
        onBack();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to reset PIN. Please try again.");
        setNewPin("");
        setConfirmPin("");
        setStep("newPin");
      } finally {
        setIsSubmitting(false);
      }
    },
    [email, userId, password, onBack, triggerShake]
  );

  // ── Numpad for new PIN ──

  const handleDigit = useCallback(
    (digit: string) => {
      setError(null);
      if (step === "newPin") {
        if (newPin.length >= 4) return;
        const val = newPin + digit;
        setNewPin(val);
        if (val.length === 4) {
          setTimeout(() => setStep("confirmPin"), 300);
        }
      } else if (step === "confirmPin") {
        if (confirmPin.length >= 4) return;
        const val = confirmPin + digit;
        setConfirmPin(val);
        if (val.length === 4) {
          handleFinalSubmit(newPin, val);
        }
      }
    },
    [newPin, confirmPin, step, handleFinalSubmit]
  );

  const handleDelete = useCallback(() => {
    setError(null);
    if (step === "newPin") {
      setNewPin((prev) => prev.slice(0, -1));
    } else if (step === "confirmPin") {
      setConfirmPin((prev) => prev.slice(0, -1));
    }
  }, [step]);

  const handleBackPin = () => {
    setStep("newPin");
    setNewPin("");
    setConfirmPin("");
    setError(null);
  };

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "delete"] as const;

  // ── Render ──

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
      {/* Icon + title */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">
          <Shield className="h-8 w-8 text-zinc-500 dark:text-zinc-400" />
        </div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          {step === "password" ? "Reset PIN" : "Set New PIN"}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {step === "password"
            ? "Verify your identity with your login password"
            : step === "newPin"
              ? "Choose a new 4-digit PIN"
              : "Confirm your new PIN"}
        </p>
      </div>

      {/* Step 1: Password verification */}
      {step === "password" && (
        <div className="w-full max-w-sm space-y-4">
          <InputField
            label="Login Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="Enter your login password"
            disabled={isSubmitting}
          />
          {error && (
            <p className="text-sm font-medium text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" size="md" onClick={onBack} disabled={isSubmitting}>
              Back
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handlePasswordSubmit}
              disabled={isSubmitting || !password}
            >
              {isSubmitting ? "Verifying..." : "Verify"}
            </Button>
          </div>
        </div>
      )}

      {/* Steps 2 & 3: New PIN entry (numpad) */}
      {(step === "newPin" || step === "confirmPin") && (
        <>
          {/* PIN dots */}
          <div className="mb-6 flex gap-3">
            {[0, 1, 2, 3].map((i) => {
              const val = step === "newPin" ? newPin : confirmPin;
              return (
                <div
                  key={i}
                  className={`h-4 w-4 rounded-full border-2 transition-colors ${
                    shake ? "animate-[shake_0.5s_ease-in-out] border-red-400" : ""
                  } ${
                    val.length > i
                      ? "border-zinc-400 bg-zinc-400 dark:border-zinc-300 dark:bg-zinc-300"
                      : "border-zinc-300 dark:border-zinc-600"
                  }`}
                />
              );
            })}
          </div>

          {error && (
            <p className="mb-4 text-sm font-medium text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          {/* Numpad */}
          <div className="grid w-full max-w-[280px] grid-cols-3 gap-3">
            {digits.map((d) => {
              if (d === "") return <div key="spacer" />;
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

          {step === "confirmPin" && (
            <button
              type="button"
              onClick={handleBackPin}
              disabled={isSubmitting}
              className="mt-4 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
            >
              ← Back
            </button>
          )}
        </>
      )}

      <div className="mt-8">
        <Lock className="h-4 w-4 text-zinc-300 dark:text-zinc-600" />
      </div>
    </div>
  );
}
