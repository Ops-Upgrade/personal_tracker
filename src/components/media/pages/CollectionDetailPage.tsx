"use client";

import { useCallback, useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/routes/paths";
import BackButton from "@/components/common/BackButton";
import ErrorBanner from "@/components/common/ErrorBanner";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import Toast from "@/components/common/Toast";
import type { ToastType } from "@/components/common/Toast";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
import { useLocalStorage } from "@/lib/useLocalStorage";
import {
  listMedia,
  updateMedia,
  createMedia,
  findDuplicate,
  listCollections,
  updateCollection,
  deleteCollection,
} from "@/api/media";
import type { Media, MediaCollection, TmdbSearchResult } from "@/types/media";
import ThemePicker from "@/components/media/modals/ThemePicker";
import AddMediaModal, { clearAddMediaModalCache } from "@/components/media/modals/AddMediaModal";
import AddMediaTile from "@/components/media/views/AddMediaTile";
import { getThemeStyles } from "@/lib/collectionThemes";
import { computeProgress } from "@/components/media/utils";
import TmdbAttribution from "@/components/media/TmdbAttribution";
import { useNavigationGuard } from "@/hooks/useNavigationGuard";
import StickyActionBar from "@/components/media/shared/StickyActionBar";
import SortableMediaGrid from "@/components/media/shared/SortableMediaGrid";
import ViewToggle from "@/components/common/ViewToggle";

interface CollectionDetailPageProps {
  collectionId: string;
}
// ── Main page ──

export default function CollectionDetailPage({
  collectionId,
}: CollectionDetailPageProps) {
  const router = useRouter();
  const [allMedia, setAllMedia] = useState<Media[]>([]);
  const [collection, setCollection] = useState<MediaCollection | null>(null);
  const [viewMode, setViewMode] = useLocalStorage<"detail" | "tile">("mediaCollectionDetailLayout", "detail");

  // Inline editing state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#8B5CF6");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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

  // ── Local staging state ──
  const [pendingAdds, setPendingAdds] = useState<Media[]>([]);
  const [pendingRemoves, setPendingRemoves] = useState<Set<string>>(new Set());
  const [originalOrder, setOriginalOrder] = useState<string[]>([]);
  const [displayOrder, setDisplayOrder] = useState<string[]>([]);
  const dataLoadedRef = useRef(false);

  const loadAllData = useCallback(
    async (uid: string) => {
      const [media, cols] = await Promise.all([
        listMedia(uid),
        listCollections(uid),
      ]);
      setAllMedia(media);
      const col = cols.find((c) => c.id === collectionId) ?? null;
      setCollection(col);
      if (col) {
        setName(col.name ?? "");
        setDescription(col.description ?? "");
        setColor(col.color ?? "#8B5CF6");
      }
    },
    [collectionId],
  );

  const { userId, isLoading, error } = useAuthBootstrap({
    loadData: loadAllData,
    fetchServerDate: false,
  });

  // Items belonging to this collection (from DB)
  const rawItems = useMemo(
    () =>
      allMedia.filter(
        (m) =>
          m.collection_ids?.includes(collectionId) ||
          m.collection_id === collectionId,
      ),
    [allMedia, collectionId],
  );

  // Sort raw items by ordered_media_ids
  const sortedItems = useMemo(() => {
    const ordered = collection?.ordered_media_ids;
    if (ordered && ordered.length > 0) {
      const indexed = new Map(rawItems.map((m) => [m.id, m]));
      const sorted: Media[] = [];
      for (const id of ordered) {
        const item = indexed.get(id);
        if (item) {
          sorted.push(item);
          indexed.delete(id);
        }
      }
      const remaining = Array.from(indexed.values()).sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      sorted.push(...remaining);
      return sorted;
    }
    return rawItems;
  }, [rawItems, collection?.ordered_media_ids]);

  // Initialize displayOrder + originalOrder once data loads
  useEffect(() => {
    if (!dataLoadedRef.current && sortedItems.length > 0 && !isLoading) {
      const ids = sortedItems.map((m) => m.id);
      setDisplayOrder(ids);
      setOriginalOrder(ids);
      dataLoadedRef.current = true;
    }
  }, [sortedItems, isLoading]);

  // Clear this collection's AddMediaModal discover-search cache when leaving
  // the page (back, delete, or navigation away) so stale searches don't
  // reappear on re-entry.
  useEffect(() => {
    return () => {
      clearAddMediaModalCache(collectionId);
    };
  }, [collectionId]);

  // ── Derived data ──

  const effectiveItems = useMemo(() => {
    const dbItems = rawItems.filter((m) => !pendingRemoves.has(m.id));
    const combined = [...dbItems, ...pendingAdds];
    const seen = new Set<string>();
    return combined.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [rawItems, pendingRemoves, pendingAdds]);

  const orderedMedia = useMemo(() => {
    const idToMedia = new Map(effectiveItems.map((m) => [m.id, m]));
    return displayOrder
      .map((id) => idToMedia.get(id))
      .filter(Boolean) as Media[];
  }, [effectiveItems, displayOrder]);

  const progress = useMemo(() => computeProgress(effectiveItems), [effectiveItems]);

  // ── isDirty ──

  const isMetadataDirty =
    name !== (collection?.name ?? "") ||
    description !== (collection?.description ?? "") ||
    color !== (collection?.color ?? "#8B5CF6");

  const isMediaDirty = pendingAdds.length > 0 || pendingRemoves.size > 0;

  const isOrderDirty = useMemo(() => {
    if (pendingAdds.length > 0 || pendingRemoves.size > 0) return false;
    if (displayOrder.length !== originalOrder.length) return true;
    return displayOrder.some((id, i) => originalOrder[i] !== id);
  }, [displayOrder, originalOrder, pendingAdds.length, pendingRemoves.size]);

  const isDirty = isMetadataDirty || isMediaDirty || isOrderDirty;

  // ── Add title (local stage) ──

  function handleAddTitle(item: TmdbSearchResult) {
    if (!collection) return;

    const alreadyInCollection = effectiveItems.some(
      (m) =>
        m.tmdb_id === item.tmdb_id &&
        m.type === item.type,
    );
    if (alreadyInCollection) return;

    const previouslyRemoved = rawItems.find(
      (m) =>
        m.tmdb_id === item.tmdb_id &&
        m.type === item.type &&
        pendingRemoves.has(m.id),
    );
    if (previouslyRemoved) {
      setPendingRemoves((prev) => {
        const next = new Set(prev);
        next.delete(previouslyRemoved.id);
        return next;
      });
      setDisplayOrder((prev) => {
        if (!prev.includes(previouslyRemoved.id)) {
          return [...prev, previouslyRemoved.id];
        }
        return prev;
      });
      return;
    }

    const existing = findDuplicate(item.tmdb_id, item.type, allMedia);

    if (existing) {
      setPendingAdds((prev) => [...prev, { ...existing }]);
      setDisplayOrder((prev) => [...prev, existing.id]);
    } else {
      const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const newMedia: Media = {
        id: tempId,
        tmdb_id: item.tmdb_id,
        type: item.type,
        title: item.title,
        poster_path: item.poster_path,
        release_date: item.release_date,
        status: "unwatched",
        created_at: new Date().toISOString(),
        runtime: item.type === "movie" ? 120 : 450,
      };
      setPendingAdds((prev) => [...prev, newMedia]);
      setDisplayOrder((prev) => [...prev, tempId]);
    }
  }

  // ── Remove item (local stage) ──

  function handleRemoveItem(id: string) {
    if (pendingAdds.some((m) => m.id === id)) {
      setPendingAdds((prev) => prev.filter((m) => m.id !== id));
      setDisplayOrder((prev) => prev.filter((oid) => oid !== id));
    } else {
      setPendingRemoves((prev) => new Set([...prev, id]));
      setDisplayOrder((prev) => prev.filter((oid) => oid !== id));
    }
  }

  // ── Persist all staged changes ──

  async function handleSaveAll() {
    if (!userId || !collection) return;
    if (!name.trim()) {
      triggerToast("Collection name is required.", "error");
      setName(collection.name ?? "Untitled");
      return;
    }
    setSaving(true);
    try {
      for (const removeId of pendingRemoves) {
        const mediaRecord = allMedia.find((m) => m.id === removeId);
        if (mediaRecord) {
          const allColIds = mediaRecord.collection_id
            ? [...(mediaRecord.collection_ids ?? []), mediaRecord.collection_id]
            : (mediaRecord.collection_ids ?? []);
          const updatedIds = allColIds.filter((cid) => cid !== collectionId);
          await updateMedia(userId, removeId, { collection_ids: updatedIds });
        }
      }

      const newMediaIds: string[] = [];
      for (const pendingItem of pendingAdds) {
        const isTemp = pendingItem.id.startsWith("pending-");

        if (isTemp) {
          const created = await createMedia(userId, {
            tmdb_id: pendingItem.tmdb_id,
            type: pendingItem.type,
            title: pendingItem.title,
            poster_path: pendingItem.poster_path,
            release_date: pendingItem.release_date,
            status: pendingItem.status,
            collection_ids: [collectionId],
            runtime: pendingItem.runtime,
          });
          newMediaIds.push(created.id);
        } else {
          const existingIds = pendingItem.collection_id
            ? [...(pendingItem.collection_ids ?? []), pendingItem.collection_id]
            : (pendingItem.collection_ids ?? []);
          if (!existingIds.includes(collectionId)) {
            await updateMedia(userId, pendingItem.id, {
              collection_ids: [...existingIds, collectionId],
            });
          }
          newMediaIds.push(pendingItem.id);
        }
      }

      const tempToReal = new Map<string, string>();
      let tempIdx = 0;
      for (const pendingItem of pendingAdds) {
        if (pendingItem.id.startsWith("pending-")) {
          tempToReal.set(pendingItem.id, newMediaIds[tempIdx] ?? pendingItem.id);
        }
        tempIdx++;
      }

      const resolvedIds = displayOrder.map((id) => tempToReal.get(id) ?? id);

      const updated = await updateCollection(userId, collectionId, {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        ordered_media_ids: resolvedIds,
      });
      setCollection(updated);

      setPendingAdds([]);
      setPendingRemoves(new Set());
      setOriginalOrder(resolvedIds);
      setDisplayOrder(resolvedIds);

      const media = await listMedia(userId);
      setAllMedia([...media]);

      // Save keeps the user on this page, so clear the AddMediaModal
      // discover-search cache here as well — reopening the modal after a save
      // should start fresh instead of showing the pre-save search.
      clearAddMediaModalCache(collectionId);

      triggerToast("✓ Saved", "success");
    } catch {
      triggerToast("Failed to save collection. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  // ── Navigation guard ──

  function doCancel() {
    if (!collection) return;
    setName(collection.name ?? "");
    setDescription(collection.description ?? "");
    setColor(collection.color ?? "#8B5CF6");
    setPendingAdds([]);
    setPendingRemoves(new Set());
    setDisplayOrder([...originalOrder]);
  }

  const {
    showUnsavedDialog,
    handleCancel,
    handleBackClick,
    handleDiscardAndNavigate,
    closeUnsavedDialog,
    navigateTo,
  } = useNavigationGuard({
    isDirty,
    doCancel,
    fallbackRoute: `${ROUTES.MEDIA}?tab=manager&subtab=collections`,
  });

  // Forward navigation to media detail pages carries the collection context
  // (?from=collection&colId=…) so the detail page's Back button returns here.
  const handleNavigateToMedia = useCallback(
    (url: string) => navigateTo(`${url}?from=collection&colId=${collectionId}`),
    [navigateTo, collectionId],
  );

  // ── Delete ──

  async function handleDelete() {
    if (!userId) return;
    setDeleting(true);
    try {
      await deleteCollection(userId, collectionId);
      // Navigate back after delete
      if (window.history.length > 2) {
        router.back();
      } else {
        router.push(`${ROUTES.MEDIA}?tab=manager&subtab=collections`);
      }
    } catch {
      triggerToast("Failed to delete collection. Please try again.", "error");
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  const itemCount = effectiveItems.length;
  const themeStyles = getThemeStyles(color);

  const PANEL_THEMES = new Set([
    "theme:galaxy",
    "theme:magma",
    "theme:abyss",
    "theme:cyberpunk",
    "theme:matrix",
  ]);
  const usePanelStyling = PANEL_THEMES.has(color);

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
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              Collection
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Manage collection details, media, and theme.
            </p>
          </div>
        </div>

        {/* ── Collection not found guard ── */}
        {!isLoading && !error && !collection && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="text-6xl">📭</div>
            <h2 className="text-xl font-semibold text-zinc-700 dark:text-zinc-300">
              Collection not found
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              This collection may have been deleted or you may not have access to it.
            </p>
            <Button
              variant="primary"
              size="md"
              onClick={() => router.push(`${ROUTES.MEDIA}?tab=manager&subtab=collections`)}
            >
              Back to Collections
            </Button>
          </div>
        )}

        {/* Only render editable content when collection exists */}
        {collection && (
          <>
            {/* ── 2-column Metadata Matrix ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12">
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
              style={{ borderColor: isDirty ? undefined : ((themeStyles.cardStyle.borderColor as string) || `${themeStyles.solidColor}60`) }}
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
                <span>{itemCount} {itemCount === 1 ? "title" : "titles"}</span>
                <span>
                  {progress.totalMins > 0
                    ? `${Math.round(progress.totalMins / 60)}h total`
                    : "No runtime data"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Titles Matrix ── */}
        {!isLoading && !error && (
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

            {orderedMedia.length === 0 ? (
              <div className={`relative z-[3] ${viewMode === "detail" ? "flex flex-col gap-3" : "grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3"}`}>
                <AddMediaTile viewMode={viewMode} onClick={() => setIsAddModalOpen(true)} />
              </div>
            ) : (
              <SortableMediaGrid
                items={orderedMedia}
                itemIds={displayOrder}
                viewMode={viewMode}
                isUnsaved={(m) => pendingAdds.some((p) => p.id === m.id)}
                onReorder={(newOrder) => setDisplayOrder(newOrder.map((m) => m.id))}
                onRemove={handleRemoveItem}
                onNavigateItem={handleNavigateToMedia}
                appendElement={<AddMediaTile viewMode={viewMode} onClick={() => setIsAddModalOpen(true)} />}
              />
            )}
          </div>
        )}

        {isLoading && (
          <p className="py-8 text-center text-sm text-zinc-500">
            Loading collection…
          </p>
        )}

        {error && <ErrorBanner message={error} />}

        {/* ── Bottom Action Bar ── */}
        {!isLoading && !error && (
          <>
            <StickyActionBar
              onSave={handleSaveAll}
              onCancel={handleCancel}
              saving={saving}
              isDirty={isDirty}
              rightContent={
                <Button
                  variant="danger"
                  size="md"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={saving || deleting}
                >
                  Delete
                </Button>
              }
            />
          </>
        )}

        <TmdbAttribution />
        </>)}
      </div>

      <AddMediaModal
        key={isAddModalOpen ? "open" : "closed"}
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddTitle}
        allMedia={allMedia}
        collectionId={collectionId}
      />

      {/* ── Unsaved Changes Dialog ── */}
      {showUnsavedDialog && (
        <ConfirmDialog
          title="Discard unsaved changes?"
          description="You have unsaved changes to this collection. Discarding will revert all additions, removals, reordering, and metadata edits."
          confirmLabel="Discard"
          cancelLabel="Keep Editing"
          onConfirm={handleDiscardAndNavigate}
          onCancel={closeUnsavedDialog}
        />
      )}

      {/* ── Delete Collection Dialog ── */}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Collection?"
          description="This collection will be deleted, but it will not affect your ratings, reviews, or watched data on the individual movies and shows."
          confirmLabel={deleting ? "Deleting…" : "Delete"}
          cancelLabel="Cancel"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      <Toast
        isVisible={toastConfig.isVisible}
        message={toastConfig.message}
        type={toastConfig.type}
      />
    </>
  );
}
