"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/routes/paths";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Star,
  MessageSquare,
  Film,
  Tv,
  Trash2,
} from "lucide-react";
import type { Media } from "@/types/media";
import { tmdbPosterUrl } from "@/components/media/constants";
import StatusBadge from "@/components/media/shared/StatusBadge";

// ── Shared props ──

export interface SortableMediaItemProps {
  media: Media;
  /** When true, shows "Unsaved" badge instead of status badge. */
  isUnsaved?: boolean;
  /** When provided, shows a remove button. */
  onRemove?: (id: string) => void;
}

// ── Detail (list) item ──

export function SortableDetailItem({
  media,
  onRemove,
  isUnsaved,
}: SortableMediaItemProps) {
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
    ? tmdbPosterUrl(media.poster_path, "w92")
    : null;

  const year = media.release_date
    ? new Date(media.release_date).getFullYear()
    : undefined;

  const mediaUrl = ROUTES.MEDIA_DETAIL(media.tmdb_id!, media.type);

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

      <div className="absolute top-3 right-10 flex flex-col items-end gap-1.5">
        {!isUnsaved && <StatusBadge status={media.status} />}
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

export function SortableTileItem({
  media,
  onRemove,
  isUnsaved,
}: SortableMediaItemProps) {
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
    ? tmdbPosterUrl(media.poster_path, "w342")
    : null;

  const year = media.release_date
    ? new Date(media.release_date).getFullYear()
    : undefined;

  const mediaUrl = ROUTES.MEDIA_DETAIL(media.tmdb_id!, media.type);

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

        {isUnsaved ? (
          <span className="absolute top-2 left-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase shadow-sm bg-violet-500/90 text-white">
            Unsaved
          </span>
        ) : (
          <StatusBadge status={media.status} className="absolute top-2 left-2" />
        )}

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

      <div className="p-2.5">
        <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
          {media.title}
        </h4>
        <div className="flex items-center gap-1.5 mt-0.5">
          {year && (
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{year}</span>
          )}
        </div>
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
