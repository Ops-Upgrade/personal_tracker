/**
 * Medical Records types.
 *
 * Medical records follow the standard encrypted-blob shape but have NO
 * "completed" concept — they are purely active records.
 */

/** Plaintext shape stored inside the encrypted blob */
export interface MedicalPlaintext {
  name: string;               // patient / record name
  clinic: string;             // clinic or hospital name
  date: string;               // ISO 8601 date (YYYY-MM-DD)
  diagnosis_timeline: string; // rich-text HTML describing diagnosis / timeline
  document_ids: string[];     // linked Document row IDs (global document store)
  updated_at: string;
}

/** Hydrated type: decrypted plaintext + row metadata */
export interface MedicalRecord extends MedicalPlaintext {
  id: string;
  created_at: string;
}
