"use client";

import { useState } from "react";
import { generateRecoveryPhrase, setupRecoveryKey } from "@/lib/crypto";
import Button from "@/components/common/Button";

interface RegenerateRecoveryKeyFormProps {
  userId: string;
}

type FormState = "idle" | "confirming" | "loading" | "done" | "error";

/**
 * Settings form that lets a logged-in user generate a new recovery key.
 *
 * State machine:
 *   idle       → password input + "Generate New Recovery Key" button
 *   confirming → new phrase displayed + save checkbox + "Confirm and Save" button
 *   loading    → spinner
 *   done       → success banner
 *   error      → inline error, resets to idle for retry
 */
export default function RegenerateRecoveryKeyForm({
  userId,
}: RegenerateRecoveryKeyFormProps) {
  const [state, setState] = useState<FormState>("idle");
  const [currentPassword, setCurrentPassword] = useState("");
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  function handleGenerate() {
    setRecoveryPhrase(generateRecoveryPhrase());
    setSaved(false);
    setErrorMsg("");
    setState("confirming");
  }

  async function handleConfirm() {
    setState("loading");
    setErrorMsg("");
    try {
      await setupRecoveryKey(userId, currentPassword, recoveryPhrase);
      setState("done");
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed. Please try again."
      );
      setState("error");
    }
  }

  function handleReset() {
    setState("idle");
    setCurrentPassword("");
    setRecoveryPhrase("");
    setSaved(false);
    setErrorMsg("");
  }

  // --- Error state ---
  if (state === "error") {
    return (
      <div className="w-full max-w-md space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {errorMsg || "An unknown error occurred."}
        </div>
        <Button variant="secondary" size="md" onClick={handleReset}>
          Try Again
        </Button>
      </div>
    );
  }

  // --- Done state ---
  if (state === "done") {
    return (
      <div className="w-full max-w-md space-y-4">
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/50 dark:text-green-300">
          Recovery key updated. Your previous key is now invalid.
        </div>
        <Button variant="secondary" size="md" onClick={handleReset}>
          Generate Another
        </Button>
      </div>
    );
  }

  // --- Loading state ---
  if (state === "loading") {
    return (
      <div className="flex items-center gap-3 py-2">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          Saving recovery key...
        </span>
      </div>
    );
  }

  // --- Idle state ---
  if (state === "idle") {
    return (
      <div className="w-full max-w-md space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="regen-password"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Current password
          </label>
          <input
            id="regen-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-400/20"
          />
        </div>
        <Button
          variant="primary"
          size="md"
          disabled={currentPassword === ""}
          onClick={handleGenerate}
        >
          Generate New Recovery Key
        </Button>
      </div>
    );
  }

  // --- Confirming state ---
  return (
    <div className="w-full max-w-md space-y-5">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Your new recovery key
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

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800"
        />
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          I have saved my new recovery key in a safe place
        </span>
      </label>

      <div className="flex gap-3">
        <Button
          variant="primary"
          size="md"
          disabled={!saved}
          onClick={handleConfirm}
        >
          Confirm and Save
        </Button>
        <Button variant="ghost" size="md" onClick={handleReset}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
