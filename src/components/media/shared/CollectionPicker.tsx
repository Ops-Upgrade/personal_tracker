"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getThemeStyles } from "@/lib/collectionThemes";
import type { MediaCollection } from "@/types/media";

interface CollectionPickerProps {
  /** All collections available to the user */
  collections: MediaCollection[];
  /** IDs of collections currently selected */
  selectedIds: string[];
  /** Called when a collection is toggled (added or removed from selection) */
  onToggle: (collectionId: string) => void;
  /** Called when the user clicks the × on a selected collection chip */
  onRemoveClick: (collectionId: string) => void;
  /** Href for the "New Collection" link */
  newCollectionHref: string;
  /** Placeholder text for the search input */
  searchPlaceholder?: string;
}

/**
 * Reusable collection picker: a "+ Collection" dashed button that opens
 * a dropdown with search, a "New Collection" link, and a scrollable list
 * of unselected collections rendered with their theme styles.
 *
 * Extracted from MoviePage and TvSeriesPage where it was duplicated verbatim.
 */
export default function CollectionPicker({
  collections,
  selectedIds,
  onToggle,
  onRemoveClick,
  newCollectionHref,
  searchPlaceholder = "Search collections…",
}: CollectionPickerProps) {
  const router = useRouter();
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!showPicker) return;
    function handleClick(e: MouseEvent) {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target as Node)
      ) {
        setShowPicker(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPicker]);

  const selectedCollections = useMemo(
    () =>
      selectedIds
        .map((id) => collections.find((c) => c.id === id))
        .filter(Boolean) as MediaCollection[],
    [selectedIds, collections],
  );

  const unselectedCollections = useMemo(
    () => collections.filter((c) => !selectedIds.includes(c.id)),
    [collections, selectedIds],
  );

  const filteredUnselected = useMemo(
    () =>
      unselectedCollections.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [unselectedCollections, search],
  );

  return (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        onClick={() => {
          setShowPicker(!showPicker);
          setSearch("");
        }}
        className="px-3 py-1 text-xs font-medium rounded-full border-2 border-dashed border-zinc-300 text-zinc-500 hover:border-zinc-400 hover:text-zinc-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-300 transition-colors"
      >
        + Collection
      </button>

      {showPicker && (
        <div className="absolute top-full left-0 mt-1 w-56 rounded-lg border border-zinc-200 bg-white shadow-lg z-10 dark:border-zinc-700 dark:bg-zinc-800 overflow-hidden">
          {/* Fixed top section */}
          <div className="sticky top-0 bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 p-2 space-y-2">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-zinc-300 bg-zinc-50 py-1.5 pl-2.5 pr-7 text-xs dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                autoFocus
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                >
                  ×
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setShowPicker(false);
                router.push(newCollectionHref);
              }}
              className="w-full text-left px-3 py-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/30 rounded-lg transition-colors"
            >
              ＋ New Collection
            </button>
          </div>

          {/* Filtered list */}
          <div className="max-h-48 overflow-y-auto py-1">
            {filteredUnselected.length > 0 ? (
              filteredUnselected.map((c) => {
                const t = getThemeStyles(c.color ?? "#8B5CF6");
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onToggle(c.id);
                      setShowPicker(false);
                      setSearch("");
                    }}
                    className="w-full text-left px-3 py-1.5"
                  >
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border transition-opacity hover:opacity-80 ${t.titleClass}`}
                      style={{
                        background:
                          (t.cardStyle.background as string) ??
                          (t.cardStyle.backgroundColor as string) ??
                          `${t.solidColor}20`,
                        borderColor:
                          (t.cardStyle.borderColor as string) ?? t.solidColor,
                        ...t.titleStyle,
                        ...(t.cardStyle.boxShadow
                          ? { boxShadow: t.cardStyle.boxShadow as string }
                          : {}),
                      }}
                    >
                      {c.name}
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-2 text-xs text-zinc-400 dark:text-zinc-500">
                No collections match
              </p>
            )}
          </div>
        </div>
      )}

      {/* Selected collection chips */}
      {selectedCollections.map((c) => {
        const t = getThemeStyles(c.color ?? "#8B5CF6");
        return (
          <span
            key={c.id}
            className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border cursor-pointer transition-opacity hover:opacity-80 ${t.titleClass} ml-2`}
            style={{
              background:
                (t.cardStyle.background as string) ??
                (t.cardStyle.backgroundColor as string) ??
                `${t.solidColor}20`,
              borderColor:
                (t.cardStyle.borderColor as string) ?? t.solidColor,
              ...t.titleStyle,
              ...(t.cardStyle.boxShadow
                ? { boxShadow: t.cardStyle.boxShadow as string }
                : {}),
            }}
          >
            {c.name}
            <span
              onClick={(e) => {
                e.stopPropagation();
                onRemoveClick(c.id);
              }}
              className="hover:text-red-500 transition-colors"
              role="button"
              aria-label={`Remove ${c.name}`}
            >
              ×
            </span>
          </span>
        );
      })}
    </div>
  );
}
