import type { Priority } from "@/types/taskmanager";

// --- View toggle ---

export type EducationViewMode = "priority" | "months";

// --- Plaintext shapes (what lives inside the encrypted blob) ---

export interface EducationPlaintext {
  name: string;              // course/certification name
  provider: string;          // institution/platform
  priority: Priority;        // matching task manager priority
  description: string;       // free-text notes
  is_completed: boolean;
  completed_at: string | null;
  due_date: string | null;   // due date for grouping month-wise
  document_ids: string[];    // linked Document row IDs (global document store)
  updated_at: string;
}

// --- Hydrated types (decrypted plaintext + row metadata) ---

export interface Education extends EducationPlaintext {
  id: string;
  created_at: string;
}
