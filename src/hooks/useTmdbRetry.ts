"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const RETRY_INTERVAL_MS = 2_500;
const RETRY_WINDOW_MS = 30_000;

/**
 * Error subclass that carries a `transient` flag so callers can distinguish
 * network blips (safe to retry) from hard failures (do not retry).
 */
export interface TmdbRetryError extends Error {
  transient: boolean;
}

/**
 * Managed retry loop for TMDB API calls.
 *
 * When a fetch throws with `err.transient === true`, the hook keeps `loading`
 * true and retries every 2.5 s for up to 30 s. The user sees a loading
 * animation throughout — no error flash, no manual retry button.
 *
 * On a fatal error (or once the 30 s window expires) `loading` flips to false
 * and `error` is populated so the UI can surface a message + manual retry.
 */
export function useTmdbRetry() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);

  // ── Cleanup on unmount ──
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // ── Cancel any in-flight request + pending timer ──
  const cancel = useCallback(() => {
    abortRef.current?.abort();
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    generationRef.current += 1;
    setLoading(false);
    setError(null);
  }, []);

  // ── Execute with retry ──
  const execute = useCallback(
    async <T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> => {
      // Cancel any previous execution still in flight
      abortRef.current?.abort();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      const gen = ++generationRef.current;
      const startTime = Date.now();

      setLoading(true);
      setError(null);

      const attempt = async (): Promise<T> => {
        // Guard: stale generation or unmounted
        if (gen !== generationRef.current || !mountedRef.current) {
          return new Promise<T>(() => {});
        }

        const controller = new AbortController();
        abortRef.current = controller;

        try {
          const result = await fn(controller.signal);

          // Stale generation — a newer execute() call superseded us
          if (gen !== generationRef.current || !mountedRef.current) {
            return new Promise<T>(() => {});
          }

          setLoading(false);
          setError(null);
          return result;
        } catch (err: unknown) {
          // AbortError — deliberate cancellation, never surface to the user
          if (err instanceof DOMException && err.name === "AbortError") {
            return new Promise<T>(() => {});
          }

          // Stale generation — bail silently
          if (gen !== generationRef.current || !mountedRef.current) {
            return new Promise<T>(() => {});
          }

          const isTransient =
            typeof err === "object" &&
            err !== null &&
            "transient" in err &&
            (err as TmdbRetryError).transient === true;

          if (isTransient && Date.now() - startTime < RETRY_WINDOW_MS) {
            // Wait, then retry
            await new Promise<void>((resolve) => {
              timerRef.current = setTimeout(resolve, RETRY_INTERVAL_MS);
            });

            if (gen !== generationRef.current || !mountedRef.current) {
              return new Promise<T>(() => {});
            }

            return attempt();
          }

          // Fatal error or retry window expired
          const message =
            err instanceof Error ? err.message : "An unexpected error occurred.";
          setLoading(false);
          setError(message);
          throw err;
        }
      };

      return attempt();
    },
    [], // dependencies intentionally empty — refs are stable
  );

  // ── Clear error manually (e.g. user taps "Retry" → we want a clean slate) ──
  const clearError = useCallback(() => setError(null), []);

  return { loading, error, execute, clearError, cancel } as const;
}
