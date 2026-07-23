"use client";

import { useState } from "react";
import { generateRecoveryPhrase, setupRecoveryKey } from "@/lib/crypto";
import Button from "@/components/common/Button";

interface RecoveryKeySetupModalProps {
  userId: string;
  onComplete: () => void;
}

/**
 * Full-screen blocking modal that forces the user to set up a recovery key.
 *
 * - Generates a recovery phrase on mount (useState initializer, not useEffect,
 *   so it never regenerates on re-render).
 * - Collects the current password + a "saved" checkbox.
 * - Calls setupRecoveryKey on submit.
 * - No close button, no backdrop click to dismiss — the user must save a key.
 */
export default function RecoveryKeySetupModal({
  userId,
  onComplete,
}: RecoveryKeySetupModalProps) {
  const [recoveryPhrase] = useState(() => generateRecoveryPhrase());
  const [currentPassword, setCurrentPassword] = useState("");
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit() {
    setStatus("loading");
    setErrorMsg("");
    try {
      await setupRecoveryKey(userId, currentPassword, recoveryPhrase);
      onComplete();
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err instanceof Error ? err.message : "Failed. Please try again."
      );
    }
  }

  const canSubmit = saved && currentPassword !== "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 sm:p-8">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Save Your Recovery Key
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          This key is the <strong className="text-zinc-700 dark:text-zinc-300">only</strong> way to
          recover your encrypted data if you ever lose your password. Without it,
          all your data will be permanently inaccessible.
        </p>

        {/* Recovery phrase */}
        <div className="mt-5 space-y-2">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Your recovery key
          </label>
          <div className="rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-3 font-mono text-sm text-zinc-900 break-all select-all dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">
            {recoveryPhrase}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigator.clipboard.writeText(recoveryPhrase)}
          >
            Copy
          </Button>
        </div>

        {/* Password input */}
        <div className="mt-5 space-y-2">
          <label
            htmlFor="recovery-password"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Enter your current password to confirm
          </label>
          <input
            id="recovery-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-400/20"
          />
        </div>

        {/* Checkbox */}
        <label className="mt-4 flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={saved}
            onChange={(e) => setSaved(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800"
          />
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            I have saved my recovery key in a safe place
          </span>
        </label>

        {/* Error */}
        {status === "error" && errorMsg && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
            {errorMsg}
          </div>
        )}

        {/* Submit */}
        <div className="mt-6">
          <Button
            variant="primary"
            size="lg"
            disabled={!canSubmit || status === "loading"}
            onClick={handleSubmit}
            className="w-full"
          >
            {status === "loading" ? "Saving..." : "Save and Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
