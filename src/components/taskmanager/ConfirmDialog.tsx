"use client";

import Button from "@/components/common/Button";
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
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </ModalFrame>
  );
}
