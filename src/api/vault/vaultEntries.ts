import { createClient } from "@/lib/supabase/client";
import { encryptField, decryptField } from "@/lib/crypto";
import type {
  VaultSection,
  PersonalRecord,
  PasswordEntry,
  BankEntry,
  VaultEntryPlaintextUnion,
} from "@/types/vault";

// ── Helpers ──

function parseVaultEntry<T extends VaultEntryPlaintextUnion>(
  row: { id: string; created_at: string },
  plaintext: T
): T & { id: string; created_at: string } {
  return { id: row.id, created_at: row.created_at, ...plaintext };
}

// ── Fetch ──

/**
 * Fetch all vault entries for a user (all sections).
 */
export async function fetchVaultEntries(
  userId: string
): Promise<(PersonalRecord | PasswordEntry | BankEntry)[]> {
  const supabase = createClient();
  const { data: rows, error } = await supabase
    .from("vault_entries")
    .select("id, user_id, section, iv, data, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch vault entries: ${error.message}`);
  if (!rows || rows.length === 0) return [];

  return Promise.all(
    rows.map(async (row) => {
      const plaintext = await decryptField(userId, row.iv, row.data);
      const raw = JSON.parse(plaintext) as VaultEntryPlaintextUnion;
      return parseVaultEntry(row, raw);
    })
  );
}

/**
 * Fetch vault entries for a specific section.
 */
export async function fetchVaultEntriesBySection(
  userId: string,
  section: VaultSection
): Promise<(PersonalRecord | PasswordEntry | BankEntry)[]> {
  const supabase = createClient();
  const { data: rows, error } = await supabase
    .from("vault_entries")
    .select("id, user_id, section, iv, data, created_at")
    .eq("user_id", userId)
    .eq("section", section)
    .order("created_at", { ascending: false });

  if (error)
    throw new Error(
      `Failed to fetch vault entries for ${section}: ${error.message}`
    );
  if (!rows || rows.length === 0) return [];

  return Promise.all(
    rows.map(async (row) => {
      const plaintext = await decryptField(userId, row.iv, row.data);
      const raw = JSON.parse(plaintext) as VaultEntryPlaintextUnion;
      return parseVaultEntry(row, raw);
    })
  );
}

// ── Create ──

/**
 * Create a new vault entry. Encrypts the plaintext blob before inserting.
 */
export async function createVaultEntry<T extends VaultEntryPlaintextUnion>(
  userId: string,
  plaintext: T
): Promise<T & { id: string; created_at: string }> {
  const supabase = createClient();
  const encrypted = await encryptField(userId, JSON.stringify(plaintext));

  const { data, error } = await supabase
    .from("vault_entries")
    .insert({
      user_id: userId,
      section: plaintext.section,
      iv: encrypted.iv,
      data: encrypted.ciphertext,
    })
    .select("id, created_at")
    .single();

  if (error) throw new Error(`Failed to create vault entry: ${error.message}`);

  return parseVaultEntry(data, plaintext);
}

// ── Update ──

/**
 * Update an existing vault entry. Re-encrypts the full blob with a new IV.
 */
export async function updateVaultEntry<T extends VaultEntryPlaintextUnion>(
  userId: string,
  entryId: string,
  plaintext: T
): Promise<T & { id: string; created_at: string }> {
  const supabase = createClient();
  const encrypted = await encryptField(userId, JSON.stringify(plaintext));

  const { data, error } = await supabase
    .from("vault_entries")
    .update({ iv: encrypted.iv, data: encrypted.ciphertext })
    .eq("id", entryId)
    .select("id, created_at")
    .single();

  if (error) throw new Error(`Failed to update vault entry: ${error.message}`);

  return parseVaultEntry(data, plaintext);
}

// ── Delete ──

/**
 * Permanently delete a vault entry by ID.
 */
export async function deleteVaultEntry(entryId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("vault_entries")
    .delete()
    .eq("id", entryId);

  if (error) throw new Error(`Failed to delete vault entry: ${error.message}`);
}
