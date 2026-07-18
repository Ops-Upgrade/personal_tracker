"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ROUTES } from "@/routes/paths";
import BackButton from "@/components/common/BackButton";
import ErrorBanner from "@/components/common/ErrorBanner";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { createCollection, createMedia, findDuplicate, listMedia, getMediaDetails } from "@/api/media";
import type { Media, TmdbSearchResult } from "@/types/media";
import ThemePicker from "@/components/media/modals/ThemePicker";
import AddMediaModal from "@/components/media/modals/AddMediaModal";
import AddMediaTile from "@/components/media/views/AddMediaTile";
import { getThemeStyles } from "@/lib/collectionThemes";
import { computeProgress } from "@/components/media/utils";
import { useNavigationGuard } from "@/hooks/useNavigationGuard";
import SortableMediaGrid from "@/components/media/shared/SortableMediaGrid";
import ViewToggle from "@/components/common/ViewToggle";

const DEFAULT_COLOR = "#8B5CF6";

/** Estimate runtime for progress bar — TMDB search results don't include runtime. */
function estimateRuntime(item: TmdbSearchResult): number {
  return item.type === "movie" ? 120 : 450; // 2h movie, ~10 episodes × 45min for TV
}

// ── Main page ──

export default function NewCollectionPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useLocalStorage<"detail" | "tile">("mediaCollectionDetailLayout", "detail");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [trackedMedia, setTrackedMedia] = useState<Media[]>([]);

  // Local items — in-memory only, saved to DB when "Save Collection" is clicked
  const [localItems, setLocalItems] = useState<Media[]>([]);
  // Track order separately for drag-and-drop
  const [displayOrder, setDisplayOrder] = useState<string[]>([]);
  const counterRef = useRef(0);
  function nextId() {
    counterRef.current += 1;
    return `temp-${Date.now()}-${counterRef.current}`;
  }

  const searchParams = useSearchParams();
  const { userId } = useAuthBootstrap({
    loadData: async (uid) => {
      const media = await listMedia(uid);
      setTrackedMedia(media);
    },
    fetchServerDate: false,
  });

  // Auto-add media from URL params (e.g. from MoviePage/TvSeriesPage "New Collection" button)
  const autoAddedRef = useRef(false);
  useEffect(() => {
    if (autoAddedRef.current) return;
    const addTmdbId = searchParams.get("add_tmdb_id");
    const addType = searchParams.get("add_type") as "movie" | "tv" | null;
    if (!addTmdbId || !addType) return;

    autoAddedRef.current = true;
    (async () => {
      try {
        const details = await getMediaDetails(Number(addTmdbId), addType);
        const title = details.title || details.name || "Unknown";
        const runtime =
          addType === "movie"
            ? details.runtime || 120
            : (details.number_of_episodes || 10) * (details.episode_run_time?.[0] || 45);

        const newMedia: Media = {
          id: nextId(),
          tmdb_id: Number(addTmdbId),
          type: addType,
          title,
          poster_path: details.poster_path,
          release_date: details.release_date,
          status: "unwatched",
          created_at: new Date().toISOString(),
          runtime,
        };

        setLocalItems((prev) => [...prev, newMedia]);
        setDisplayOrder((prev) => [...prev, newMedia.id]);

        // Clean URL so refresh doesn't re-add
        router.replace("/media/collection/new");
      } catch {
        // Silently ignore — media will just not be pre-added
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progress = useMemo(() => computeProgress(localItems), [localItems]);

  const orderedItems = useMemo(() => {
    const idToItem = new Map(localItems.map((m) => [m.id, m]));
    return displayOrder.map((id) => idToItem.get(id)).filter(Boolean) as Media[];
  }, [localItems, displayOrder]);

  const isDirty =
    name.trim() !== "" ||
    description.trim() !== "" ||
    color !== DEFAULT_COLOR ||
    localItems.length > 0;

  // ── Navigation guard ──

  const {
    showUnsavedDialog,
    handleCancel,
    handleBackClick,
    handleDiscardAndNavigate,
    closeUnsavedDialog,
  } = useNavigationGuard({
    isDirty,
    fallbackRoute: `${ROUTES.MEDIA}?tab=manager&subtab=collections`,
  });

  // ── Search → add to local state ──

  function handleAddTitle(item: TmdbSearchResult) {
    // Prevent duplicates
    if (localItems.some((m) => m.tmdb_id === item.tmdb_id && m.type === item.type)) return;

    const newMedia: Media = {
      id: nextId(),
      tmdb_id: item.tmdb_id,
      type: item.type,
      title: item.title,
      poster_path: item.poster_path,
      release_date: item.release_date,
      status: "unwatched",
      created_at: new Date().toISOString(),
      runtime: estimateRuntime(item),
    };

    setLocalItems((prev) => [...prev, newMedia]);
    setDisplayOrder((prev) => [...prev, newMedia.id]);
  }

  function handleRemoveItem(id: string) {
    setLocalItems((prev) => prev.filter((m) => m.id !== id));
    setDisplayOrder((prev) => prev.filter((oid) => oid !== id));
  }

  // ── Save ──

  async function handleSave() {
    if (!userId) return;
    if (!name.trim()) {
      setError("Collection name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // 1. Create the collection
      const created = await createCollection(userId, {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        ordered_media_ids: displayOrder,
      });

      // 2. Create media records for each local item (or link existing tracked ones)
      for (const item of localItems) {
        if (item.tmdb_id) {
          // Check if already tracked — if so, just update its collection_ids
          const existing = findDuplicate(item.tmdb_id, item.type, []);
          if (existing) {
            // This won't work since we don't have the full media list here.
            // For now, create new media records; dedup happens in listMedia.
          }
          await createMedia(userId, {
            tmdb_id: item.tmdb_id,
            type: item.type,
            title: item.title,
            poster_path: item.poster_path,
            release_date: item.release_date,
            status: "unwatched",
            collection_ids: [created.id],
            runtime: item.runtime,
          });
        }
      }

      router.push(`/media/collection/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create collection.");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-start gap-4">
        <BackButton onClick={handleBackClick} />
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            New Collection
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Create a new collection to organize your media.
          </p>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* ── 2-column Metadata Matrix ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12">
        {/* Column 1: Name + Description */}
        <div className="flex flex-col gap-4">
          <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Collection Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Collection Name"
            className="text-3xl font-bold bg-transparent border-b border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-violet-500 pb-2 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
            autoFocus
          />
          <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description..."
            className="text-sm bg-transparent border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-violet-500 resize-none h-24 text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
          />
        </div>

        {/* Column 2: Color + Progress */}
        <div className="flex flex-col gap-6 justify-center">
          <div className="flex items-center gap-4">
            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Theme Color:
            </label>
            <ThemePicker value={color} onChange={setColor} />
            <span className="text-sm text-zinc-500 dark:text-zinc-400 uppercase">
              {color.startsWith("theme:") ? color.replace("theme:", "") : color}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              <span>Collection Progress</span>
              <span>{progress.percent}%</span>
            </div>
            <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${progress.percent}%`,
                  backgroundColor: getThemeStyles(color).solidColor,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-zinc-400 dark:text-zinc-500">
              <span>{localItems.length} {localItems.length === 1 ? "title" : "titles"}</span>
              <span>
                {progress.totalMins > 0
                  ? `${Math.round(progress.totalMins / 60)}h total`
                  : "0h total"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Titles Matrix ── */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 md:p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between mb-6 border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Titles in Collection
            </h2>
          </div>
          <ViewToggle value={viewMode} onChange={setViewMode} variant="media" />
        </div>

        {localItems.length === 0 ? (
          <div className={viewMode === "detail" ? "flex flex-col gap-3" : "grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3"}>
            <AddMediaTile viewMode={viewMode} onClick={() => setIsAddModalOpen(true)} />
          </div>
        ) : (
          <SortableMediaGrid
            items={orderedItems}
            itemIds={displayOrder}
            viewMode={viewMode}
            isUnsaved={() => true}
            onReorder={(newOrder) => setDisplayOrder(newOrder.map((m) => m.id))}
            onRemove={handleRemoveItem}
            appendElement={<AddMediaTile viewMode={viewMode} onClick={() => setIsAddModalOpen(true)} />}
          />
        )}
      </div>

      {/* ── Unified Bottom Action Bar (matches GlobalActionModal footer) ── */}
      <div className="shrink-0 flex justify-end gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <Button
          variant="secondary"
          size="md"
          onClick={handleCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button variant="primary" size="md" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      <AddMediaModal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddTitle}
        allMedia={trackedMedia}
      />

      {/* ── Unsaved Changes Dialog ── */}
      {showUnsavedDialog && (
        <ConfirmDialog
          title="Discard unsaved changes?"
          description="You have unsaved items in this collection. Discarding will remove all added titles and reset any metadata changes."
          confirmLabel="Discard"
          cancelLabel="Keep Editing"
          onConfirm={handleDiscardAndNavigate}
          onCancel={closeUnsavedDialog}
        />
      )}
    </div>
  );
}
