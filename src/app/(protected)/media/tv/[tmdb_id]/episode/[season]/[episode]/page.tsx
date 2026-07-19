"use client";

import { use, useCallback, useState } from "react";
import EpisodePage from "@/components/media/pages/EpisodePage";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
import { listMedia } from "@/api/media";
import type { Media } from "@/types/media";

export default function EpisodeRoute({
  params,
}: {
  params: Promise<{
    tmdb_id: string;
    season: string;
    episode: string;
  }>;
}) {
  const { tmdb_id, season, episode } = use(params);
  const tmdbId = Number(tmdb_id);
  const seasonNumber = Number(season);
  const episodeNumber = Number(episode);

  const [, setAllMedia] = useState<Media[]>([]);

  const loadData = useCallback(async (uid: string) => {
    // Just need to bootstrap user; media loading happens inside EpisodePage
    const media = await listMedia(uid);
    setAllMedia(media);
  }, []);

  const { userId, userName, userAvatarUrl, isLoading } = useAuthBootstrap({
    loadData,
    fetchServerDate: false,
  });

  if (isLoading || !userId) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        Loading…
      </p>
    );
  }

  return (
    <EpisodePage
      tmdbId={tmdbId}
      seasonNumber={seasonNumber}
      episodeNumber={episodeNumber}
      userId={userId}
      userName={userName}
      userAvatarUrl={userAvatarUrl}
    />
  );
}
