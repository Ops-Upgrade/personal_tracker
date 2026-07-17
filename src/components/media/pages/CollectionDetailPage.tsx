"use client";

import { useCallback, useState, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ROUTES } from "@/routes/paths";
import BackButton from "@/components/common/BackButton";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/taskmanager/ConfirmDialog";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
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
import AddMediaModal from "@/components/media/modals/AddMediaModal";
import AddMediaTile from "@/components/media/views/AddMediaTile";
import { getThemeStyles } from "@/lib/collectionThemes";
import TmdbAttribution from "@/components/media/TmdbAttribution";
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
  useSortable,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Star,
  MessageSquare,
  LayoutGrid,
  List,
  Film,
  Tv,
  Trash2,
} from "lucide-react";

const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w92";
const TMDB_POSTER_MD = "https://image.tmdb.org/t/p/w342";

const statusColors: Record<Media["status"], string> = {
  unwatched: "bg-red-500/90 text-white",
  watching: "bg-yellow-500/90 text-white",
  watched: "bg-green-600/90 text-white",
};

interface CollectionDetailPageProps {
  collectionId: string;
}

/** Compute progress percent for a collection based on runtime. */
function computeProgress(items: Media[]): {
  percent: number;
  totalMins: number;
  watchedMins: number;
} {
  let totalMins = 0;
  let watchedMins = 0;

  for (const m of items) {
    const rt = m.runtime || 0;
    totalMins += rt;
    if (m.status === "watched") watchedMins += rt;
    if (m.status === "watching") watchedMins += rt * 0.5;
  }

  const percent = totalMins === 0 ? 0 : Math.round((watchedMins / totalMins) * 100);
  return { percent, totalMins, watchedMins };
}

// ── Detail (list) item ──

function SortableDetailItem({
  media,
  onRemove,
  isUnsaved,
}: {
  media: Media;
  onRemove?: (id: string) => void;
  isUnsaved?: boolean;
}) {
  const router = useRouter();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: media.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const posterUrl = media.poster_path
    ? `${TMDB_POSTER_BASE}${media.poster_path}`
    : null;

  const year = media.release_date
    ? new Date(media.release_date).getFullYear()
    : undefined;

  const mediaUrl =
    media.type === "movie"
      ? ROUTES.MEDIA_MOVIE(media.tmdb_id!)
      : ROUTES.MEDIA_TV(media.tmdb_id!);

  function handleClick(e: React.MouseEvent) {
    // Don't navigate if clicking the drag handle or remove button
    if ((e.target as HTMLElement).closest("[data-no-nav]")) return;
    router.push(mediaUrl);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 relative cursor-pointer hover:border-violet-300 dark:hover:border-violet-700 transition-colors"
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        data-no-nav
        className="shrink-0 cursor-grab active:cursor-grabbing text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical size={18} />
      </button>

      {/* Poster thumbnail */}
      <div className="relative w-10 h-[60px] shrink-0 rounded-md overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={media.title}
            fill
            sizes="40px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[8px] text-zinc-400">
            N/A
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
          {media.title}
        </h4>
        <div className="flex items-center gap-2 mt-0.5">
          {year && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{year}</span>
          )}
          <span className="text-[10px] uppercase font-medium text-zinc-400 dark:text-zinc-500">
            {media.type === "movie" ? "Movie" : "TV"}
          </span>
          {media.runtime && (
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
              {media.runtime >= 60
                ? `${Math.floor(media.runtime / 60)}h ${media.runtime % 60}m`
                : `${media.runtime}m`}
            </span>
          )}
        </div>
      </div>

      {/* Badge stack — absolute top-right, matching episode matrix */}
      <div className="absolute top-3 right-10 flex flex-col items-end gap-1.5">
        {!isUnsaved && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase shadow-sm ${statusColors[media.status]}`}>
            {media.status === "unwatched" ? "Not Watched" : media.status}
          </span>
        )}
        {media.rating && (
          <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-500 text-[10px] font-bold px-1.5 py-0.5 rounded">
            <Star size={10} className="fill-current" /> {media.rating}
          </span>
        )}
        {media.review_notes && (
          <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded">
            <MessageSquare size={10} />
          </span>
        )}
      </div>

      {/* Unsaved badge + Remove / just Remove */}
      <div className="shrink-0 flex items-center gap-1">
        {isUnsaved && (
          <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase bg-violet-500/90 text-white">
            Unsaved
          </span>
        )}
        {onRemove && (
          <button
            type="button"
            data-no-nav
            onClick={() => onRemove(media.id)}
            className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
            aria-label="Remove from collection"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Tile item ──

function SortableTileItem({
  media,
  onRemove,
  isUnsaved,
}: {
  media: Media;
  onRemove?: (id: string) => void;
  isUnsaved?: boolean;
}) {
  const router = useRouter();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: media.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 20 : 0,
  };

  const posterUrl = media.poster_path
    ? `${TMDB_POSTER_MD}${media.poster_path}`
    : null;

  const year = media.release_date
    ? new Date(media.release_date).getFullYear()
    : undefined;

  const mediaUrl =
    media.type === "movie"
      ? ROUTES.MEDIA_MOVIE(media.tmdb_id!)
      : ROUTES.MEDIA_TV(media.tmdb_id!);

  function handleClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("[data-no-nav]")) return;
    router.push(mediaUrl);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      className="group rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden cursor-pointer"
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] bg-zinc-100 dark:bg-zinc-800">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={media.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-400 dark:text-zinc-600">
            {media.type === "movie" ? <Film size={36} /> : <Tv size={36} />}
          </div>
        )}

        {/* Drag handle (bottom-right) */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          data-no-nav
          className="absolute bottom-1 right-1 p-1 rounded bg-black/50 text-white/80 hover:text-white cursor-grab active:cursor-grabbing touch-none opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Drag to reorder"
        >
          <GripVertical size={12} />
        </button>

        {/* Status badge (top-left) */}
        {isUnsaved ? (
          <span className="absolute top-2 left-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase shadow-sm bg-violet-500/90 text-white">
            Unsaved
          </span>
        ) : (
          <span
            className={`absolute top-2 left-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase shadow-sm ${statusColors[media.status]}`}
          >
            {media.status === "unwatched" ? "Not Watched" : media.status}
          </span>
        )}

        {/* Remove button (top-right) */}
        {onRemove && (
          <button
            type="button"
            data-no-nav
            onClick={() => onRemove(media.id)}
            className="absolute top-1 right-1 p-1 rounded bg-black/50 text-white/80 hover:text-red-400 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Remove from collection"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5">
        <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
          {media.title}
        </h4>
        <div className="flex items-center gap-1.5 mt-0.5">
          {year && (
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{year}</span>
          )}
        </div>
        {/* Rating + Comment pills — matching episode tile layout */}
        <div className="flex items-center gap-2 mt-2 min-h-[22px]">
          {media.rating && (
            <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-500 text-[10px] font-bold px-1.5 py-0.5 rounded">
              <Star size={10} className="fill-current" /> {media.rating}
            </span>
          )}
          {media.review_notes && (
            <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded">
              <MessageSquare size={10} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ──

export default function CollectionDetailPage({
  collectionId,
}: CollectionDetailPageProps) {
  const router = useRouter();
  const [allMedia, setAllMedia] = useState<Media[]>([]);
  const [collection, setCollection] = useState<MediaCollection | null>(null);
  const [viewMode, setViewMode] = useState<"detail" | "tile">("detail");

  // Inline editing state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#8B5CF6");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // ── Local staging state ──
  const [pendingAdds, setPendingAdds] = useState<Media[]>([]);
  const [pendingRemoves, setPendingRemoves] = useState<Set<string>>(new Set());
  const [originalOrder, setOriginalOrder] = useState<string[]>([]);
  const [displayOrder, setDisplayOrder] = useState<string[]>([]);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
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

  // Reset staging if collectionId changes (navigating to a different collection)
  useEffect(() => {
    dataLoadedRef.current = false;
    setPendingAdds([]);
    setPendingRemoves(new Set());
    setDisplayOrder([]);
    setOriginalOrder([]);
  }, [collectionId]);

  // ── Derived data ──

  // Effective items: DB items minus pending removes, plus pending adds
  const effectiveItems = useMemo(() => {
    const dbItems = rawItems.filter((m) => !pendingRemoves.has(m.id));
    const combined = [...dbItems, ...pendingAdds];
    // Deduplicate by ID (in case pendingAdds references a tracked media whose real ID
    // is also in rawItems — shouldn't happen due to alreadyInCollection check, but be safe)
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

  const dndKey = useMemo(
    () => orderedMedia.map((m) => m.id).join(","),
    [orderedMedia],
  );

  const progress = useMemo(() => computeProgress(effectiveItems), [effectiveItems]);

  // ── isDirty ──

  const isMetadataDirty =
    name !== (collection?.name ?? "") ||
    description !== (collection?.description ?? "") ||
    color !== (collection?.color ?? "#8B5CF6");

  const isMediaDirty = pendingAdds.length > 0 || pendingRemoves.size > 0;

  const isOrderDirty = useMemo(() => {
    if (pendingAdds.length > 0 || pendingRemoves.size > 0) return false; // covered by isMediaDirty
    // Compare current displayOrder against originalOrder (same IDs, different sequence?)
    if (displayOrder.length !== originalOrder.length) return true;
    return displayOrder.some((id, i) => originalOrder[i] !== id);
  }, [displayOrder, originalOrder, pendingAdds.length, pendingRemoves.size]);

  const isDirty = isMetadataDirty || isMediaDirty || isOrderDirty;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  // ── Drag (local only — persisted on Save) ──

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setDisplayOrder((prev) => {
      const oldIndex = prev.indexOf(String(active.id));
      const newIndex = prev.indexOf(String(over.id));
      return arrayMove([...prev], oldIndex, newIndex);
    });
  }, []);

  // ── Add title (local stage — not persisted until Save) ──

  function handleAddTitle(item: TmdbSearchResult) {
    if (!collection) return;

    // Prevent duplicate in this collection (check effective items)
    const alreadyInCollection = effectiveItems.some(
      (m) =>
        m.tmdb_id === item.tmdb_id &&
        m.type === item.type,
    );
    if (alreadyInCollection) return;

    // If the item was previously removed, un-remove it instead of duplicating
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
      // Ensure it's in displayOrder
      setDisplayOrder((prev) => {
        if (!prev.includes(previouslyRemoved.id)) {
          return [...prev, previouslyRemoved.id];
        }
        return prev;
      });
      return;
    }

    // Check if already tracked in allMedia
    const existing = findDuplicate(item.tmdb_id, item.type, allMedia);

    if (existing) {
      // Use existing media's real ID (will be linked to collection on save)
      setPendingAdds((prev) => [...prev, { ...existing }]);
      setDisplayOrder((prev) => [...prev, existing.id]);
    } else {
      // Create temp media record (will be created + linked on save)
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
    // If it's a pending add, just remove it entirely
    if (pendingAdds.some((m) => m.id === id)) {
      setPendingAdds((prev) => prev.filter((m) => m.id !== id));
      setDisplayOrder((prev) => prev.filter((oid) => oid !== id));
    } else {
      // Otherwise move to pendingRemoves and remove from displayOrder
      setPendingRemoves((prev) => new Set([...prev, id]));
      setDisplayOrder((prev) => prev.filter((oid) => oid !== id));
    }
  }

  // ── Persist all staged changes ──

  async function handleSaveAll() {
    if (!userId || !collection) return;
    if (!name.trim()) {
      setName(collection.name ?? "Untitled");
      return;
    }
    setSaving(true);
    try {
      // 1. Process pendingRemoves: unlink each from collection
      for (const removeId of pendingRemoves) {
        const mediaRecord = allMedia.find((m) => m.id === removeId);
        if (mediaRecord) {
          // Merge legacy collection_id + collection_ids, then filter
          const allColIds = mediaRecord.collection_id
            ? [...(mediaRecord.collection_ids ?? []), mediaRecord.collection_id]
            : (mediaRecord.collection_ids ?? []);
          const updatedIds = allColIds.filter((cid) => cid !== collectionId);
          await updateMedia(userId, removeId, { collection_ids: updatedIds });
        }
      }

      // 2. Process pendingAdds: create new or link existing
      const newMediaIds: string[] = [];
      for (const pendingItem of pendingAdds) {
        const isTemp = pendingItem.id.startsWith("pending-");

        if (isTemp) {
          // Create new media record
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
          // Link existing tracked media to this collection
          // Merge legacy collection_id + collection_ids
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

      // 3. Build final ordered_media_ids
      //    Replace temp IDs in displayOrder with the real IDs created above
      const tempToReal = new Map<string, string>();
      let tempIdx = 0;
      for (const pendingItem of pendingAdds) {
        if (pendingItem.id.startsWith("pending-")) {
          tempToReal.set(pendingItem.id, newMediaIds[tempIdx] ?? pendingItem.id);
        }
        tempIdx++;
      }

      // Start with original DB items, filter out pendingRemoves
      const baseIds = (collection.ordered_media_ids ?? []).filter(
        (id) => !pendingRemoves.has(id),
      );
      // Replace temp IDs with real IDs, keep non-temp IDs
      const resolvedIds = displayOrder.map((id) => tempToReal.get(id) ?? id);

      // 4. Update collection metadata + order
      const updated = await updateCollection(userId, collectionId, {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        ordered_media_ids: resolvedIds,
      });
      setCollection(updated);

      // 5. Clear staging
      setPendingAdds([]);
      setPendingRemoves(new Set());
      setOriginalOrder(resolvedIds);
      setDisplayOrder(resolvedIds);

      // 6. Refresh all media to get real records
      const media = await listMedia(userId);
      setAllMedia(media);
    } catch (err) {
      console.error("Failed to save collection:", err);
    } finally {
      setSaving(false);
    }
  }

  // ── Navigation guards ──

  function handleCancel() {
    if (isDirty) {
      setShowUnsavedDialog(true);
      return;
    }
    doCancel();
  }

  function doCancel() {
    if (!collection) {
      router.push(`${ROUTES.MEDIA}?tab=manager`);
      return;
    }
    // Revert metadata
    setName(collection.name ?? "");
    setDescription(collection.description ?? "");
    setColor(collection.color ?? "#8B5CF6");
    // Revert media staging
    setPendingAdds([]);
    setPendingRemoves(new Set());
    setDisplayOrder([...originalOrder]);
  }

  function handleBackClick() {
    if (isDirty) {
      setShowUnsavedDialog(true);
      return;
    }
    router.push(ROUTES.MEDIA);
  }

  function handleDiscardAndNavigate() {
    doCancel();
    setShowUnsavedDialog(false);
    router.push(ROUTES.MEDIA);
  }

  // ── Delete ──

  async function handleDelete() {
    if (!userId) return;
    setDeleting(true);
    try {
      await deleteCollection(userId, collectionId);
      router.push(`${ROUTES.MEDIA}?tab=manager`);
    } catch (err) {
      console.error("Failed to delete collection:", err);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  const itemCount = effectiveItems.length;
  const themeStyles = getThemeStyles(color);

  // Last 5 themes keep their dedicated panel styling; all others use card styling
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

          {/* Column 2: Color picker + Progress */}
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
            {/* Header & Toggle */}
            <div
              className="flex items-center justify-between mb-6 border-b pb-4"
              style={{ borderBottomColor: `${themeStyles.solidColor}40` }}
            >
              <div className="flex items-center gap-4">
                <h2 className={`text-lg ${themeStyles.titleClass}`} style={themeStyles.titleStyle}>
                  Titles in Collection
                </h2>
              </div>
              <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setViewMode("detail")}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === "detail"
                      ? "bg-white dark:bg-zinc-700 shadow-sm text-violet-600 dark:text-violet-400"
                      : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                    }`}
                  aria-label="Detail view"
                >
                  <List size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("tile")}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === "tile"
                      ? "bg-white dark:bg-zinc-700 shadow-sm text-violet-600 dark:text-violet-400"
                      : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                    }`}
                  aria-label="Tile view"
                >
                  <LayoutGrid size={16} />
                </button>
              </div>
            </div>

            {/* Media content — lifted above gem-tile pseudo-elements */}
            {orderedMedia.length === 0 ? (
              <div className={`relative z-[3] ${viewMode === "detail" ? "flex flex-col gap-3" : "grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3"}`}>
                <AddMediaTile viewMode={viewMode} onClick={() => setIsAddModalOpen(true)} />
              </div>
            ) : (
              <>
                <DndContext
                  key={dndKey}
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={displayOrder}
                    strategy={
                      viewMode === "detail"
                        ? verticalListSortingStrategy
                        : rectSortingStrategy
                    }
                  >
                    {viewMode === "detail" ? (
                      <div className="relative z-[3] flex flex-col gap-3">
                        {orderedMedia.map((m) => (
                          <SortableDetailItem
                            key={m.id}
                            media={m}
                            onRemove={handleRemoveItem}
                            isUnsaved={pendingAdds.some((p) => p.id === m.id)}
                          />
                        ))}
                        <AddMediaTile viewMode={viewMode} onClick={() => setIsAddModalOpen(true)} />
                      </div>
                    ) : (
                      <div className="relative z-[3] grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
                        {orderedMedia.map((m) => (
                          <SortableTileItem
                            key={m.id}
                            media={m}
                            onRemove={handleRemoveItem}
                            isUnsaved={pendingAdds.some((p) => p.id === m.id)}
                          />
                        ))}
                        <AddMediaTile viewMode={viewMode} onClick={() => setIsAddModalOpen(true)} />
                      </div>
                    )}
                  </SortableContext>
                </DndContext>
              </>
            )}
          </div>
        )}

        {isLoading && (
          <p className="py-8 text-center text-sm text-zinc-500">
            Loading collection…
          </p>
        )}

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </p>
        )}

        {/* ── Unified Bottom Action Bar (matches GlobalActionModal footer) ── */}
        {!isLoading && !error && (
          <>
            {showDeleteConfirm && (
              <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/60 dark:bg-red-950/30">
                <span className="text-xs text-red-700 dark:text-red-400 flex-1">
                  This collection will be deleted, but it will not affect your ratings, reviews, or watched data on the individual movies and shows.
                </span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Confirm Delete"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            )}
            <div
              className="shrink-0 flex justify-end gap-2 border-t px-4 py-3"
              style={{ borderTopColor: `${themeStyles.solidColor}40` }}
            >
              <Button
                variant="danger"
                size="md"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={saving || deleting}
              >
                Delete
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={handleCancel}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleSaveAll}
                disabled={saving || !isDirty}
              >
                {saving ? "Saving…" : isDirty ? "Save *" : "Save"}
              </Button>
            </div>
          </>
        )}

        <TmdbAttribution />
      </div>

      <AddMediaModal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddTitle}
        allMedia={allMedia}
      />

      {/* ── Unsaved Changes Dialog ── */}
      {showUnsavedDialog && (
        <ConfirmDialog
          title="Discard unsaved changes?"
          description="You have unsaved changes to this collection. Discarding will revert all additions, removals, reordering, and metadata edits."
          confirmLabel="Discard"
          cancelLabel="Keep Editing"
          onConfirm={handleDiscardAndNavigate}
          onCancel={() => setShowUnsavedDialog(false)}
        />
      )}
    </>
  );
}
