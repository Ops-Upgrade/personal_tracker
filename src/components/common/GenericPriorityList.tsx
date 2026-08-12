"use client";

import { type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "./GenericViewPage";
import GenericDataGrid from "./GenericDataGrid";
import Button from "./Button";

export interface GenericPriorityListProps<T> {
  /** Ordered list of priority values (determines render order). */
  priorities: readonly string[];
  /** Returns items for a given priority value. */
  getItems: (priority: string) => T[];
  /** Returns border + bg colour classes for a priority value. */
  getColors: (priority: string) => { border: string; bg: string };
  /** Renders the priority label / badge in the section header. */
  renderBadge: (priority: string) => ReactNode;
  /** Column definitions for rendering items. */
  columns: ColumnDef<T>[];
  /** Stable unique key for each item. */
  getItemKey: (item: T) => string;

  /** When set, slices items to this count and shows a "View All" button. */
  previewCount?: number;
  /** Base href for "View All" navigation. Required when previewCount is set. */
  viewAllHref?: string;

  /** When true, empty priority groups are hidden entirely. Default: false. */
  hideEmpty?: boolean;

  /** When set, the entire row becomes clickable. */
  onRowClick?: (item: T) => void;
  /** Additional CSS class per row. */
  rowClassName?: string | ((item: T) => string);
  /** Per-row action button (e.g. "Complete"). */
  rowAction?: (item: T) => ReactNode;
  /** Per-row CSS class modifier (e.g. priority-colored left border). */
  getItemClassName?: (item: T) => string;
}

/**
 * Renders items grouped by priority, each group inside a coloured section.
 * Used by both GenericActiveBox (preview mode with previewCount=5) and
 * GenericViewPage (full mode without previewCount).
 */
export default function GenericPriorityList<T>({
  priorities,
  getItems,
  getColors,
  renderBadge,
  columns,
  getItemKey,
  previewCount,
  viewAllHref,
  hideEmpty = false,
  onRowClick,
  rowClassName,
  rowAction,
  getItemClassName,
}: GenericPriorityListProps<T>) {
  const router = useRouter();

  return (
    <>
      {priorities.map((priority) => {
        const group = getItems(priority);
        if (hideEmpty && group.length === 0) return null;
        const colors = getColors(priority);
        const preview = previewCount ? group.slice(0, previewCount) : group;

        return (
          <section
            key={priority}
            className={`rounded-lg border ${colors.border} ${colors.bg} p-2`}
          >
            <h3 className="mb-2">{renderBadge(priority)}</h3>
            {group.length === 0 ? (
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                None
              </div>
            ) : (
              <>
                <GenericDataGrid
                  items={preview}
                  columns={columns}
                  getItemKey={getItemKey}
                  onRowClick={onRowClick}
                  rowClassName={rowClassName}
                  rowAction={rowAction}
                  getItemClassName={getItemClassName}
                />
                {previewCount && viewAllHref && (
                  <div className="mt-2 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(viewAllHref)}
                    >
                      View All ({group.length})
                    </Button>
                  </div>
                )}
              </>
            )}
          </section>
        );
      })}
    </>
  );
}
