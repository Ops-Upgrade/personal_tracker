"use client";

import { useState, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ROUTES } from "@/routes/paths";
import Button from "@/components/common/Button";
import { deriveKEK, unwrapDEK, generateSalt, wrapDEK } from "@/lib/crypto/primitives";

type Step = "step1" | "step2";
type Status = "idle" | "loading" | "error" | "success";

/**
 * Two-step forgot-password wizard.
 *
 * Step 1: Collect email + recovery phrase → verify phrase locally by unwrapping
 *         the DEK from server-returned recovery material.
 * Step 2: Collect new password → wrap DEK with new KEK → submit to server.
 */
export default function ForgotPasswordForm() {
  const router = useRouter();

  // --- Step tracking ---
  const [step, setStep] = useState<Step>("step1");

  // --- Step 1 fields ---
  const [email, setEmail] = useState("");
  const [recoveryPhrase, setRecoveryPhrase] = useState("");

  // --- Step 1 API results (held across steps) ---
  const dekRef = useRef<CryptoKey | null>(null);
  const [resetToken, setResetToken] = useState("");

  // --- Step 2 fields ---
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // --- Shared status ---
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // ---- Step 1: Verify recovery phrase ----
  async function handleStep1Submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/recovery-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = await res.json();

      if (!res.ok || json.error) {
        setStatus("error");
        setErrorMsg(json.error ?? "Verification failed. Please try again.");
        return;
      }

      const {
        recovery_salt,
        recovery_iv,
        recovery_wrapped_dek,
        reset_token,
      } = json;

      // Client-side recovery phrase verification
      const recoveryKEK = await deriveKEK(
        recoveryPhrase.trim(),
        recovery_salt
      );
      const extractableDek = await unwrapDEK(
        recovery_wrapped_dek,
        recovery_iv,
        recoveryKEK,
        true
      );

      // Success — hold DEK and token for step 2
      dekRef.current = extractableDek;
      setResetToken(reset_token);
      setStatus("idle");
      setStep("step2");
    } catch {
      setStatus("error");
      setErrorMsg(
        "Recovery key is incorrect. Please check and try again."
      );
    }
  }

  // ---- Step 2: Set new password ----
  async function handleStep2Submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg("");

    if (newPassword !== confirmPassword) {
      setStatus("error");
      setErrorMsg("New passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setStatus("error");
      setErrorMsg("New password must be at least 8 characters.");
      return;
    }

    setStatus("loading");

    try {
      // Generate new password key material
      const newSalt = generateSalt();
      const newKEK = await deriveKEK(newPassword, newSalt);
      const { iv: newIv, wrappedKey: newWrappedDek } = await wrapDEK(
        dekRef.current!,
        newKEK
      );

      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          reset_token: resetToken,
          new_password: newPassword,
          new_salt: newSalt,
          new_iv: newIv,
          new_wrapped_dek: newWrappedDek,
        }),
      });
      const json = await res.json();

      if (!res.ok || json.error) {
        setStatus("error");
        setErrorMsg(json.error ?? "Password reset failed. Please try again.");
        return;
      }

      setStatus("success");
      setTimeout(() => router.push(ROUTES.LOGIN), 2000);
    } catch {
      setStatus("error");
      setErrorMsg("An unexpected error occurred. Please try again.");
    }
  }

  // ---- Success state ----
  if (status === "success") {
    return (
      <div className="space-y-4 text-center">
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/50 dark:text-green-300">
          Password reset successfully. Redirecting to sign in...
        </div>
      </div>
    );
  }

  // ---- Step 1: Email + Recovery Key ----
  if (step === "step1") {
    return (
      <form onSubmit={handleStep1Submit} className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Recover your account
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Enter your email and recovery key to verify your identity.
          </p>
        </div>

        {/* Email */}
        <div className="space-y-2">
          <label
            htmlFor="recovery-email"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Email
          </label>
          <input
            id="recovery-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-400/20"
          />
        </div>

        {/* Recovery Key */}
        <div className="space-y-2">
          <label
            htmlFor="recovery-phrase"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Recovery key
          </label>
          <textarea
            id="recovery-phrase"
            rows={3}
            value={recoveryPhrase}
            onChange={(e) => setRecoveryPhrase(e.target.value)}
            required
            placeholder="opsugrade_..."
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-400/20"
          />
        </div>

        {/* Error */}
        {status === "error" && errorMsg && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
            {errorMsg}
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={status === "loading"}
          className="w-full"
        >
          {status === "loading" ? "Verifying..." : "Verify Identity"}
        </Button>

        {/* Back link */}
        <div className="text-center">
          <Link
            href={ROUTES.LOGIN}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            ← Back to sign in
          </Link>
        </div>
      </form>
    );
  }

  // ---- Step 2: New Password ----
  return (
    <form onSubmit={handleStep2Submit} className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Set new password
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Your recovery key was verified. Choose a new password.
        </p>
      </div>

      {/* New Password */}
      <div className="space-y-2">
        <label
          htmlFor="new-password"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          New password
        </label>
        <input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-400/20"
        />
      </div>

      {/* Confirm Password */}
      <div className="space-y-2">
        <label
          htmlFor="confirm-password"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Confirm new password
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-400/20"
        />
      </div>

      {/* Error */}
      {status === "error" && errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      {/* Submit */}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={status === "loading"}
        className="w-full"
      >
        {status === "loading" ? "Resetting..." : "Reset Password"}
      </Button>
    </form>
  );
}
