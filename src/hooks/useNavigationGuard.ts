"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface UseNavigationGuardOptions {
  /** Whether the form has unsaved changes */
  isDirty: boolean;
  /** Revert all form state back to the last-saved snapshot (optional — create pages can omit) */
  doCancel?: () => void;
  /** Fallback route when browser history is too shallow for router.back() */
  fallbackRoute: string;
}

interface UseNavigationGuardReturn {
  /** Whether the unsaved-changes confirmation dialog should be shown */
  showUnsavedDialog: boolean;
  /** Called when the user clicks Cancel — shows dialog if dirty, else reverts */
  handleCancel: () => void;
  /** Called when the user clicks Back — shows dialog if dirty, else navigates */
  handleBackClick: () => void;
  /** Discard changes, close dialog, and navigate back */
  handleDiscardAndNavigate: () => void;
  /** Close the unsaved dialog without discarding ("Keep Editing") */
  closeUnsavedDialog: () => void;
  /** Navigate back intelligently (history-aware) */
  smartBack: () => void;
}

/**
 * Shared navigation-guard hook for pages with editable forms.
 *
 * Encapsulates the unsaved-changes dialog flow:
 *   - handleCancel / handleBackClick check isDirty → show dialog or proceed
 *   - handleDiscardAndNavigate reverts state + navigates
 *   - smartBack uses history when available, falls back to a configured route
 *
 * The caller still owns the ConfirmDialog rendering — use `showUnsavedDialog`
 * to decide when to show it.
 */
export function useNavigationGuard({
  isDirty,
  doCancel,
  fallbackRoute,
}: UseNavigationGuardOptions): UseNavigationGuardReturn {
  const router = useRouter();
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  const smartBack = useCallback(() => {
    if (window.history.length > 2) {
      router.back();
    } else {
      router.push(fallbackRoute);
    }
  }, [router, fallbackRoute]);

  const handleCancel = useCallback(() => {
    if (isDirty) {
      setShowUnsavedDialog(true);
      return;
    }
    doCancel?.();
  }, [isDirty, doCancel]);

  const handleBackClick = useCallback(() => {
    if (isDirty) {
      setShowUnsavedDialog(true);
      return;
    }
    smartBack();
  }, [isDirty, smartBack]);

  const handleDiscardAndNavigate = useCallback(() => {
    doCancel?.();
    setShowUnsavedDialog(false);
    smartBack();
  }, [doCancel, smartBack]);

  return {
    showUnsavedDialog,
    handleCancel,
    handleBackClick,
    handleDiscardAndNavigate,
    closeUnsavedDialog: () => setShowUnsavedDialog(false),
    smartBack,
  };
}
