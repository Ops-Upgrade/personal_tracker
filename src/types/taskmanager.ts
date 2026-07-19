// --- Priority & Mode ---

export const PRIORITIES = ["critical", "high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export type TaskMode = "online" | "offline";

// --- View toggle ---

export type TaskView = "completion" | "priority" | "months";

// --- Plaintext shapes (what lives inside the encrypted blob) ---

export interface TaskPlaintext {
  name: string;
  priority: Priority;
  due_date: string | null;
  mode: TaskMode;
  description: string;
  is_completed: boolean;
  completed_at: string | null;
  updated_at: string;
}

export interface NotePlaintext {
  name: string;
  content: string;
  document_ids: string[];
  updated_at: string;
}

// --- Hydrated types (decrypted plaintext + row metadata) ---

export interface Task extends TaskPlaintext {
  id: string;
  created_at: string;
}

export interface Note extends NotePlaintext {
  id: string;
  created_at: string;
}
