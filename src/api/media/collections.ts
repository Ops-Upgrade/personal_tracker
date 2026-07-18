import { createClient } from "@/lib/supabase/client";
import { encryptField, decryptField } from "@/lib/crypto";
import type { MediaCollection, MediaCollectionPlaintext } from "@/types/media";
import { listMedia, unlinkFromCollection } from "./media";

/**
 * Fetch all collection rows for a user, decrypt each, and return hydrated MediaCollection[].
 */
export async function listCollections(
  userId: string
): Promise<MediaCollection[]> {
  const supabase = createClient();
  const { data: rows, error } = await supabase
    .from("media_collections")
    .select("id, user_id, iv, data, created_at")
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to fetch collections: ${error.message}`);
  if (!rows || rows.length === 0) return [];

  return Promise.all(
    rows.map(async (row) => {
      const plaintext = await decryptField(userId, row.iv, row.data);
      const raw = JSON.parse(plaintext);
      const parsed: MediaCollectionPlaintext = {
        name: raw.name,
        ...raw,
      };
      return { id: row.id, created_at: row.created_at, ...parsed };
    })
  );
}

/**
 * Create a new collection. Encrypts the plaintext blob before inserting.
 */
export async function createCollection(
  userId: string,
  input: { name: string; description?: string; color?: string; ordered_media_ids?: string[] }
): Promise<MediaCollection> {
  const supabase = createClient();
  const plaintext: MediaCollectionPlaintext = {
    ...input,
    ordered_media_ids: input.ordered_media_ids ?? [],
  };
  const encrypted = await encryptField(userId, JSON.stringify(plaintext));

  const { data, error } = await supabase
    .from("media_collections")
    .insert({
      user_id: userId,
      iv: encrypted.iv,
      data: encrypted.ciphertext,
    })
    .select("id, created_at")
    .single();

  if (error) throw new Error(`Failed to create collection: ${error.message}`);

  return { id: data.id, created_at: data.created_at, ...plaintext };
}

/**
 * Update an existing collection with any partial patch (name, color, description,
 * ordered_media_ids, etc.). Re-encrypts the full blob.
 */
export async function updateCollection(
  userId: string,
  id: string,
  patch: Partial<MediaCollectionPlaintext>
): Promise<MediaCollection> {
  const supabase = createClient();

  const { data: current, error: fetchErr } = await supabase
    .from("media_collections")
    .select("id, iv, data, created_at")
    .eq("id", id)
    .single();

  if (fetchErr || !current) {
    throw new Error(
      `Failed to fetch collection for update: ${fetchErr?.message ?? "not found"}`
    );
  }

  const plaintext = await decryptField(userId, current.iv, current.data);
  const existing = JSON.parse(plaintext) as MediaCollectionPlaintext;
  const merged: MediaCollectionPlaintext = { ...existing, ...patch };
  const encrypted = await encryptField(userId, JSON.stringify(merged));

  const { data, error } = await supabase
    .from("media_collections")
    .update({ iv: encrypted.iv, data: encrypted.ciphertext })
    .eq("id", id)
    .select("id, created_at")
    .single();

  if (error) throw new Error(`Failed to update collection: ${error.message}`);

  return { id: data.id, created_at: data.created_at, ...merged };
}

/**
 * Delete a collection AND unlink all its media (non-destructive).
 * Media rows are NOT deleted — their collection_id is set to null.
 */
export async function deleteCollection(
  userId: string,
  id: string
): Promise<void> {
  const supabase = createClient();

  // Unlink media first to avoid FK-by-convention orphans
  const allMedia = await listMedia(userId);
  await unlinkFromCollection(userId, id, allMedia);

  const { error } = await supabase
    .from("media_collections")
    .delete()
    .eq("id", id);

  if (error) throw new Error(`Failed to delete collection: ${error.message}`);
}
