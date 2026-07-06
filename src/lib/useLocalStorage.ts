"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * A generic React hook that mimics `useState` but automatically persists the
 * value to `localStorage` whenever it changes.
 *
 * The hook reads the initial value from `localStorage` on mount. If no stored
 * value is found (or parsing fails), it falls back to `initialValue`.
 *
 * Next.js SSR safety: `localStorage` is only accessed inside `useEffect` so
 * the server-rendered HTML always uses `initialValue`, avoiding hydration
 * mismatches.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  // --- Lazy initializer: always start with the default on first render ---
  const [value, setValue] = useState<T>(initialValue);

  // --- On mount (client-only), read the stored value if present ---
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        const parsed = JSON.parse(raw) as T;
        setValue(parsed);
      }
    } catch {
      // Corrupt or unreadable entry – silently fall back to initialValue
    }
  }, [key]);

  // --- Persist whenever value changes ---
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