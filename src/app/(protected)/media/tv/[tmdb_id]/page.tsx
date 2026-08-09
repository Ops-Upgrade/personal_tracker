"use client";

import { use, useCallback, useState } from "react";
import TvSeriesPage from "@/components/media/pages/TvSeriesPage";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
import { listCollections } from "@/api/media";
import type { MediaCollection } from "@/types/media";

export default function TvRoute({
  params,
}: {
  params: Promise<{ tmdb_id: string }>;
}) {
  const { tmdb_id } = use(params);
  const tmdbId = Number(tmdb_id);
  const [collections, setCollections] = useState<MediaCollection[]>([]);

  const loadData = useCallback(async (uid: string) => {
    const cols = await listCollections(uid);
    setCollections(cols);
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
    <TvSeriesPage
      tmdbId={tmdbId}
      userId={userId}
      userName={userName}
      userAvatarUrl={userAvatarUrl}
      collections={collections}
    />
  );
}
