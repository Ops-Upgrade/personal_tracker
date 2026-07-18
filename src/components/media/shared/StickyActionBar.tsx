"use client";

import type { ReactNode } from "react";
import Button from "@/components/common/Button";

interface StickyActionBarProps {
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isDirty: boolean;
  /** Slot for extra actions rendered on the left (e.g. a Delete button). */
  leftContent?: ReactNode;
  /** Optional override for the outer container className. */
  className?: string;
}

/**
 * Sticky bottom action bar with Save / Cancel buttons.
 *
 * Uses backdrop-blur for a translucent effect and is position:sticky at the
 * bottom of the viewport. An optional `leftContent` slot supports
 * collection-specific actions like Delete.
 *
 * Extracted from MoviePage, TvSeriesPage, and CollectionDetailPage.
 */
export default function StickyActionBar({
  onSave,
  onCancel,
  saving,
  isDirty,
  leftContent,
  className = "",
}: StickyActionBarProps) {
  return (
    <div
      className={`sticky bottom-0 -mx-4 px-4 py-3 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-sm border-t border-zinc-200 dark:border-zinc-800 flex justify-between gap-2 ${className}`}
    >
      <div>{leftContent}</div>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="md"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={onSave}
          disabled={saving || !isDirty}
        >
          {saving ? "Saving…" : isDirty ? "Save *" : "Save"}
        </Button>
      </div>
    </div>
  );
}
