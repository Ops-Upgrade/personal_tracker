import { createClient } from "@/lib/supabase/client";
import { encryptField, decryptField } from "@/lib/crypto";
import type { Media, MediaPlaintext, EpisodeTracking } from "@/types/media";

// ── In-memory session cache ──
// Because tmdb_id lives inside an encrypted blob, Supabase cannot filter by it.
// We cache the full decrypted list once per session so that detail pages
// (MoviePage, TvSeriesPage, EpisodePage) can look up a single item without
// re-fetching and re-decrypting the entire library on every navigation.

let cachedMedia: Media[] | null = null;
let cacheUserId: string | null = null;

/** Drop the in-memory cache (call on logout / user switch). */
export function clearMediaCache(): void {
  cachedMedia = null;
  cacheUserId = null;
}

/**
 * Fetch all media rows for a user, decrypt each, and return hydrated Media[].
 *
 * Cached per userId — subsequent calls in the same session return instantly.
 * Mutations (create / update / delete) maintain the cache so it stays fresh.
 */
export async function listMedia(userId: string): Promise<Media[]> {
  // Return cached result if the same user asks again
  if (cachedMedia !== null && cacheUserId === userId) {
    return cachedMedia;
  }

  const supabase = createClient();
  const { data: rows, error } = await supabase
    .from("media")
    .select("id, user_id, iv, data, created_at")
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to fetch media: ${error.message}`);
  if (!rows || rows.length === 0) {
    cachedMedia = [];
    cacheUserId = userId;
    return [];
  }

  const allParsed = await Promise.all(
    rows.map(async (row) => {
      const plaintext = await decryptField(userId, row.iv, row.data);
      const raw = JSON.parse(plaintext);
      const parsed: MediaPlaintext = {
        type: raw.type,
        title: raw.title,
        status: raw.status ?? "unwatched",
        ...raw,
      };
      return { id: row.id, created_at: row.created_at, ...parsed };
    }),
  );

  // In-memory deduplication — keep the FIRST occurrence of each tmdb_id+type pair.
  // Duplicates can arise from race-condition creates. We filter them out here
  // so the UI never sees duplicates, but we do NOT run destructive DELETE
  // operations in the read path. Call `cleanupDuplicateMedia()` explicitly
  // when you want to purge duplicate rows from the database.
  const unique: Media[] = [];
  const seen = new Set<string>();

  for (const m of allParsed) {
    const key = `${m.type}-${m.tmdb_id}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(m);
    }
  }

  cachedMedia = unique;
  cacheUserId = userId;
  return unique;
}

/**
 * Look up a single tracked media item by its TMDB id + type.
 *
 * Uses the in-memory cache (warming it via `listMedia` on first call)
 * so detail pages don't fetch + decrypt the entire library.
 */
export async function getMediaByTmdbId(
  userId: string,
  tmdbId: number,
  type: "movie" | "tv",
): Promise<Media | undefined> {
  const all = await listMedia(userId); // hits cache after first warm
  return all.find((m) => m.tmdb_id === tmdbId && m.type === type);
}

/**
 * Scan the user's media library for duplicate rows (same tmdb_id + type) and
 * delete the extras, keeping the oldest row for each pair.
 *
 * This is intentionally NOT called in the read path — call it from an
 * initialization routine, a settings page, or on-demand via a button.
 */
export async function cleanupDuplicateMedia(userId: string): Promise<number> {
  const supabase = createClient();
  const { data: rows, error } = await supabase
    .from("media")
    .select("id, user_id, iv, data, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to fetch media for cleanup: ${error.message}`);
  if (!rows || rows.length <= 1) return 0;

  // Decrypt all rows to read tmdb_id + type
  const decrypted = await Promise.all(
    rows.map(async (row) => {
      const plaintext = await decryptField(userId, row.iv, row.data);
      const raw = JSON.parse(plaintext);
      return { id: row.id, tmdb_id: raw.tmdb_id as number, type: raw.type as string };
    }),
  );

  const seen = new Set<string>();
  const toDelete: string[] = [];

  for (const item of decrypted) {
    const key = `${item.type}-${item.tmdb_id}`;
    if (seen.has(key)) {
      toDelete.push(item.id);
    } else {
      seen.add(key);
    }
  }

  // Delete duplicates (oldest row is kept — it was encountered first)
  for (const id of toDelete) {
    await supabase.from("media").delete().eq("id", id);
  }

  // Invalidate cache so the next read picks up the cleaned state
  clearMediaCache();

  return toDelete.length;
}

/**
 * Create a new media row. Encrypts the plaintext blob before inserting.
 */
export async function createMedia(
  userId: string,
  input: MediaPlaintext
): Promise<Media> {
  const supabase = createClient();
  const encrypted = await encryptField(userId, JSON.stringify(input));

  const { data, error } = await supabase
    .from("media")
    .insert({
      user_id: userId,
      iv: encrypted.iv,
      data: encrypted.ciphertext,
    })
    .select("id, created_at")
    .single();

  if (error) throw new Error(`Failed to create media: ${error.message}`);

  const created: Media = { id: data.id, created_at: data.created_at, ...input };

  // Maintain cache — create a new array reference so React detects the change
  if (cachedMedia !== null && cacheUserId === userId) {
    cachedMedia = [...cachedMedia, created];
  }

  return created;
}

/**
 * Update an existing media row. Re-encrypts the full blob with a new IV.
 */
export async function updateMedia(
  userId: string,
  id: string,
  patch: Partial<MediaPlaintext>
): Promise<Media> {
  const supabase = createClient();

  // Fetch current row to merge
  const { data: current, error: fetchErr } = await supabase
    .from("media")
    .select("id, iv, data, created_at")
    .eq("id", id)
    .single();

  if (fetchErr || !current) {
    throw new Error(`Failed to fetch media for update: ${fetchErr?.message ?? "not found"}`);
  }

  const plaintext = await decryptField(userId, current.iv, current.data);
  const existing = JSON.parse(plaintext) as MediaPlaintext;
  const merged: MediaPlaintext = { ...existing, ...patch };
  const encrypted = await encryptField(userId, JSON.stringify(merged));

  const { data, error } = await supabase
    .from("media")
    .update({ iv: encrypted.iv, data: encrypted.ciphertext })
    .eq("id", id)
    .select("id, created_at")
    .single();

  if (error) throw new Error(`Failed to update media: ${error.message}`);

  const updated: Media = { id: data.id, created_at: data.created_at, ...merged };

  // Maintain cache — replace stale entry with a new array reference
  if (cachedMedia !== null && cacheUserId === userId) {
    cachedMedia = cachedMedia.map((m) => (m.id === id ? updated : m));
  }

  return updated;
}

/**
 * Permanently delete a media row by ID.
 * This is the ONLY entry point for removing tracked items.
 */
export async function deleteMedia(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("media").delete().eq("id", id);

  if (error) throw new Error(`Failed to delete media: ${error.message}`);

  // Maintain cache — remove deleted entry
  if (cachedMedia !== null) {
    cachedMedia = cachedMedia.filter((m) => m.id !== id);
  }
}

/**
 * Check if a media item with the same tmdb_id + type already exists.
 * Pure helper — no network call.
 */
export function findDuplicate(
  tmdbId: number,
  type: "movie" | "tv",
  existing: Media[]
): Media | undefined {
  return existing.find((m) => m.tmdb_id === tmdbId && m.type === type);
}

/**
 * Batch-update all media rows linked to a collection to unlink them.
 * Checks both the legacy `collection_id` field and the newer `collection_ids` array.
 * Called by collection delete — never by media delete.
 */
export async function unlinkFromCollection(
  userId: string,
  collectionId: string,
  existing: Media[]
): Promise<void> {
  const linked = existing.filter(
    (m) =>
      m.collection_id === collectionId ||
      m.collection_ids?.includes(collectionId),
  );

  for (const media of linked) {
    const patch: Partial<MediaPlaintext> = {};

    // Clear legacy field if it matches
    if (media.collection_id === collectionId) {
      patch.collection_id = undefined;
    }

    // Remove from the array field
    if (media.collection_ids?.includes(collectionId)) {
      patch.collection_ids = media.collection_ids.filter(
        (id) => id !== collectionId,
      );
      // If the array is now empty, explicitly set to undefined to keep data clean
      if (patch.collection_ids.length === 0) {
        patch.collection_ids = undefined;
      }
    }

    await updateMedia(userId, media.id, patch);
  }
}

/**
 * Format a season + episode number into a zero-padded key (e.g. "S01E01").
 * Must be used at EVERY write site to prevent key format drift in the episodes map.
 */
export function formatEpisodeKey(season: number, episode: number): string {
  const s = String(season).padStart(2, "0");
  const e = String(episode).padStart(2, "0");
  return `S${s}E${e}`;
}

/**
 * Compute the parent show status from its episode map.
 * Returns null if no episodes are tracked (signals auto-untrack).
 *
 * PRODUCT DECISION: Auto-upgrading to "watched" strictly requires every episode
 * to be explicitly tracked in the DB. Sparse/lazy watchers (e.g. 1000 episode shows)
 * are expected to manually force the parent to "watched". Do not "fix" this.
 */
export function computeShowStatus(
  episodes: Record<string, EpisodeTracking>,
  totalEpisodeCount: number
): "watching" | "unwatched" | "watched" | null {
  const entries = Object.values(episodes);
  if (entries.length === 0) return null;

  const hasWatchedOrWatching = entries.some(
    (ep) => ep.status === "watched" || ep.status === "watching"
  );
  // "watched" only when every episode in the season is explicitly marked watched
  if (entries.length >= totalEpisodeCount && entries.every((ep) => ep.status === "watched")) {
    return "watched";
  }
  // "unwatched" when all explicitly-touched episodes are unwatched and none are watched
  if (entries.every((ep) => ep.status === "unwatched") && !hasWatchedOrWatching) {
    return "unwatched";
  }
  // Any mix
  return "watching";
}

/**
 * Calculate the effective display status for an episode, distinguishing
 * explicit DB records from virtual projections inherited from the parent show.
 *
 * - If the episode has its own tracked status → real (isVirtual: false)
 * - If parent is "watched" and no episode record → virtual "watched"
 * - Otherwise → virtual "unwatched" (covers "unwatched", "watching", and
 *   undefined parent states where no episode record exists)
 */
export function getEffectiveEpisodeStatus(
  parentStatus?: string,
  epStatus?: string
): { status: string; isVirtual: boolean } {
  if (epStatus) return { status: epStatus, isVirtual: false };
  if (parentStatus === "watched") return { status: "watched", isVirtual: true };
  return { status: "unwatched", isVirtual: true };
}
