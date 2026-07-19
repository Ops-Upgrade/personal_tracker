import type { Media } from "@/types/media";

/**
 * Compute progress (watched vs total runtime) for a collection of media items.
 *
 * Callers are responsible for pre-filtering items (e.g. by collection membership).
 * Items with "watching" status count as 50 % watched runtime.
 */
export function computeProgress(items: Media[]): {
  percent: number;
  totalMins: number;
  watchedMins: number;
} {
  if (!items || items.length === 0) {
    return { percent: 0, totalMins: 0, watchedMins: 0 };
  }

  let totalMins = 0;
  let watchedMins = 0;

  for (const item of items) {
    const rt = item.runtime || 0;
    totalMins += rt;
    if (item.status === "watched") watchedMins += rt;
    if (item.status === "watching") watchedMins += rt * 0.5;
  }

  const percent = totalMins === 0 ? 0 : Math.round((watchedMins / totalMins) * 100);
  return { percent, totalMins, watchedMins };
}

/**
 * Return media items that belong to a given collection.
 *
 * Checks both {@link Media.collection_id} (single) and
 * {@link Media.collection_ids} (multi) so that all association
 * patterns are covered.
 */
export function getCollectionItems(
  collectionId: string,
  allMedia: Media[],
): Media[] {
  return allMedia.filter(
    (m) =>
      m.collection_ids?.includes(collectionId) ||
      m.collection_id === collectionId,
  );
}
