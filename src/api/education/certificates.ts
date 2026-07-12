import { createClient } from "@/lib/supabase/client";
import { encryptField, decryptField } from "@/lib/crypto";
import type { Certificate, CertificatePlaintext } from "@/types/education";

/**
 * Fetch all certificates for a user, decrypt each row, and return hydrated Certificate[].
 */
export async function fetchCertificates(userId: string): Promise<Certificate[]> {
  const supabase = createClient();
  const { data: rows, error } = await supabase
    .from("certificates")
    .select("id, user_id, iv, data, created_at")
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to fetch certificates: ${error.message}`);
  if (!rows || rows.length === 0) return [];

  return Promise.all(
    rows.map(async (row) => {
      const plaintext = await decryptField(userId, row.iv, row.data);
      const parsed: CertificatePlaintext = JSON.parse(plaintext);
      return { id: row.id, created_at: row.created_at, ...parsed };
    })
  );
}

/**
 * Create a new certificate. Encrypts the plaintext blob before inserting.
 */
export async function createCertificate(
  userId: string,
  plaintext: CertificatePlaintext
): Promise<Certificate> {
  const supabase = createClient();
  const encrypted = await encryptField(userId, JSON.stringify(plaintext));

  const { data, error } = await supabase
    .from("certificates")
    .insert({
      user_id: userId,
      iv: encrypted.iv,
      data: encrypted.ciphertext,
    })
    .select("id, created_at")
    .single();

  if (error) throw new Error(`Failed to create certificate: ${error.message}`);

  return { id: data.id, created_at: data.created_at, ...plaintext };
}

/**
 * Update an existing certificate. Re-encrypts the full blob with a new IV.
 */
export async function updateCertificate(
  userId: string,
  certificateId: string,
  plaintext: CertificatePlaintext
): Promise<Certificate> {
  const supabase = createClient();
  const encrypted = await encryptField(userId, JSON.stringify(plaintext));

  const { data, error } = await supabase
    .from("certificates")
    .update({ iv: encrypted.iv, data: encrypted.ciphertext })
    .eq("id", certificateId)
    .select("id, created_at")
    .single();

  if (error) throw new Error(`Failed to update certificate: ${error.message}`);

  return { id: data.id, created_at: data.created_at, ...plaintext };
}

/**
 * Permanently delete a certificate by ID.
 *
 * NOTE: Callers are responsible for cleaning up the associated file
 * in R2 storage (see deleteCertificateFile). This function only removes the
 * database row — storage cleanup happens at the UI layer.
 */
export async function deleteCertificate(certificateId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("certificates").delete().eq("id", certificateId);

  if (error) throw new Error(`Failed to delete certificate: ${error.message}`);
}
