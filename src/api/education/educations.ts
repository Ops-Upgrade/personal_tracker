import { createClient } from "@/lib/supabase/client";
import { encryptField, decryptField } from "@/lib/crypto";
import type { Education, EducationPlaintext } from "@/types/education";

/**
 * Fetch all educations for a user, decrypt each row, and return hydrated Education[].
 */
export async function fetchEducations(userId: string): Promise<Education[]> {
  const supabase = createClient();
  const { data: rows, error } = await supabase
    .from("educations")
    .select("id, user_id, iv, data, created_at")
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to fetch educations: ${error.message}`);
  if (!rows || rows.length === 0) return [];

  return Promise.all(
    rows.map(async (row) => {
      const plaintext = await decryptField(userId, row.iv, row.data);
      const raw = JSON.parse(plaintext);
      const parsed: EducationPlaintext = {
        certificate_ids: [],
        ...raw,
      };
      return { id: row.id, created_at: row.created_at, ...parsed };
    })
  );
}

/**
 * Create a new education. Encrypts the plaintext blob before inserting.
 */
export async function createEducation(
  userId: string,
  plaintext: EducationPlaintext
): Promise<Education> {
  const supabase = createClient();
  const encrypted = await encryptField(userId, JSON.stringify(plaintext));

  const { data, error } = await supabase
    .from("educations")
    .insert({
      user_id: userId,
      iv: encrypted.iv,
      data: encrypted.ciphertext,
    })
    .select("id, created_at")
    .single();

  if (error) throw new Error(`Failed to create education: ${error.message}`);

  return { id: data.id, created_at: data.created_at, ...plaintext };
}

/**
 * Update an existing education. Re-encrypts the full blob with a new IV.
 */
export async function updateEducation(
  userId: string,
  educationId: string,
  plaintext: EducationPlaintext
): Promise<Education> {
  const supabase = createClient();
  const encrypted = await encryptField(userId, JSON.stringify(plaintext));

  const { data, error } = await supabase
    .from("educations")
    .update({ iv: encrypted.iv, data: encrypted.ciphertext })
    .eq("id", educationId)
    .select("id, created_at")
    .single();

  if (error) throw new Error(`Failed to update education: ${error.message}`);

  return { id: data.id, created_at: data.created_at, ...plaintext };
}

/**
 * Permanently delete an education by ID.
 *
 * NOTE: Callers are responsible for cleaning up any associated certificate files
 * in R2 storage (see deleteCertificateFile). This function only removes the
 * database row — storage cleanup happens at the UI layer in EducationView.
 */
export async function deleteEducation(educationId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("educations").delete().eq("id", educationId);

  if (error) throw new Error(`Failed to delete education: ${error.message}`);
}
