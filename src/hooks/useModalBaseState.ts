"use client";

import { useState, useCallback } from "react";
import type { ToastType } from "@/components/common/Toast";

// ---------- types ----------

export interface ToastConfig {
  isVisible: boolean;
  message: string;
  type: ToastType;
}

// ---------- hook ----------

/**
 * Shared UI state for domain modals.
 *
 * Consolidates the boilerplate that was copy-pasted across EducationModal,
 * ExpenseModal, MedicalModal, TaskModal, and NoteModal:
 *   - isSaving / setIsSaving
 *   - error / setError
 *   - showDeleteConfirm / setShowDeleteConfirm
 *   - toastConfig / triggerToast
 */
export function useModalBaseState() {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toastConfig, setToastConfig] = useState<ToastConfig>({
    isVisible: false,
    message: "",
    type: "success",
  });

  const triggerToast = useCallback(
    (message: string, type: ToastType = "success") => {
      setToastConfig({ isVisible: true, message, type });
      setTimeout(
        () => setToastConfig((prev) => ({ ...prev, isVisible: false })),
        2000,
      );
    },
    [],
  );

  return {
    isSaving,
    setIsSaving,
    error,
    setError,
    showDeleteConfirm,
    setShowDeleteConfirm,
    toastConfig,
    triggerToast,
  };
}
