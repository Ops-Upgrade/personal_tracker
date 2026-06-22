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
  invoice: string;
  updated_at: string;
}

// --- Hydrated type (decrypted plaintext + row metadata) ---

export interface Expense extends ExpensePlaintext {
  id: string;
  created_at: string;
}
