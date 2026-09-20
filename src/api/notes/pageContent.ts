import { createClient } from "@/lib/supabase/client";
import { encryptField, decryptField } from "@/lib/crypto";
import {
  emptyFlowBlock,
  type PageContent,
  type PageContentPlaintext,
} from "@/types/notes";

export class RevisionConflictError extends Error {
  constructor(message = "Revision conflict: the page has been modified elsewhere.") {
    super(message);
    this.name = "RevisionConflictError";
  }
}

/**
 * Fetch page content by pageId. If no row exists, repairs by inserting
 * an initial empty content row at revision 0 (repair-on-read).
 */
export async function getPageContent(
  userId: string,
  pageId: string
): Promise<PageContent> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notes_page_content")
    .select("id, user_id, iv, data, revision, created_at")
    .eq("id", pageId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch page content: ${error.message}`);
  }

  if (!data) {
    // Repair-on-read: page exists but content row was not created yet
    const nowIso = new Date().toISOString();
    const initialPlaintext: PageContentPlaintext = {
      page_id: pageId,
      revision: 0,
      sheet_w: 900,
      sheet_h: 1200,
      blocks: [emptyFlowBlock()],
      strokes: [],
      updated_at: nowIso,
    };

    const encrypted = await encryptField(userId, JSON.stringify(initialPlaintext));
    const { data: inserted, error: insertError } = await supabase
      .from("notes_page_content")
      .insert({
        id: pageId,
        user_id: userId,
        iv: encrypted.iv,
        data: encrypted.ciphertext,
        revision: 0,
      })
      .select("id, revision, created_at")
      .single();

    if (insertError) {
      throw new Error(`Failed to initialize page content: ${insertError.message}`);
    }

    return {
      id: inserted.id,
      revision: inserted.revision,
      created_at: inserted.created_at,
      ...initialPlaintext,
    };
  }

  const decryptedStr = await decryptField(userId, data.iv, data.data);
  const parsed: PageContentPlaintext = JSON.parse(decryptedStr);
  return {
    ...parsed,
    id: data.id,
    revision: data.revision,
    created_at: data.created_at,
    page_id: data.id,
  };
}

/**
 * Save page content with compare-and-swap on the plaintext revision column.
 * If zero rows are affected, throws RevisionConflictError.
 */
export async function savePageContent(
  userId: string,
  pageId: string,
  content: Omit<PageContentPlaintext, "page_id" | "revision">,
  expectedRevision: number
): Promise<PageContent> {
  const supabase = createClient();
  const nextRevision = expectedRevision + 1;
  const nowIso = new Date().toISOString();

  const plaintextToEncrypt: PageContentPlaintext = {
    ...content,
    page_id: pageId,
    revision: nextRevision,
    updated_at: nowIso,
  };

  const encrypted = await encryptField(userId, JSON.stringify(plaintextToEncrypt));

  const { data, error } = await supabase
    .from("notes_page_content")
    .update({
      iv: encrypted.iv,
      data: encrypted.ciphertext,
      revision: nextRevision,
    })
    .eq("id", pageId)
    .eq("user_id", userId)
    .eq("revision", expectedRevision)
    .select("id, revision, created_at");

  if (error) {
    throw new Error(`Failed to save page content: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new RevisionConflictError();
  }

  return {
    id: data[0].id,
    revision: data[0].revision,
    created_at: data[0].created_at,
    ...plaintextToEncrypt,
  };
}
