"use client";

import { useCallback, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ROUTES } from "@/routes/paths";
import BackButton from "@/components/common/BackButton";
import ErrorBanner from "@/components/common/ErrorBanner";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
import {
  listMedia,
  updateMedia,
  listCollections,
} from "@/api/media";
import type { Media, MediaCollection } from "@/types/media";
import DefaultView from "./views/DefaultView";
import CollectionView from "./views/CollectionView";
import DiscoverView from "./views/DiscoverView";
import TmdbAttribution from "./TmdbAttribution";

type TopTab = "manager" | "discover";
type SubTab = "default" | "collections";

export default function MediaView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "discover" ? "discover" : "manager";
  const [mediaItems, setMediaItems] = useState<Media[]>([]);
  const [collections, setCollections] = useState<MediaCollection[]>([]);
  const [activeTopTab, setActiveTopTab] = useState<TopTab>(initialTab);
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("default");

  // Sync tab if URL search param changes (e.g., from back navigation)
  useEffect(() => {
    setActiveTopTab(searchParams.get("tab") === "discover" ? "discover" : "manager");
  }, [searchParams]);

  const switchTopTab = useCallback((tab: TopTab) => {
    setActiveTopTab(tab);
    router.replace(`?tab=${tab}`, { scroll: false });
  }, [router]);

  const loadAllData = useCallback(async (uid: string) => {
    const [media, cols] = await Promise.all([
      listMedia(uid),
      listCollections(uid),
    ]);
    setMediaItems(media);
    setCollections(cols);
  }, []);

  const { userId, isLoading, error, refreshData } = useAuthBootstrap({
    loadData: loadAllData,
    fetchServerDate: false,
  });

  // --- Media actions ---

  async function handleStatusChange(id: string, status: Media["status"]) {
    if (!userId) return;
    try {
      await updateMedia(userId, id, { status });
      setMediaItems((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status } : m))
      );
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  }

  async function handleRatingChange(id: string, rating: number) {
    if (!userId) return;
    try {
      await updateMedia(userId, id, { rating: rating || undefined });
      setMediaItems((prev) =>
        prev.map((m) => (m.id === id ? { ...m, rating: rating || undefined } : m))
      );
    } catch (err) {
      console.error("Failed to update rating:", err);
    }
  }

  // --- Collection actions ---

  function handleNewCollection() {
    router.push("/media/collection/new_collection");
  }

  // --- Tab styles ---

  const headerTabClasses = (tab: TopTab) =>
    `text-2xl font-semibold transition-colors ${
      activeTopTab === tab
        ? "text-zinc-900 dark:text-zinc-100"
        : "text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 cursor-pointer"
    }`;

  const subTabClasses = (tab: SubTab) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      activeSubTab === tab
        ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
        : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
    }`;

  const title = activeTopTab === "discover" ? "Discovery" : "My Media";
  const subtitle =
    activeTopTab === "discover"
      ? "Search and browse movies and TV shows from TMDB."
      : "Track movies and TV shows with personal ratings and collections.";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col items-start gap-3">
        <BackButton href={ROUTES.DASHBOARD} />

        {/* Tab-based page title */}
        <div className="flex items-baseline gap-4 select-none">
          <button
            type="button"
            onClick={() => switchTopTab("manager")}
            className={headerTabClasses("manager")}
          >
            My Media
          </button>
          <span className="text-2xl font-light text-zinc-300 dark:text-zinc-600">|</span>
          <button
            type="button"
            onClick={() => switchTopTab("discover")}
            className={headerTabClasses("discover")}
          >
            Discovery
          </button>
        </div>

        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {subtitle}
        </p>
      </div>

      {/* Sub-tabs (only for Media Manager) */}
      {activeTopTab === "manager" && (
        <div className="flex gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveSubTab("default")}
            className={subTabClasses("default")}
          >
            Media
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("collections")}
            className={subTabClasses("collections")}
          >
            Collections
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Loading your library…
        </p>
      )}

      {/* Error */}
      {error && (
        <ErrorBanner
          message={error}
          onRetry={() => userId && refreshData(userId)}
        />
      )}

      {/* Tab content */}
      {!isLoading && !error && (
        <>
          {activeTopTab === "manager" && activeSubTab === "default" && (
            <DefaultView
              mediaItems={mediaItems}
              collections={collections}
              onStatusChange={handleStatusChange}
              onRatingChange={handleRatingChange}
            />
          )}
          {activeTopTab === "manager" && activeSubTab === "collections" && (
            <CollectionView
              collections={collections}
              mediaItems={mediaItems}
              onCreateCollection={handleNewCollection}
            />
          )}
          {activeTopTab === "discover" && <DiscoverView mediaItems={mediaItems} />}
        </>
      )}

      {/* TMDB attribution */}
      <TmdbAttribution />
    </div>
  );
}
