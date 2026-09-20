"use client";

import { useState, useCallback } from "react";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
import { fetchNotebooks, fetchSections, fetchPages } from "@/api/notes";
import type { Notebook, Section, Page } from "@/types/notes";

/**
 * Shared data-fetching hook for the Notes domain.
 * Loads notebooks, sections, and pages metadata in parallel via useAuthBootstrap.
 * Page content is fetched on-demand when a page is opened.
 */
export function useNotesData() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [pages, setPages] = useState<Page[]>([]);

  const loadData = useCallback(async (uid: string) => {
    const [fetchedNotebooks, fetchedSections, fetchedPages] = await Promise.all([
      fetchNotebooks(uid),
      fetchSections(uid),
      fetchPages(uid),
    ]);

    setNotebooks(fetchedNotebooks);
    setSections(fetchedSections);
    setPages(fetchedPages);
  }, []);

  const { userId, isLoading, error, refreshData } = useAuthBootstrap({ loadData });

  return {
    userId,
    notebooks,
    sections,
    pages,
    isLoading,
    error,
    refreshData,
    setNotebooks,
    setSections,
    setPages,
  };
}
