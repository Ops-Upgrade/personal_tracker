"use client";

import { useCallback, useState } from "react";

function readFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw !== null) return JSON.parse(raw) as T;
  } catch {
    // Corrupt or unreadable entry – silently fall back to fallback
  }
  return fallback;
}

/**
 * A generic React hook that mimics `useState` but automatically persists the
 * value to `localStorage` whenever it changes.
 *
 * The initial value is read synchronously from `localStorage` via a lazy
 * initializer – no effects, no cascading renders.
 *
 * Next.js SSR safety: `localStorage` is guarded with a `typeof window` check
 * so the server-rendered HTML always uses `initialValue`, avoiding hydration
 * mismatches.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => readFromStorage(key, initialValue));

  // --- Persist to localStorage on every write ---
  const setStoredValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === "function" ? (next as (prev: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // Storage full or unavailable – update state anyway
        }
        return resolved;
      });
    },
    [key]
  );

  return [value, setStoredValue];
}
