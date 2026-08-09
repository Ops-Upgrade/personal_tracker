"use client";

import { useState, useCallback } from "react";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
import { fetchExpenses } from "@/api/expense";
import { fetchDocuments } from "@/api/common/documents";
import type { Expense } from "@/types/expense";
import type { Document } from "@/types/document";

/**
 * Shared data-fetching hook for Expense pages.
 * Wraps the useAuthBootstrap + useState + Promise.all boilerplate
 * duplicated across ExpenseView and expense/all.
 */
export function useExpenseData() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  const loadData = useCallback(async (uid: string) => {
    const [expRows, docRows] = await Promise.all([
      fetchExpenses(uid),
      fetchDocuments(uid),
    ]);
    setExpenses(expRows);
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
    expenses,
    documents,
  };
}
