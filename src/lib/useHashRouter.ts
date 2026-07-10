"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Generic hash-driven state router for modals across all domains.
 *
 * Usage:
 *   const { state, close } = useHashRouter({
 *     parse: (hash, data) => {
 *       if (hash === 'new-task') return { mode: 'create' };
 *       if (hash.startsWith('edit-task-')) return { mode: 'edit', id: hash.slice(10) };
 *       return null;
 *     },
 *     data: tasks,
 *   });
 *
 * - `parse(hash, data)` maps the raw hash string → domain state, or null if no match.
 * - `close()` clears the hash from the URL.
 * - The initial hash is parsed synchronously via useState initializer (no flash).
 * - hashchange events are listened to, and re-parsed when `data` changes (e.g. after load).
 */
export function useHashRouter<T>(opts: {
  parse: (hash: string, data: unknown) => T | null;
  data?: unknown;
}): { state: T | null; close: () => void } {
  const { parse, data } = opts;

  // Keep a ref to the latest parse function so the event listener never goes stale
  const parseRef = useRef(parse);
  parseRef.current = parse;

  const dataRef = useRef(data);
  dataRef.current = data;

  // Lazy initializer — reads current hash once on mount
  const [state, setState] = useState<T | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = window.location.hash.replace("#", "");
    return parseRef.current(raw, dataRef.current);
  });

  // Clear hash from URL without navigation
  const close = useCallback(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
    }
    setState(null);
  }, []);

  // Listen for hash changes
  useEffect(() => {
    const handler = () => {
      const raw = window.location.hash.replace("#", "");
      const next = parseRef.current(raw, dataRef.current);
      setState(next);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  // Re-parse when data loads/changes (e.g. after fetch)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.location.hash.replace("#", "");
    const next = parse(raw, data);
    // Only update if the parse result actually changed (avoids infinite loops)
    setState((prev) => {
      const prevStr = JSON.stringify(prev);
      const nextStr = JSON.stringify(next);
      return prevStr !== nextStr ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return { state, close };
}
