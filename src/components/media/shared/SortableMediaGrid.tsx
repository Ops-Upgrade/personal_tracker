"use client";

import { useCallback, type ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import type { Media } from "@/types/media";
import { SortableDetailItem, SortableTileItem } from "./SortableMediaItem";

// ── Types ──

export interface SortableMediaGridProps {
  /** Already-ordered media items to display. */
  items: Media[];
  /** IDs used by SortableContext (matches `useSortable({ id })` in each item). */
  itemIds: string[];
  /** Current view mode. */
  viewMode: "detail" | "tile";
  /** Per-item unsaved flag — called for each item to determine badge visibility. */
  isUnsaved: (item: Media) => boolean;
  /** Fired after a drag completes with the re-ordered items array. */
  onReorder: (newItems: Media[]) => void;
  /** Optional remove handler forwarded to each item. */
  onRemove?: (id: string) => void;
  /** Rendered after the last item (e.g. `<AddMediaTile>`). */
  appendElement?: ReactNode;
}

// ── Component ──

/**
 * Drag-and-drop grid/list for collection media items.
 *
 * Wraps the DndContext/SortableContext scaffold and renders
 * `SortableDetailItem` or `SortableTileItem` depending on `viewMode`.
 * A `key` derived from all item IDs forces a clean remount when the
 * item set changes so dnd-kit never references stale sortable IDs.
 *
 * Extracted from CollectionDetailPage and NewCollectionPage.
 */
export default function SortableMediaGrid({
  items,
  itemIds,
  viewMode,
  isUnsaved,
  onReorder,
  onRemove,
  appendElement,
}: SortableMediaGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = itemIds.indexOf(String(active.id));
      const newIndex = itemIds.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;

      onReorder(arrayMove([...items], oldIndex, newIndex));
    },
    [items, itemIds, onReorder],
  );

  // Force a clean DndContext remount when the item set changes.
  const dndKey = itemIds.join(",");

  return (
    <DndContext
      key={dndKey}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={itemIds}
        strategy={
          viewMode === "detail"
            ? verticalListSortingStrategy
            : rectSortingStrategy
        }
      >
        {viewMode === "detail" ? (
          <div className="relative z-[3] flex flex-col gap-3">
            {items.map((m) => (
              <SortableDetailItem
                key={m.id}
                media={m}
                onRemove={onRemove}
                isUnsaved={isUnsaved(m)}
              />
            ))}
            {appendElement}
          </div>
        ) : (
          <div className="relative z-[3] grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
            {items.map((m) => (
              <SortableTileItem
                key={m.id}
                media={m}
                onRemove={onRemove}
                isUnsaved={isUnsaved(m)}
              />
            ))}
            {appendElement}
          </div>
        )}
      </SortableContext>
    </DndContext>
  );
}
