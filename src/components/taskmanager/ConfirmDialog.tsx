"use client";

import ModalFrame from "./ModalFrame";

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <ModalFrame title={title} onClose={onCancel} maxWidthClassName="max-w-md">
      <p className="text-sm text-zinc-600 dark:text-zinc-300">{description}</p>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-lg border border-red-400 bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 dark:border-red-800 dark:bg-red-700 dark:hover:bg-red-800"
        >
          {confirmLabel}
        </button>
      </div>
    </ModalFrame>
  );
}
