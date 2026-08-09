/**
 * Global Document types — replaces CertificatePlaintext for multi-domain use.
 *
 * Every domain (education, expense, medical) stores file attachments as rows
 * in the generic `documents` table. The `domain` field discriminates which
 * feature a document belongs to, and `linked_id` ties it to a parent record.
 */

export type DocumentDomain = "education" | "expense" | "medical" | "taskmanager" | "vault";

/** Plaintext shape that lives inside the encrypted blob */
export interface DocumentPlaintext {
  label: string;        // user-given display name
  file_name: string;    // UUID.enc filename in R2 storage
  file_iv: string;      // Base64 IV for file encryption
  file_mime: string;    // original MIME type (e.g. "application/pdf")
  domain: DocumentDomain; // which feature this document belongs to
  linked_id: string;    // parent record ID (empty string if standalone)
  updated_at: string;
}

/** Hydrated type: decrypted plaintext + row metadata */
export interface Document extends DocumentPlaintext {
  id: string;
  created_at: string;
}
