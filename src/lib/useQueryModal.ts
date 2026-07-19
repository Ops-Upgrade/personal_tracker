"use client";

import { useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Generalized hook for managing modal targeting via URL query params.
 *
 * Replaces the duplicated `useSearchParams` / `useMemo` / `router.replace`
 * pattern found in TaskManagerView, EducationView, and MedicalView.
 *
 * @param items  - The array of records to search when resolving an edit modal.
 * @param prefix - The slug used in the query param (e.g. "medical" → ?modal=new-medical).
 *
 * @returns modalTarget ("create" | T | null), openCreate, openEdit, closeModal
 */
export function useQueryModal<T extends { id: string }>(
  items: T[],
  prefix: string,
) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modal = searchParams.get("modal");

  const modalTarget = useMemo<T | "create" | null>(() => {
    if (modal === `new-${prefix}`) return "create";
    if (modal?.startsWith(`edit-${prefix}-`)) {
      const id = modal.slice(`edit-${prefix}-`.length);
      return items.find((item) => item.id === id) ?? null;
    }
    return null;
  }, [modal, prefix, items]);

  const setModalParam = useCallback(
    (value: string) => {
      router.replace(`?modal=${encodeURIComponent(value)}`, { scroll: false });
    },
    [router],
  );

  const clearModalParam = useCallback(() => {
    router.replace(window.location.pathname, { scroll: false });
  }, [router]);

  const openCreate = useCallback(
    () => setModalParam(`new-${prefix}`),
    [setModalParam, prefix],
  );

  const openEdit = useCallback(
    (item: T) => setModalParam(`edit-${prefix}-${item.id}`),
    [setModalParam, prefix],
  );

  const closeModal = useCallback(() => {
    clearModalParam();
  }, [clearModalParam]);

  return { modalTarget, openCreate, openEdit, closeModal } as const;
}
