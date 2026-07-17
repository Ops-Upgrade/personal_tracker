"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ROUTES } from "@/routes/paths";
import BackButton from "@/components/common/BackButton";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/taskmanager/ConfirmDialog";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
import { createCollection, createMedia, findDuplicate, listMedia, getMediaDetails } from "@/api/media";
import type { Media, TmdbSearchResult } from "@/types/media";
import ThemePicker from "@/components/media/modals/ThemePicker";
import AddMediaModal from "@/components/media/modals/AddMediaModal";
import AddMediaTile from "@/components/media/views/AddMediaTile";
import { getThemeStyles } from "@/lib/collectionThemes";
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
import Image from "next/image";

const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w92";
const TMDB_POSTER_MD = "https://image.tmdb.org/t/p/w342";
const DEFAULT_COLOR = "#8B5CF6";

const statusColors: Record<Media["status"], string> = {
  unwatched: "bg-red-500/90 text-white",
  watching: "bg-yellow-500/90 text-white",
  watched: "bg-green-600/90 text-white",
};

/** Estimate runtime for progress bar — TMDB search results don't include runtime. */
function estimateRuntime(item: TmdbSearchResult): number {
  return item.type === "movie" ? 120 : 450; // 2h movie, ~10 episodes × 45min for TV
}

/** Compute progress from local items. */
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

// ── Detail item (list view) ──

function SortableDetailItem({
  media,
  onRemove,
}: {
  media: Media;
  onRemove: (id: string) => void;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: media.id });

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

      <div className="relative w-10 h-[60px] shrink-0 rounded-md overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        {posterUrl ? (
          <Image src={posterUrl} alt={media.title} fill sizes="40px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-[8px] text-zinc-400">N/A</div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
          {media.title}
        </h4>
        <div className="flex items-center gap-2 mt-0.5">
          {year && <span className="text-xs text-zinc-500 dark:text-zinc-400">{year}</span>}
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

      {/* Unsaved badge + Remove */}
      <div className="shrink-0 flex items-center gap-1">
        <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase bg-violet-500/90 text-white">
          Unsaved
        </span>
        <button
          type="button"
          data-no-nav
          onClick={() => onRemove(media.id)}
          className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
          aria-label="Remove"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Tile item ──

function SortableTileItem({
  media,
  onRemove,
}: {
  media: Media;
  onRemove: (id: string) => void;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: media.id });

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
      <div className="relative aspect-[2/3] bg-zinc-100 dark:bg-zinc-800">
        {posterUrl ? (
          <Image src={posterUrl} alt={media.title} fill sizes="(max-width: 640px) 50vw, 20vw" className="object-cover" />
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
        {/* Unsaved badge (top-left) */}
        <span className="absolute top-2 left-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase shadow-sm bg-violet-500/90 text-white">
          Unsaved
        </span>
        {/* Remove button (top-right) */}
        <button
          type="button"
          data-no-nav
          onClick={() => onRemove(media.id)}
          className="absolute top-1 right-1 p-1 rounded bg-black/50 text-white/80 hover:text-red-400 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Remove"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <div className="p-2.5">
        <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
          {media.title}
        </h4>
        <div className="flex items-center gap-1.5 mt-0.5">
          {year && <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{year}</span>}
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

export default function NewCollectionPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"detail" | "tile">("detail");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [trackedMedia, setTrackedMedia] = useState<Media[]>([]);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setDisplayOrder((prev) => {
      const oldIndex = prev.indexOf(String(active.id));
      const newIndex = prev.indexOf(String(over.id));
      return arrayMove([...prev], oldIndex, newIndex);
    });
  }, []);

  const orderedItems = useMemo(() => {
    const idToItem = new Map(localItems.map((m) => [m.id, m]));
    return displayOrder.map((id) => idToItem.get(id)).filter(Boolean) as Media[];
  }, [localItems, displayOrder]);

  const isDirty =
    name.trim() !== "" ||
    description.trim() !== "" ||
    color !== DEFAULT_COLOR ||
    localItems.length > 0;

  // ── Navigation guards ──

  function handleCancel() {
    if (isDirty) {
      setShowUnsavedDialog(true);
      return;
    }
    router.push(`${ROUTES.MEDIA}?tab=manager`);
  }

  function handleBackClick() {
    if (isDirty) {
      setShowUnsavedDialog(true);
      return;
    }
    router.back();
  }

  function handleDiscardAndNavigate() {
    setShowUnsavedDialog(false);
    router.push(`${ROUTES.MEDIA}?tab=manager`);
  }

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

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </p>
      )}

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
          <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setViewMode("detail")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "detail"
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
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "tile"
                  ? "bg-white dark:bg-zinc-700 shadow-sm text-violet-600 dark:text-violet-400"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
              }`}
              aria-label="Tile view"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>

        {localItems.length === 0 ? (
          <div className={viewMode === "detail" ? "flex flex-col gap-3" : "grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3"}>
            <AddMediaTile viewMode={viewMode} onClick={() => setIsAddModalOpen(true)} />
          </div>
        ) : (
          <>
            <DndContext
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
                  <div className="flex flex-col gap-3">
                    {orderedItems.map((m) => (
                      <SortableDetailItem
                        key={m.id}
                        media={m}
                        onRemove={handleRemoveItem}
                      />
                    ))}
                    <AddMediaTile viewMode={viewMode} onClick={() => setIsAddModalOpen(true)} />
                  </div>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
                    {orderedItems.map((m) => (
                      <SortableTileItem
                        key={m.id}
                        media={m}
                        onRemove={handleRemoveItem}
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
          onCancel={() => setShowUnsavedDialog(false)}
        />
      )}
    </div>
  );
}
