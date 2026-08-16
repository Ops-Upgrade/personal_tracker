import { getTestSession } from "./testSession";
import type { TestSession } from "./testSession";
import { getMediaByTmdbId, clearMediaCache } from "@/api/media";
import type { Media } from "@/types/media";

/**
 * Delete every `media` + `media_collections` row owned by the dummy test
 * user. The dummy user owns no production data, so wiping is safe — it only
 * ever removes scratch rows this test run created.
 *
 * Deletes go straight through the signed-in client (RLS confines them to
 * `auth.uid() = user_id`) — no decrypt/re-encrypt round-trips needed.
 */
export async function wipeTestUserData(session?: TestSession): Promise<void> {
  const { client, userId } = session ?? (await getTestSession());

  const { data: mediaRows, error: mediaErr } = await client
    .from("media")
    .select("id")
    .eq("user_id", userId);
  if (mediaErr) {
    throw new Error(`Test wipe failed reading media: ${mediaErr.message}`);
  }
  for (const row of mediaRows ?? []) {
    const { error } = await client.from("media").delete().eq("id", row.id);
    if (error) {
      throw new Error(`Test wipe failed deleting media ${row.id}: ${error.message}`);
    }
  }

  const { data: collectionRows, error: colErr } = await client
    .from("media_collections")
    .select("id")
    .eq("user_id", userId);
  if (colErr) {
    throw new Error(`Test wipe failed reading collections: ${colErr.message}`);
  }
  for (const row of collectionRows ?? []) {
    const { error } = await client
      .from("media_collections")
      .delete()
      .eq("id", row.id);
    if (error) {
      throw new Error(
        `Test wipe failed deleting collection ${row.id}: ${error.message}`,
      );
    }
  }
}

/**
 * Fresh DB read of one tracked media item: drops the in-memory media cache
 * first so the assertion exercises the actual stored blob, not the cached
 * hydration from a mutation call.
 */
export async function fetchFreshMedia(
  userId: string,
  tmdbId: number,
  type: "movie" | "tv",
): Promise<Media | undefined> {
  clearMediaCache();
  return getMediaByTmdbId(userId, tmdbId, type);
}
