import { createClient } from "@/lib/supabase/client";
import { encryptField, decryptField } from "@/lib/crypto";
import type { Section, SectionPlaintext } from "@/types/notes";
import { deletePage, fetchPages } from "./pages";

/**
 * Fetch all sections for a user, decrypt each row, and return hydrated Section[].
 */
export async function fetchSections(userId: string): Promise<Section[]> {
  const supabase = createClient();
  const { data: rows, error } = await supabase
    .from("notes_sections")
    .select("id, user_id, iv, data, created_at")
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to fetch sections: ${error.message}`);
  if (!rows || rows.length === 0) return [];

  const sections = await Promise.all(
    rows.map(async (row) => {
      const plaintextStr = await decryptField(userId, row.iv, row.data);
      const parsed: SectionPlaintext = JSON.parse(plaintextStr);
      return { id: row.id, created_at: row.created_at, ...parsed };
    })
  );

  return sections.sort((a, b) => a.order - b.order);
}

/**
 * Create a new section.
 */
export async function createSection(
  userId: string,
  plaintext: SectionPlaintext
): Promise<Section> {
  const supabase = createClient();
  const nowIso = new Date().toISOString();
  const payload: SectionPlaintext = {
    ...plaintext,
    updated_at: nowIso,
  };

  const encrypted = await encryptField(userId, JSON.stringify(payload));
  const { data, error } = await supabase
    .from("notes_sections")
    .insert({
      user_id: userId,
      iv: encrypted.iv,
      data: encrypted.ciphertext,
    })
    .select("id, created_at")
    .single();

  if (error) throw new Error(`Failed to create section: ${error.message}`);

  return { id: data.id, created_at: data.created_at, ...payload };
}

/**
 * Update an existing section.
 */
export async function updateSection(
  userId: string,
  id: string,
  plaintext: SectionPlaintext
): Promise<Section> {
  const supabase = createClient();
  const payload: SectionPlaintext = {
    ...plaintext,
    updated_at: new Date().toISOString(),
  };

  const encrypted = await encryptField(userId, JSON.stringify(payload));
  const { data, error } = await supabase
    .from("notes_sections")
    .update({ iv: encrypted.iv, data: encrypted.ciphertext })
    .eq("id", id)
    .eq("user_id", userId)
    .select("id, created_at")
    .single();

  if (error) throw new Error(`Failed to update section: ${error.message}`);

  return { id: data.id, created_at: data.created_at, ...payload };
}

/**
 * Delete a section and all child pages.
 */
export async function deleteSection(userId: string, id: string): Promise<void> {
  const supabase = createClient();

  // Find all child pages
  const allPages = await fetchPages(userId);
  const childPages = allPages.filter((p) => p.section_id === id);

  // Delete all child pages (which handles content deletion and image GC)
  for (const page of childPages) {
    await deletePage(userId, page.id);
  }

  // Delete the section row
  const { error } = await supabase
    .from("notes_sections")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to delete section: ${error.message}`);
}

/**
 * Reorder sections given an ordered list of IDs.
 */
export async function reorderSections(
  userId: string,
  orderedIds: string[]
): Promise<void> {
  const allSections = await fetchSections(userId);
  const sectionMap = new Map(allSections.map((s) => [s.id, s]));

  await Promise.all(
    orderedIds.map(async (id, index) => {
      const section = sectionMap.get(id);
      if (section && section.order !== index) {
        const updated: SectionPlaintext = {
          notebook_id: section.notebook_id,
          name: section.name,
          order: index,
          color: section.color,
          updated_at: new Date().toISOString(),
        };
        await updateSection(userId, id, updated);
      }
    })
  );
}
