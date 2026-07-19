"use client";

import { useCallback, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ROUTES } from "@/routes/paths";
import BackButton from "@/components/common/BackButton";
import ErrorBanner from "@/components/common/ErrorBanner";
import Toast from "@/components/media/shared/Toast";
import type { ToastType } from "@/components/media/shared/Toast";
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
  const [mediaItems, setMediaItems] = useState<Media[]>([]);
  const [collections, setCollections] = useState<MediaCollection[]>([]);

  // Tab state is derived from URL search params — the URL is the single source of truth.
  // switchTopTab / switchSubTab update the URL, which triggers a re-render with fresh searchParams.
  const activeTopTab: TopTab = searchParams.get("tab") === "discover" ? "discover" : "manager";
  const activeSubTab: SubTab = searchParams.get("subtab") === "collections" ? "collections" : "default";

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

  const switchTopTab = useCallback((tab: TopTab) => {
    const subtab = tab === "manager" ? activeSubTab : undefined;
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (subtab) params.set("subtab", subtab);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router, activeSubTab]);

  const switchSubTab = useCallback((subtab: SubTab) => {
    const params = new URLSearchParams();
    params.set("tab", activeTopTab);
    params.set("subtab", subtab);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router, activeTopTab]);

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
    } catch {
      triggerToast("Failed to update status. Please try again.", "error");
    }
  }

  async function handleRatingChange(id: string, rating: number) {
    if (!userId) return;
    try {
      await updateMedia(userId, id, { rating: rating || undefined });
      setMediaItems((prev) =>
        prev.map((m) => (m.id === id ? { ...m, rating: rating || undefined } : m))
      );
    } catch {
      triggerToast("Failed to update rating. Please try again.", "error");
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
            onClick={() => switchSubTab("default")}
            className={subTabClasses("default")}
          >
            Media
          </button>
          <button
            type="button"
            onClick={() => switchSubTab("collections")}
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

      <Toast
        isVisible={toastConfig.isVisible}
        message={toastConfig.message}
        type={toastConfig.type}
      />
    </div>
  );
}
