import { createClient } from "@/lib/supabase/client";
import { encryptField, decryptField } from "@/lib/crypto";
import type { Media, MediaPlaintext, EpisodeTracking } from "@/types/media";

/**
 * Fetch all media rows for a user, decrypt each, and return hydrated Media[].
 */
export async function listMedia(userId: string): Promise<Media[]> {
  const supabase = createClient();
  const { data: rows, error } = await supabase
    .from("media")
    .select("id, user_id, iv, data, created_at")
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to fetch media: ${error.message}`);
  if (!rows || rows.length === 0) return [];

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

  // Self-healing deduplication — deletes duplicate rows caused by race-condition creates
  const unique: Media[] = [];
  const seen = new Set<string>();

  for (const m of allParsed) {
    const key = `${m.type}-${m.tmdb_id}`;
    if (seen.has(key)) {
      // Duplicate from a race condition — delete the extra row
      await deleteMedia(m.id).catch(console.error);
    } else {
      seen.add(key);
      unique.push(m);
    }
  }

  return unique;
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

  return { id: data.id, created_at: data.created_at, ...input };
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

  return { id: data.id, created_at: data.created_at, ...merged };
}

/**
 * Permanently delete a media row by ID.
 * This is the ONLY entry point for removing tracked items.
 */
export async function deleteMedia(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("media").delete().eq("id", id);

  if (error) throw new Error(`Failed to delete media: ${error.message}`);
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
 * Batch-update all media rows linked to a collection to unlink them (collection_id → null).
 * Called by collection delete — never by media delete.
 */
export async function unlinkFromCollection(
  userId: string,
  collectionId: string,
  existing: Media[]
): Promise<void> {
  const linked = existing.filter((m) => m.collection_id === collectionId);
  for (const media of linked) {
    await updateMedia(userId, media.id, { collection_id: undefined });
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
