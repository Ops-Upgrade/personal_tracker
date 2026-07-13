import { createClient } from "@/lib/supabase/client";
import { encryptField, decryptField } from "@/lib/crypto";
import type { MedicalRecord, MedicalPlaintext } from "@/types/medical";

/**
 * Fetch all medical records for a user, decrypt each row, and return hydrated MedicalRecord[].
 */
export async function fetchMedicalRecords(userId: string): Promise<MedicalRecord[]> {
  const supabase = createClient();
  const { data: rows, error } = await supabase
    .from("medical_records")
    .select("id, user_id, iv, data, created_at")
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to fetch medical records: ${error.message}`);
  if (!rows || rows.length === 0) return [];

  return Promise.all(
    rows.map(async (row) => {
      const plaintext = await decryptField(userId, row.iv, row.data);
      const raw = JSON.parse(plaintext);
      const parsed: MedicalPlaintext = {
        document_ids: [],
        ...raw,
      };
      return { id: row.id, created_at: row.created_at, ...parsed };
    })
  );
}

/**
 * Create a new medical record. Encrypts the plaintext blob before inserting.
 */
export async function createMedicalRecord(
  userId: string,
  plaintext: MedicalPlaintext
): Promise<MedicalRecord> {
  const supabase = createClient();
  const encrypted = await encryptField(userId, JSON.stringify(plaintext));

  const { data, error } = await supabase
    .from("medical_records")
    .insert({
      user_id: userId,
      iv: encrypted.iv,
      data: encrypted.ciphertext,
    })
    .select("id, created_at")
    .single();

  if (error) throw new Error(`Failed to create medical record: ${error.message}`);

  return { id: data.id, created_at: data.created_at, ...plaintext };
}

/**
 * Update an existing medical record. Re-encrypts the full blob with a new IV.
 */
export async function updateMedicalRecord(
  userId: string,
  recordId: string,
  plaintext: MedicalPlaintext
): Promise<MedicalRecord> {
  const supabase = createClient();
  const encrypted = await encryptField(userId, JSON.stringify(plaintext));

  const { data, error } = await supabase
    .from("medical_records")
    .update({ iv: encrypted.iv, data: encrypted.ciphertext })
    .eq("id", recordId)
    .select("id, created_at")
    .single();

  if (error) throw new Error(`Failed to update medical record: ${error.message}`);

  return { id: data.id, created_at: data.created_at, ...plaintext };
}

/**
 * Permanently delete a medical record by ID.
 */
export async function deleteMedicalRecord(recordId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("medical_records").delete().eq("id", recordId);

  if (error) throw new Error(`Failed to delete medical record: ${error.message}`);
}
