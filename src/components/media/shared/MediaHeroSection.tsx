"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import type { TmdbDetails } from "@/types/media";
import { tmdbPosterUrl } from "@/components/media/constants";

interface MediaHeroSectionProps {
  posterPath?: string;
  typeLabel: string;
  title: string;
  year?: number | string;
  genres: { id: number; name: string }[];
  overview?: string;
  contentRating?: string;
  /** Runtime in minutes (movie only — displayed as e.g. "• 142m") */
  runtime?: number;
  watchProviders?: TmdbDetails["watch_providers"];
  /** Icon shown when no poster is available */
  fallbackIcon?: ReactNode;
}

/**
 * Hero section for media detail pages (Movie / TV Series).
 *
 * Displays the poster, type badge, title + year, genres, content rating,
 * runtime, overview, and streaming provider badges.
 *
 * Extracted from MoviePage and TvSeriesPage where it was duplicated.
 */
export default function MediaHeroSection({
  posterPath,
  typeLabel,
  title,
  year,
  genres,
  overview,
  contentRating,
  runtime,
  watchProviders,
  fallbackIcon,
}: MediaHeroSectionProps) {
  return (
    <div className="flex flex-col md:flex-row gap-8 mb-10">
      {/* Poster */}
      <div className="w-48 md:w-64 lg:w-72 shrink-0">
        <div className="aspect-[2/3] bg-zinc-100 dark:bg-zinc-800 rounded-xl overflow-hidden relative w-full">
          {posterPath ? (
            <Image
              src={tmdbPosterUrl(posterPath!, "w500")}
              alt={title}
              fill
              sizes="(max-width: 768px) 192px, (max-width: 1024px) 256px, 288px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-400 dark:text-zinc-600">
              {fallbackIcon}
            </div>
          )}
        </div>
      </div>

      {/* Text */}
      <div className="flex-1 flex flex-col justify-center space-y-6">
        <div>
          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 mb-2">
            {typeLabel}
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            {title} {year ? `(${year})` : ""}
          </h1>
          <div className="mt-3 flex items-center flex-wrap gap-2 text-base lg:text-lg font-medium text-zinc-500 dark:text-zinc-400">
            {contentRating && (
              <span className="px-1.5 py-0.5 rounded border border-zinc-400 dark:border-zinc-500 text-xs font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-300">
                {contentRating}
              </span>
            )}
            <span>{genres.map((g) => g.name).join(", ")}</span>
            {runtime ? <span>• {runtime}m</span> : null}
          </div>
        </div>

        {overview && (
          <p className="text-base lg:text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-4xl">
            {overview}
          </p>
        )}

        {watchProviders && (
          <div className="mt-6">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
              Streaming On
            </h3>
            {watchProviders.flatrate &&
            watchProviders.flatrate.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {watchProviders.flatrate.map((provider) => (
                  <div
                    key={provider.provider_id}
                    className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1.5 pr-3 shadow-sm border border-zinc-200 dark:border-zinc-700"
                  >
                    <Image
                      src={tmdbPosterUrl(provider.logo_path, "w92")}
                      alt={provider.provider_name}
                      width={32}
                      height={32}
                      className="rounded-md"
                    />
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      {provider.provider_name}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                Not available in India
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
