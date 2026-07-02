import { createClient } from "@/lib/supabase/client";
import { encryptField, decryptField } from "@/lib/crypto";
import type { Expense, ExpensePlaintext } from "@/types/expense";
import { deleteInvoice } from "./invoiceStorage";

/**
 * Fetch all expenses for a user, decrypt each row, and return hydrated Expense[].
 */
export async function fetchExpenses(userId: string): Promise<Expense[]> {
  const supabase = createClient();
  const { data: rows, error } = await supabase
    .from("expenses")
    .select("id, user_id, iv, data, created_at")
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to fetch expenses: ${error.message}`);
  if (!rows || rows.length === 0) return [];

  return Promise.all(
    rows.map(async (row) => {
      const plaintext = await decryptField(userId, row.iv, row.data);
      const raw = JSON.parse(plaintext);
      const parsed: ExpensePlaintext = {
        invoice_file: "",
        invoice_iv: "",
        invoice_mime: "",
        ...raw,
      };
      return { id: row.id, created_at: row.created_at, ...parsed };
    })
  );
}

/**
 * Create a new expense. Encrypts the plaintext blob before inserting.
 */
export async function createExpense(
  userId: string,
  plaintext: ExpensePlaintext
): Promise<Expense> {
  const supabase = createClient();
  const encrypted = await encryptField(userId, JSON.stringify(plaintext));

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      user_id: userId,
      iv: encrypted.iv,
      data: encrypted.ciphertext,
    })
    .select("id, created_at")
    .single();

  if (error) throw new Error(`Failed to create expense: ${error.message}`);

  return { id: data.id, created_at: data.created_at, ...plaintext };
}

/**
 * Update an existing expense. Re-encrypts the full blob with a new IV.
 */
export async function updateExpense(
  userId: string,
  expenseId: string,
  plaintext: ExpensePlaintext
): Promise<Expense> {
  const supabase = createClient();
  const encrypted = await encryptField(userId, JSON.stringify(plaintext));

  const { data, error } = await supabase
    .from("expenses")
    .update({ iv: encrypted.iv, data: encrypted.ciphertext })
    .eq("id", expenseId)
    .select("id, created_at")
    .single();

  if (error) throw new Error(`Failed to update expense: ${error.message}`);

  return { id: data.id, created_at: data.created_at, ...plaintext };
}

/**
 * Permanently delete an expense by ID.
 *
 * NOTE: Callers are responsible for cleaning up any associated invoice file
 * in Supabase Storage (see deleteInvoice). This function only removes the
 * database row — storage cleanup happens at the UI layer in ExpenseView.
 */
export async function deleteExpense(expenseId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", expenseId);

  if (error) throw new Error(`Failed to delete expense: ${error.message}`);
}
