// --- Month constants ---

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export type MonthName = (typeof MONTHS)[number];

// --- Plaintext shape (what lives inside the encrypted blob) ---

export interface ExpensePlaintext {
   item: string;
   seller: string;
   cost: number;
   date: string; // ISO 8601 date (YYYY-MM-DD) — determines month/year grouping
   reason: string;
   invoice: string; // Legacy: free-text reference (may be empty when file is used)
   invoice_file: string; // Filename in storage bucket (e.g. "<uuid>.enc"), empty if no file
   invoice_iv: string; // Base64 IV used to encrypt the file, empty if no file
   invoice_mime: string; // Original MIME type (e.g. "application/pdf"), empty if no file
   updated_at: string;
}

// --- Hydrated type (decrypted plaintext + row metadata) ---

export interface Expense extends ExpensePlaintext {
  id: string;
  created_at: string;
}
