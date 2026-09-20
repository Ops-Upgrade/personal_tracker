import { createClient } from "@/lib/supabase/client";
import { encryptField, decryptField } from "@/lib/crypto";
import type { Notebook, NotebookPlaintext } from "@/types/notes";
import { deleteSection, fetchSections } from "./sections";

/**
 * Fetch all notebooks for a user, decrypt each row, and return hydrated Notebook[].
 */
export async function fetchNotebooks(userId: string): Promise<Notebook[]> {
  const supabase = createClient();
  const { data: rows, error } = await supabase
    .from("notes_notebooks")
    .select("id, user_id, iv, data, created_at")
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to fetch notebooks: ${error.message}`);
  if (!rows || rows.length === 0) return [];

  const notebooks = await Promise.all(
    rows.map(async (row) => {
      const plaintextStr = await decryptField(userId, row.iv, row.data);
      const parsed: NotebookPlaintext = JSON.parse(plaintextStr);
      return { id: row.id, created_at: row.created_at, ...parsed };
    })
  );

  return notebooks.sort((a, b) => a.order - b.order);
}

/**
 * Create a new notebook.
 */
export async function createNotebook(
  userId: string,
  plaintext: NotebookPlaintext
): Promise<Notebook> {
  const supabase = createClient();
  const nowIso = new Date().toISOString();
  const payload: NotebookPlaintext = {
    ...plaintext,
    updated_at: nowIso,
  };

  const encrypted = await encryptField(userId, JSON.stringify(payload));
  const { data, error } = await supabase
    .from("notes_notebooks")
    .insert({
      user_id: userId,
      iv: encrypted.iv,
      data: encrypted.ciphertext,
    })
    .select("id, created_at")
    .single();

  if (error) throw new Error(`Failed to create notebook: ${error.message}`);

  return { id: data.id, created_at: data.created_at, ...payload };
}

/**
 * Update an existing notebook.
 */
export async function updateNotebook(
  userId: string,
  id: string,
  plaintext: NotebookPlaintext
): Promise<Notebook> {
  const supabase = createClient();
  const payload: NotebookPlaintext = {
    ...plaintext,
    updated_at: new Date().toISOString(),
  };

  const encrypted = await encryptField(userId, JSON.stringify(payload));
  const { data, error } = await supabase
    .from("notes_notebooks")
    .update({ iv: encrypted.iv, data: encrypted.ciphertext })
    .eq("id", id)
    .eq("user_id", userId)
    .select("id, created_at")
    .single();

  if (error) throw new Error(`Failed to update notebook: ${error.message}`);

  return { id: data.id, created_at: data.created_at, ...payload };
}

/**
 * Delete a notebook and all child sections and pages.
 */
export async function deleteNotebook(userId: string, id: string): Promise<void> {
  const supabase = createClient();

  // Find all child sections
  const allSections = await fetchSections(userId);
  const childSections = allSections.filter((s) => s.notebook_id === id);

  // Delete each child section (which cascades to its pages and image GC)
  for (const section of childSections) {
    await deleteSection(userId, section.id);
  }

  // Delete the notebook row
  const { error } = await supabase
    .from("notes_notebooks")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to delete notebook: ${error.message}`);
}

/**
 * Reorder notebooks given an ordered list of IDs.
 */
export async function reorderNotebooks(
  userId: string,
  orderedIds: string[]
): Promise<void> {
  const allNotebooks = await fetchNotebooks(userId);
  const notebookMap = new Map(allNotebooks.map((n) => [n.id, n]));

  await Promise.all(
    orderedIds.map(async (id, index) => {
      const notebook = notebookMap.get(id);
      if (notebook && notebook.order !== index) {
        const updated: NotebookPlaintext = {
          name: notebook.name,
          order: index,
          updated_at: new Date().toISOString(),
        };
        await updateNotebook(userId, id, updated);
      }
    })
  );
}
