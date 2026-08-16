"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ROUTES } from "@/routes/paths";
import BackButton from "@/components/common/BackButton";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { createCollection, createMedia, findDuplicate, listMedia, getMediaDetails, updateMedia, updateCollection } from "@/api/media";
import type { Media, TmdbSearchResult } from "@/types/media";
import ThemePicker from "@/components/media/modals/ThemePicker";
import AddMediaModal, { clearAddMediaModalCache } from "@/components/media/modals/AddMediaModal";
import AddMediaTile from "@/components/media/views/AddMediaTile";
import { getThemeStyles } from "@/lib/collectionThemes";
import { computeProgress } from "@/components/media/utils";
import { useNavigationGuard } from "@/hooks/useNavigationGuard";
import SortableMediaGrid from "@/components/media/shared/SortableMediaGrid";
import StickyActionBar from "@/components/media/shared/StickyActionBar";
import { useNewSeasonChecks } from "@/hooks/useNewSeasonChecks";
import ViewToggle from "@/components/common/ViewToggle";
import Toast from "@/components/common/Toast";
import type { ToastType } from "@/components/common/Toast";
import TmdbAttribution from "@/components/media/TmdbAttribution";

const DEFAULT_COLOR = "#8B5CF6";

/** Cache key for the AddMediaModal on this page — the collection doesn't exist yet. */
const NEW_COLLECTION_CACHE_KEY = "new-collection";

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
  const themeStyles = getThemeStyles(color);

  const PANEL_THEMES = new Set([
    "theme:galaxy",
    "theme:magma",
    "theme:abyss",
    "theme:cyberpunk",
    "theme:matrix",
  ]);
  const usePanelStyling = PANEL_THEMES.has(color);
  const [saving, setSaving] = useState(false);

  // ── Toast / popup state ──
  const [toastConfig, setToastConfig] = useState<{
    isVisible: boolean;
    message: string;
    type: ToastType;
  }>({ isVisible: false, message: "", type: "success" });
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerToast = useCallback((message: string, type: ToastType = "error") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastConfig({ isVisible: true, message, type });
    toastTimerRef.current = setTimeout(() => {
      setToastConfig((prev) => ({ ...prev, isVisible: false }));
    }, 2000);
  }, []);
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
        router.replace("/media/collection/new_collection");
      } catch {
        // Silently ignore — media will just not be pre-added
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear the AddMediaModal discover-search cache when leaving this page —
  // save navigates to the new collection's detail page, back returns to
  // My Media, so unmount cleanup covers both.
  useEffect(() => {
    return () => {
      clearAddMediaModalCache(NEW_COLLECTION_CACHE_KEY);
    };
  }, []);

  const progress = useMemo(() => computeProgress(localItems), [localItems]);

  const orderedItems = useMemo(() => {
    const idToItem = new Map(localItems.map((m) => [m.id, m]));
    return displayOrder.map((id) => idToItem.get(id)).filter(Boolean) as Media[];
  }, [localItems, displayOrder]);

  // New-season badges for the staged grid. Staged items are created as
  // "unwatched", so the hook currently self-filters everything out — wired
  // here so the badge follows automatically if staged items ever carry real
  // tracking status (e.g. an "add tracked shows as-is" flow).
  const newSeasonMap = useNewSeasonChecks(orderedItems);

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
    navigateTo,
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
      triggerToast("Collection name is required.", "error");
      return;
    }
    setSaving(true);
    try {
      // 1. Create the collection (without ordered_media_ids — we resolve real IDs next)
      const created = await createCollection(userId, {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        ordered_media_ids: [],
      });

      // 2. Resolve each local item to a real media UUID
      const tempToReal = new Map<string, string>();
      for (const item of localItems) {
        if (!item.tmdb_id) continue;

        const existing = findDuplicate(item.tmdb_id, item.type, trackedMedia);

        if (existing) {
          // Link existing tracked media to this new collection
          const existingIds = existing.collection_id
            ? [...(existing.collection_ids ?? []), existing.collection_id]
            : (existing.collection_ids ?? []);
          if (!existingIds.includes(created.id)) {
            await updateMedia(userId, existing.id, {
              collection_ids: [...existingIds, created.id],
            });
          }
          tempToReal.set(item.id, existing.id);
        } else {
          // Create a brand-new media record and capture its UUID
          const newMedia = await createMedia(userId, {
            tmdb_id: item.tmdb_id,
            type: item.type,
            title: item.title,
            poster_path: item.poster_path,
            release_date: item.release_date,
            status: "unwatched",
            collection_ids: [created.id],
            runtime: item.runtime,
          });
          tempToReal.set(item.id, newMedia.id);
        }
      }

      // 3. Replace temp IDs with real UUIDs in ordered_media_ids
      const resolvedIds = displayOrder.map((id) => tempToReal.get(id) ?? id);

      // 4. Patch the collection with the resolved real IDs
      await updateCollection(userId, created.id, {
        ordered_media_ids: resolvedIds,
      });

      router.replace(`/media/collection/${created.id}`);
    } catch (err) {
      triggerToast(err instanceof Error ? err.message : "Failed to create collection.", "error");
      setSaving(false);
    }
  }

  return (
    <>
      {/* ── Textured Page Background Layer ── */}
      <div
        className={`fixed inset-0 pointer-events-none -z-10 transition-all duration-700 ${themeStyles.pageClass || ""}`}
        style={themeStyles.pageStyle}
      />

      <div className="space-y-4">
        <div className="flex flex-col items-start gap-4">
          <BackButton onClick={handleBackClick} />
          <div>
            <h1 className={`text-2xl font-semibold ${themeStyles.titleClass}`} style={themeStyles.titleStyle}>
              New Collection
            </h1>
            <p className={`mt-1 text-sm ${themeStyles.subtitleClass}`} style={themeStyles.subtitleStyle}>
              Create a new collection to organize your media.
            </p>
          </div>
        </div>

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
            className="text-3xl font-bold bg-transparent border-b focus:outline-none focus:border-violet-500 pb-2 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
            style={{ borderColor: (themeStyles.cardStyle.borderColor as string) || `${themeStyles.solidColor}60` }}
            autoFocus
          />
          <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description..."
            className="text-sm bg-transparent border rounded-xl p-3 focus:outline-none focus:border-violet-500 resize-none h-24 placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
            style={{
              borderColor: ((themeStyles.cardStyle.borderColor as string) || `${themeStyles.solidColor}40`),
              backgroundColor: (themeStyles.cardStyle.backgroundColor as string) || undefined,
              color: (themeStyles.titleStyle?.color as string) || undefined,
            }}
          />
        </div>

        {/* Column 2: Color + Progress */}
        <div className="flex flex-col gap-6 justify-center">
          <div className="flex items-center gap-4">
            <label className={`text-sm ${themeStyles.subtitleClass}`} style={themeStyles.subtitleStyle}>
              Theme Color:
            </label>
            <ThemePicker value={color} onChange={setColor} />
            <span className="text-sm text-zinc-500 dark:text-zinc-400 uppercase">
              {color.startsWith("theme:") ? color.replace("theme:", "") : color}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <div className={`flex justify-between text-sm ${themeStyles.subtitleClass}`} style={themeStyles.subtitleStyle}>
              <span>Collection Progress</span>
              <span>{progress.percent}%</span>
            </div>
            <div className={`h-3 w-full rounded-full overflow-hidden ${themeStyles.progressTrackClass}`} style={themeStyles.progressTrackStyle}>
              <div
                className={`h-full transition-all duration-500 ${themeStyles.progressFillClass}`}
                style={{
                  width: `${progress.percent}%`,
                  ...themeStyles.progressFillStyle,
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
      <div
        className={`rounded-xl p-4 md:p-6 ${
          usePanelStyling
            ? themeStyles.panelClass || "border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            : themeStyles.cardClass || "border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
        }`}
        style={usePanelStyling ? themeStyles.panelStyle : themeStyles.cardStyle}
      >
        <div
          className="flex items-center justify-between mb-6 border-b pb-4"
          style={{ borderBottomColor: `${themeStyles.solidColor}40` }}
        >
          <div className="flex items-center gap-4">
            <h2 className={`text-lg ${themeStyles.titleClass}`} style={themeStyles.titleStyle}>
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
            hasNewSeason={(m) => (m.tmdb_id ? !!newSeasonMap[m.tmdb_id] : false)}
            onReorder={(newOrder) => setDisplayOrder(newOrder.map((m) => m.id))}
            onRemove={handleRemoveItem}
            onNavigateItem={navigateTo}
            appendElement={<AddMediaTile viewMode={viewMode} onClick={() => setIsAddModalOpen(true)} />}
          />
        )}
      </div>

      {/* ── Bottom Action Bar ── */}
      <StickyActionBar
        onSave={handleSave}
        onCancel={handleCancel}
        saving={saving}
        isDirty={isDirty}
      />

      <AddMediaModal
        key={isAddModalOpen ? "open" : "closed"}
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddTitle}
        allMedia={trackedMedia}
        collectionId={NEW_COLLECTION_CACHE_KEY}
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

      <TmdbAttribution />
      </div>

      <Toast
        isVisible={toastConfig.isVisible}
        message={toastConfig.message}
        type={toastConfig.type}
      />
    </>
  );
}
