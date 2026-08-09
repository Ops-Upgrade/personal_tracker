"use client";

import { useState, useCallback } from "react";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
import { fetchMedicalRecords } from "@/api/medical";
import { fetchDocuments } from "@/api/common/documents";
import type { MedicalRecord } from "@/types/medical";
import type { Document } from "@/types/document";

/**
 * Shared data-fetching hook for Medical pages.
 * Wraps the useAuthBootstrap + useState + Promise.all boilerplate
 * duplicated across MedicalView and medical/all.
 */
export function useMedicalData() {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  const loadData = useCallback(async (uid: string) => {
    const [recRows, docRows] = await Promise.all([
      fetchMedicalRecords(uid),
      fetchDocuments(uid),
    ]);
    setRecords(recRows);
    setDocuments(docRows);
  }, []);

  const { userId, istDate, nowYear, nowMonth, isLoading, error, refreshData } =
    useAuthBootstrap({ loadData });

  return {
    userId,
    istDate,
    nowYear,
    nowMonth,
    isLoading,
    error,
    refreshData,
    records,
    documents,
  };
}
