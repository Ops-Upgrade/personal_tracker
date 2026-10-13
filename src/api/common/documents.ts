import { createBrowserClient as createClient } from "@ops-upgrade/auth-core";
import { encryptField, decryptField } from "@/lib/crypto";
import type { Document, DocumentPlaintext } from "@/types/document";
import { getUniqueFileName } from "@/lib/viewHelpers";

// ── In-memory session cache ──
// Fetching documents requires decrypting every row, so we cache the full
// hydrated list once per session (mirroring media.ts). Dedupe checks inside
// create/update also reuse the warm cache instead of re-hitting Supabase.
// Mutations (create / update / delete) maintain the cache so it stays fresh.

let cachedDocuments: Document[] | null = null;
let cacheUserId: string | null = null;

/** Drop the in-memory cache (call on logout / user switch). */
export function clearDocumentsCache(): void {
  cachedDocuments = null;
  cacheUserId = null;
}

/**
 * Fetch all documents for a user, decrypt each row, and return hydrated Document[].
 *
 * Cached per userId — subsequent calls in the same session return instantly.
 */
export async function fetchDocuments(userId: string): Promise<Document[]> {
  // Return cached result if the same user asks again
  if (cachedDocuments !== null && cacheUserId === userId) {
    return cachedDocuments;
  }

  const supabase = createClient();
  const { data: rows, error } = await supabase
    .from("documents")
    .select("id, user_id, iv, data, created_at")
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to fetch documents: ${error.message}`);
  if (!rows || rows.length === 0) {
    cachedDocuments = [];
    cacheUserId = userId;
    return [];
  }

  const parsed = await Promise.all(
    rows.map(async (row) => {
      const plaintext = await decryptField(userId, row.iv, row.data);
      const parsedPlaintext: DocumentPlaintext = JSON.parse(plaintext);
      return { id: row.id, created_at: row.created_at, ...parsedPlaintext };
    })
  );

  cachedDocuments = parsed;
  cacheUserId = userId;
  return parsed;
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
  // Deduplicate label against existing documents in the same domain
  const existingDocs = await fetchDocumentsByDomain(userId, plaintext.domain);
  const existingLabels = new Set(existingDocs.map((d) => d.label));
  const deduplicated = { ...plaintext, label: getUniqueFileName(plaintext.label, existingLabels) };

  const supabase = createClient();
  const encrypted = await encryptField(userId, JSON.stringify(deduplicated));

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

  const created: Document = { id: data.id, created_at: data.created_at, ...deduplicated };

  // Maintain cache — create a new array reference so React detects the change
  if (cachedDocuments !== null && cacheUserId === userId) {
    cachedDocuments = [...cachedDocuments, created];
  }

  return created;
}

/**
 * Update an existing document. Re-encrypts the full blob with a new IV.
 */
export async function updateDocument(
  userId: string,
  documentId: string,
  plaintext: DocumentPlaintext
): Promise<Document> {
  // Deduplicate label against existing documents in the same domain (excluding self)
  const existingDocs = await fetchDocumentsByDomain(userId, plaintext.domain);
  const existingLabels = new Set(
    existingDocs.filter((d) => d.id !== documentId).map((d) => d.label)
  );
  const deduplicated = { ...plaintext, label: getUniqueFileName(plaintext.label, existingLabels) };

  const supabase = createClient();
  const encrypted = await encryptField(userId, JSON.stringify(deduplicated));

  const { data, error } = await supabase
    .from("documents")
    .update({ iv: encrypted.iv, data: encrypted.ciphertext })
    .eq("id", documentId)
    .select("id, created_at")
    .single();

  if (error) throw new Error(`Failed to update document: ${error.message}`);

  const updated: Document = { id: data.id, created_at: data.created_at, ...deduplicated };

  // Maintain cache — replace stale entry with a new array reference
  if (cachedDocuments !== null && cacheUserId === userId) {
    cachedDocuments = cachedDocuments.map((d) => (d.id === documentId ? updated : d));
  }

  return updated;
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

  // Maintain cache — remove deleted entry
  if (cachedDocuments !== null) {
    cachedDocuments = cachedDocuments.filter((d) => d.id !== documentId);
  }
}
