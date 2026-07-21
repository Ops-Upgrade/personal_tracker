"use client";

import { useState } from "react";
import Button from "@/components/common/Button";

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (deleteFiles?: boolean) => void;
  onCancel: () => void;
  /** If provided, shows a checkbox for cascade-deleting associated files */
  showDeleteFilesCheckbox?: boolean;
  deleteFilesLabel?: string;
  /** When true, the checkbox is rendered disabled (greyed out). */
  checkboxDisabled?: boolean;
}

/**
 * Confirmation dialog with no X close button.
 * Clicking the backdrop is equivalent to pressing Cancel (Task 1.7).
 */
export default function ConfirmDialog({
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  showDeleteFilesCheckbox = false,
  deleteFilesLabel = "Also delete associated files",
  checkboxDisabled = false,
}: ConfirmDialogProps) {
  const [deleteFiles, setDeleteFiles] = useState(false);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h3>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          {description}
        </p>

        {showDeleteFilesCheckbox && (
          <label className={`mt-3 flex items-center gap-2 text-sm ${checkboxDisabled ? "text-zinc-400 dark:text-zinc-500 opacity-70 cursor-not-allowed" : "text-zinc-700 dark:text-zinc-300 cursor-pointer"}`}>
            <input
              type="checkbox"
              checked={deleteFiles && !checkboxDisabled}
              disabled={checkboxDisabled}
              onChange={(e) => setDeleteFiles(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-red-600 focus:ring-red-600 dark:border-zinc-600 dark:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {deleteFilesLabel}
          </label>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="secondary"
            size="md"
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            variant="danger"
            size="md"
            onClick={() => onConfirm(deleteFiles)}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
