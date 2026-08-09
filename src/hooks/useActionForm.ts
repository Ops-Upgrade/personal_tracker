"use client";

import { useState, useCallback } from "react";

/**
 * Shared modal form state — consolidates the isSaving/error/try-catch
 * boilerplate that was copy-pasted across PasswordModal, RecordModal,
 * BankModal, and BankPinModal.
 */
export function useActionForm() {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Wraps an async action: sets isSaving=true, clears error, executes the
   * action, and catches/sets any error. Resets isSaving in finally.
   */
  const withSubmit = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
      setIsSaving(true);
      setError(null);
      try {
        return await fn();
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
        return undefined;
      } finally {
        setIsSaving(false);
      }
    },
    []
  );

  return { isSaving, error, setError, withSubmit };
}
