// --- Plaintext shape (what lives inside the encrypted blob) ---

export interface ExpensePlaintext {
   item: string;
   seller: string;
   cost: number;
   date: string; // ISO 8601 date (YYYY-MM-DD) — determines month/year grouping
   reason: string;
   document_ids: string[]; // linked Document row IDs (global document store)
   updated_at: string;
}

// --- Hydrated type (decrypted plaintext + row metadata) ---

export interface Expense extends ExpensePlaintext {
  id: string;
  created_at: string;
}

// --- View toggle ---

export type ExpenseViewMode = "single" | "multi";
