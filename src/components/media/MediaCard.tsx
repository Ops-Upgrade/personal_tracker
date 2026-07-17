"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Film, Tv, Star, MessageSquare } from "lucide-react";
import type { Media, MediaCollection } from "@/types/media";

const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w342";

const statusColors = {
  unwatched: "bg-red-500/90 text-white",
  watching: "bg-yellow-500/90 text-white",
  watched: "bg-green-600/90 text-white",
};

interface MediaCardProps {
  media: Media;
  collections: MediaCollection[];
  priority?: boolean;
  onStatusChange: (id: string, status: Media["status"]) => void;
  onRatingChange: (id: string, rating: number) => void;
}

export default function MediaCard({
  media,
  collections,
  priority = false,
  onStatusChange: _onStatusChange,
  onRatingChange: _onRatingChange,
}: MediaCardProps) {
  const router = useRouter();

  const posterUrl = media.poster_path
    ? `${TMDB_POSTER_BASE}${media.poster_path}`
    : null;

  const collectionName = media.collection_id
    ? collections.find((c) => c.id === media.collection_id)?.name
    : undefined;

  const year = media.release_date
    ? new Date(media.release_date).getFullYear()
    : undefined;

  const handleCardClick = () => {
    if (media.tmdb_id) {
      const prefix = media.type === "movie" ? "movie" : "tv";
      router.push(`/media/${prefix}/${media.tmdb_id}`);
    }
  };

  return (
    <div
      className="group rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden cursor-pointer"
      onClick={handleCardClick}
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
            priority={priority}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-400 dark:text-zinc-600">
            {media.type === "movie" ? (
              <Film size={40} />
            ) : (
              <Tv size={40} />
            )}
          </div>
        )}

        {/* Type badge (top-right) */}
        <span className="absolute top-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white uppercase">
          {media.type === "movie" ? "Movie" : "TV"}
        </span>

        {/* Status overlay (top-left) */}
        {media.status && (
          <span className={`absolute top-2 left-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase shadow-sm ${statusColors[media.status]}`}>
            {media.status === "unwatched" ? "Not Watched" : media.status}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
          {media.title}
        </h4>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 m-0">
            {[year, collectionName].filter(Boolean).join(" • ")}
          </p>
        </div>

        {/* Display chips (rating + review notes) */}
        {(media.rating || media.review_notes) && (
          <div className="flex items-center gap-2 mt-2">
            {media.rating ? (
              <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-500 text-[10px] font-bold px-1.5 py-0.5 rounded">
                <Star size={10} className="fill-current" /> {media.rating}
              </span>
            ) : null}
            {media.review_notes ? (
              <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded">
                <MessageSquare size={10} /> 1
              </span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
