"use client";

import { useState, useCallback } from "react";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
import { fetchEducations } from "@/api/education";
import { fetchDocuments } from "@/api/common/documents";
import type { Education } from "@/types/education";
import type { Document } from "@/types/document";

/**
 * Shared data-fetching hook for Education pages.
 * Wraps the useAuthBootstrap + useState + Promise.all boilerplate
 * duplicated across EducationView, education/all, and education/completed.
 */
export function useEducationData() {
  const [educations, setEducations] = useState<Education[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  const loadData = useCallback(async (uid: string) => {
    const [eduRows, docRows] = await Promise.all([
      fetchEducations(uid),
      fetchDocuments(uid),
    ]);
    setEducations(eduRows);
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
    educations,
    documents,
  };
}
