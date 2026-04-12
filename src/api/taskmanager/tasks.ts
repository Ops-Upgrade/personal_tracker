import { createClient } from "@/lib/supabase/client";
import { encryptField, decryptField } from "@/lib/crypto";
import type { Task, TaskPlaintext } from "@/types/taskmanager";

/**
 * Fetch all tasks for a user, decrypt each row, and return hydrated Task[].
 */
export async function fetchTasks(userId: string): Promise<Task[]> {
  const supabase = createClient();
  const { data: rows, error } = await supabase
    .from("tasks")
    .select("id, user_id, iv, data, created_at")
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to fetch tasks: ${error.message}`);
  if (!rows || rows.length === 0) return [];

  return Promise.all(
    rows.map(async (row) => {
      const plaintext = await decryptField(userId, row.iv, row.data);
      const parsed: TaskPlaintext = JSON.parse(plaintext);
      return { id: row.id, created_at: row.created_at, ...parsed };
    })
  );
}

/**
 * Create a new task. Encrypts the plaintext blob before inserting.
 */
export async function createTask(
  userId: string,
  plaintext: TaskPlaintext
): Promise<Task> {
  const supabase = createClient();
  const encrypted = await encryptField(userId, JSON.stringify(plaintext));

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      iv: encrypted.iv,
      data: encrypted.ciphertext,
    })
    .select("id, created_at")
    .single();

  if (error) throw new Error(`Failed to create task: ${error.message}`);

  return { id: data.id, created_at: data.created_at, ...plaintext };
}

/**
 * Update an existing task. Re-encrypts the full blob with a new IV.
 */
export async function updateTask(
  userId: string,
  taskId: string,
  plaintext: TaskPlaintext
): Promise<Task> {
  const supabase = createClient();
  const encrypted = await encryptField(userId, JSON.stringify(plaintext));

  const { data, error } = await supabase
    .from("tasks")
    .update({ iv: encrypted.iv, data: encrypted.ciphertext })
    .eq("id", taskId)
    .select("id, created_at")
    .single();

  if (error) throw new Error(`Failed to update task: ${error.message}`);

  return { id: data.id, created_at: data.created_at, ...plaintext };
}

/**
 * Permanently delete a task by ID.
 */
export async function deleteTask(taskId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);

  if (error) throw new Error(`Failed to delete task: ${error.message}`);
}
