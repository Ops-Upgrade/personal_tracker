import { createClient } from "@/lib/supabase/client";
import { encryptField, decryptField } from "@/lib/crypto";
import type { Note, NotePlaintext } from "@/types/taskmanager";

/**
 * Fetch all notes for a user, decrypt each row, and return hydrated Note[].
 */
export async function fetchNotes(userId: string): Promise<Note[]> {
  const supabase = createClient();
  const { data: rows, error } = await supabase
    .from("notes")
    .select("id, user_id, iv, data, created_at")
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to fetch notes: ${error.message}`);
  if (!rows || rows.length === 0) return [];

  return Promise.all(
    rows.map(async (row) => {
      const plaintext = await decryptField(userId, row.iv, row.data);
      const parsed: NotePlaintext = JSON.parse(plaintext);
      return { id: row.id, created_at: row.created_at, ...parsed };
    })
  );
}

/**
 * Create a new note. Encrypts the plaintext blob before inserting.
 */
export async function createNote(
  userId: string,
  plaintext: NotePlaintext
): Promise<Note> {
  const supabase = createClient();
  const encrypted = await encryptField(userId, JSON.stringify(plaintext));

  const { data, error } = await supabase
    .from("notes")
    .insert({
      user_id: userId,
      iv: encrypted.iv,
      data: encrypted.ciphertext,
    })
    .select("id, created_at")
    .single();

  if (error) throw new Error(`Failed to create note: ${error.message}`);

  return { id: data.id, created_at: data.created_at, ...plaintext };
}

/**
 * Update an existing note. Re-encrypts the full blob with a new IV.
 */
export async function updateNote(
  userId: string,
  noteId: string,
  plaintext: NotePlaintext
): Promise<Note> {
  const supabase = createClient();
  const encrypted = await encryptField(userId, JSON.stringify(plaintext));

  const { data, error } = await supabase
    .from("notes")
    .update({ iv: encrypted.iv, data: encrypted.ciphertext })
    .eq("id", noteId)
    .select("id, created_at")
    .single();

  if (error) throw new Error(`Failed to update note: ${error.message}`);

  return { id: data.id, created_at: data.created_at, ...plaintext };
}

/**
 * Permanently delete a note by ID.
 */
export async function deleteNote(noteId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("notes").delete().eq("id", noteId);

  if (error) throw new Error(`Failed to delete note: ${error.message}`);
}
