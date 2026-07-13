import { createClient } from "@/lib/supabase/client";
import { encryptField, decryptField } from "@/lib/crypto";
import type { Document, DocumentPlaintext } from "@/types/document";

/**
 * Fetch all documents for a user, decrypt each row, and return hydrated Document[].
 */
export async function fetchDocuments(userId: string): Promise<Document[]> {
  const supabase = createClient();
  const { data: rows, error } = await supabase
    .from("documents")
    .select("id, user_id, iv, data, created_at")
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to fetch documents: ${error.message}`);
  if (!rows || rows.length === 0) return [];

  return Promise.all(
    rows.map(async (row) => {
      const plaintext = await decryptField(userId, row.iv, row.data);
      const parsed: DocumentPlaintext = JSON.parse(plaintext);
      return { id: row.id, created_at: row.created_at, ...parsed };
    })
  );
}

/**
 * Fetch documents for a specific domain, optionally filtered by linked_id.
 */
export async function fetchDocumentsByDomain(
  userId: string,
  domain: DocumentPlaintext["domain"],
  linkedId?: string
): Promise<Document[]> {
  const all = await fetchDocuments(userId);
  let filtered = all.filter((d) => d.domain === domain);
  if (linkedId !== undefined) {
    filtered = filtered.filter((d) => d.linked_id === linkedId);
  }
  return filtered;
}

/**
 * Create a new document. Encrypts the plaintext blob before inserting.
 */
export async function createDocument(
  userId: string,
  plaintext: DocumentPlaintext
): Promise<Document> {
  const supabase = createClient();
  const encrypted = await encryptField(userId, JSON.stringify(plaintext));

  const { data, error } = await supabase
    .from("documents")
    .insert({
      user_id: userId,
      iv: encrypted.iv,
      data: encrypted.ciphertext,
    })
    .select("id, created_at")
    .single();

  if (error) throw new Error(`Failed to create document: ${error.message}`);

  return { id: data.id, created_at: data.created_at, ...plaintext };
}

/**
 * Update an existing document. Re-encrypts the full blob with a new IV.
 */
export async function updateDocument(
  userId: string,
  documentId: string,
  plaintext: DocumentPlaintext
): Promise<Document> {
  const supabase = createClient();
  const encrypted = await encryptField(userId, JSON.stringify(plaintext));

  const { data, error } = await supabase
    .from("documents")
    .update({ iv: encrypted.iv, data: encrypted.ciphertext })
    .eq("id", documentId)
    .select("id, created_at")
    .single();

  if (error) throw new Error(`Failed to update document: ${error.message}`);

  return { id: data.id, created_at: data.created_at, ...plaintext };
}

/**
 * Permanently delete a document by ID.
 *
 * NOTE: Callers are responsible for cleaning up the associated file
 * in R2 storage. This function only removes the database row.
 */
export async function deleteDocument(documentId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("documents").delete().eq("id", documentId);

  if (error) throw new Error(`Failed to delete document: ${error.message}`);
}
