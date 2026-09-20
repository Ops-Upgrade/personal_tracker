import { createClient } from "@/lib/supabase/client";
import { encryptField, decryptField } from "@/lib/crypto";
import {
  emptyFlowBlock,
  type Page,
  type PagePlaintext,
  type PageContentPlaintext,
} from "@/types/notes";
import { deleteDocument, fetchDocuments, fetchDocumentsByDomain } from "@/api/common/documents";
import { deleteNoteImage } from "@/api/notes/noteStorage";

/**
 * Fetch all pages for a user, decrypt each row, and return hydrated Page[].
 */
export async function fetchPages(userId: string): Promise<Page[]> {
  const supabase = createClient();
  const { data: rows, error } = await supabase
    .from("notes_pages")
    .select("id, user_id, iv, data, created_at")
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to fetch pages: ${error.message}`);
  if (!rows || rows.length === 0) return [];

  const pages = await Promise.all(
    rows.map(async (row) => {
      const plaintextStr = await decryptField(userId, row.iv, row.data);
      const parsed: PagePlaintext = JSON.parse(plaintextStr);
      return { id: row.id, ...parsed };
    })
  );

  return pages.sort((a, b) => a.order - b.order);
}

/**
 * Garbage collect images no longer referenced by any page.
 * Candidate document IDs are checked against allPages.
 */
export async function gcPageImages(
  userId: string,
  candidateDocumentIds: string[],
  allPages: Page[]
): Promise<void> {
  if (candidateDocumentIds.length === 0) return;

  const usedImageIds = new Set<string>();
  for (const page of allPages) {
    if (page.image_ids) {
      for (const id of page.image_ids) {
        usedImageIds.add(id);
      }
    }
  }

  const orphanedIds = candidateDocumentIds.filter((id) => !usedImageIds.has(id));
  if (orphanedIds.length === 0) return;

  try {
    const userDocs = await fetchDocuments(userId);
    const docMap = new Map(userDocs.map((d) => [d.id, d]));

    await Promise.all(
      orphanedIds.map(async (docId) => {
        const doc = docMap.get(docId);
        if (doc?.file_name) {
          try {
            await deleteNoteImage(userId, doc.file_name);
          } catch {
            // Best effort cleanup
          }
        }
        await deleteDocument(docId);
      })
    );
  } catch (err) {
    console.error("Failed during image garbage collection:", err);
  }
}

/**
 * Create a new page. Inserts both notes_pages and an empty notes_page_content row.
 */
export async function createPage(
  userId: string,
  plaintext: PagePlaintext
): Promise<Page> {
  const supabase = createClient();
  const pageId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 11);

  const nowIso = new Date().toISOString();
  const pagePlaintextWithTimestamps: PagePlaintext = {
    ...plaintext,
    image_ids: plaintext.image_ids || [],
    tags: plaintext.tags || [],
    created_at: plaintext.created_at || nowIso,
    updated_at: plaintext.updated_at || nowIso,
  };

  const encryptedPage = await encryptField(
    userId,
    JSON.stringify(pagePlaintextWithTimestamps)
  );

  const initialContent: PageContentPlaintext = {
    page_id: pageId,
    revision: 0,
    sheet_w: 900,
    sheet_h: 1200,
    blocks: [emptyFlowBlock()],
    strokes: [],
    updated_at: nowIso,
  };
  const encryptedContent = await encryptField(
    userId,
    JSON.stringify(initialContent)
  );

  // 1. Insert notes_pages row
  const { error: pageError } = await supabase.from("notes_pages").insert({
    id: pageId,
    user_id: userId,
    iv: encryptedPage.iv,
    data: encryptedPage.ciphertext,
  });

  if (pageError) {
    throw new Error(`Failed to create page: ${pageError.message}`);
  }

  // 2. Insert notes_page_content row
  const { error: contentError } = await supabase
    .from("notes_page_content")
    .insert({
      id: pageId,
      user_id: userId,
      iv: encryptedContent.iv,
      data: encryptedContent.ciphertext,
      revision: 0,
    });

  if (contentError) {
    // If content creation fails, repair-on-read handles it when page is opened
    console.error("Failed to create initial page content row:", contentError.message);
  }

  return { id: pageId, ...pagePlaintextWithTimestamps };
}

/**
 * Metadata-only update (title, tags, order, image_ids, outbound_links).
 */
export async function updatePageMeta(
  userId: string,
  id: string,
  plaintext: PagePlaintext
): Promise<Page> {
  const supabase = createClient();
  const updatedPlaintext: PagePlaintext = {
    ...plaintext,
    updated_at: new Date().toISOString(),
  };

  const encrypted = await encryptField(
    userId,
    JSON.stringify(updatedPlaintext)
  );

  const { error } = await supabase
    .from("notes_pages")
    .update({ iv: encrypted.iv, data: encrypted.ciphertext })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to update page: ${error.message}`);
  }

  return { id, ...updatedPlaintext };
}

/**
 * Permanently delete a page by ID:
 * 1. Delete notes_page_content
 * 2. Delete notes_pages
 * 3. GC orphaned images
 */
export async function deletePage(userId: string, id: string): Promise<void> {
  const supabase = createClient();

  // Fetch page info to know candidate image IDs
  const allPages = await fetchPages(userId);
  const targetPage = allPages.find((p) => p.id === id);
  const linkedDocs = await fetchDocumentsByDomain(userId, "notes", id);
  const candidateImages = Array.from(
    new Set([...(targetPage?.image_ids || []), ...linkedDocs.map((d) => d.id)])
  );

  // Delete content row
  const { error: contentErr } = await supabase
    .from("notes_page_content")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (contentErr) {
    console.error("Failed to delete page content:", contentErr.message);
  }

  // Delete page row
  const { error: pageErr } = await supabase
    .from("notes_pages")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (pageErr) {
    throw new Error(`Failed to delete page: ${pageErr.message}`);
  }

  // Remaining pages
  const remainingPages = allPages.filter((p) => p.id !== id);
  await gcPageImages(userId, candidateImages, remainingPages);
}

/**
 * Reorder pages given an ordered list of IDs.
 */
export async function reorderPages(
  userId: string,
  orderedIds: string[]
): Promise<void> {
  const allPages = await fetchPages(userId);
  const pageMap = new Map(allPages.map((p) => [p.id, p]));

  await Promise.all(
    orderedIds.map(async (id, index) => {
      const page = pageMap.get(id);
      if (page && page.order !== index) {
        const updated: PagePlaintext = {
          section_id: page.section_id,
          title: page.title,
          order: index,
          tags: page.tags,
          outbound_links: page.outbound_links,
          image_ids: page.image_ids,
          migrated_from: page.migrated_from,
          created_at: page.created_at,
          updated_at: new Date().toISOString(),
        };
        await updatePageMeta(userId, id, updated);
      }
    })
  );
}
