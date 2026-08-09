/**
 * Vault types — secure secrets manager embedded within the personal tracker.
 *
 * All data inside the Vault is encrypted at rest using the existing app-level
 * DEK (AES-GCM), exactly like every other feature. The PIN adds a second
 * factor for UI access — it does not create a new encryption key.
 */

// ── Vault state machine ──

export type VaultState =
  | "loading"
  | "setup_required"
  | "locked"
  | "unlocked"
  | "grace";

export interface VaultContext {
  state: VaultState;
  unlock: (pin: string) => Promise<boolean>;
  lock: () => void;
  graceSecondsLeft: number | null;
  /** Result from the last verifyVaultPin call — includes attemptsLeft for warning display */
  lastVerifyResult: VaultVerifyResult | null;
  /** Set after a successful PIN reset — lock screen can show a success message */
  pinResetSuccess: boolean;
  clearPinResetSuccess: () => void;
}

// ── Server Action return types ──

export interface VaultVerifyResult {
  success: boolean;
  attemptsLeft?: number;
  lockedOut?: boolean;
}

// ── Vault entry types (encrypted blob shapes) ──

export type VaultSection = "records" | "passwords" | "banks";

/** Plaintext shape stored inside vault_entries.data (encrypted JSON blob) */
export interface VaultEntryPlaintext {
  section: VaultSection;
  updated_at: string;
}

// ── Personal Records ──

export interface PersonalRecordPlaintext extends VaultEntryPlaintext {
  section: "records";
  name: string;
  value: string;
}

export interface PersonalRecord extends PersonalRecordPlaintext {
  id: string;
  created_at: string;
}

// ── Password Manager ──

export interface PasswordEntryPlaintext extends VaultEntryPlaintext {
  section: "passwords";
  site_name: string;
  username: string;
  password: string;
}

export interface PasswordEntry extends PasswordEntryPlaintext {
  id: string;
  created_at: string;
}

// ── Bank Manager ──

export interface BankEntryPlaintext extends VaultEntryPlaintext {
  section: "banks";
  bank_name: string;
  pins: { id: string; name: string; pin: string }[];
}

export interface BankEntry extends BankEntryPlaintext {
  id: string;
  created_at: string;
}

// ── VaultRecordView display item ──

/** Lightweight display shape for VaultRecordView — maps vault entries to text-only tiles/list rows. */
export interface VaultRecordItem {
  id: string;
  /** Primary display name (e.g. record name, site name, bank name, PIN name). */
  title: string;
  /** Values displayed on the tile or in the right column of the list view. */
  values: {
    label?: string;
    value: string;
    isSecret?: boolean;
    isCopyable?: boolean;
  }[];
}

// ── Union type for generic handling ──

export type VaultEntry = PersonalRecord | PasswordEntry | BankEntry;
export type VaultEntryPlaintextUnion =
  | PersonalRecordPlaintext
  | PasswordEntryPlaintext
  | BankEntryPlaintext;
