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
  certificate_ids: string[]; // linked Certificate row IDs
  updated_at: string;
}

export interface CertificatePlaintext {
  label: string;         // user-given name for the certificate
  file_name: string;     // UUID.enc filename in storage bucket
  file_iv: string;       // Base64 IV for file encryption
  file_mime: string;     // original MIME type (e.g. "application/pdf")
  education_id: string;  // linked education ID (empty string if standalone)
  updated_at: string;
}

// --- Hydrated types (decrypted plaintext + row metadata) ---

export interface Education extends EducationPlaintext {
  id: string;
  created_at: string;
}

export interface Certificate extends CertificatePlaintext {
  id: string;
  created_at: string;
}
