import type { FieldDef } from "@/components/common/GenericDomainModal";

// ── Form schemas for vault store modals (record stores + vault document store) ──

export const VAULT_RECORD_FIELDS: FieldDef[] = [
  { key: "name", type: "text", label: "Name", placeholder: "e.g. Aadhaar Number" },
  { key: "value", type: "text", label: "Value", placeholder: "The reference number or ID", isCopyable: true },
];

export const PASSWORD_FIELDS: FieldDef[] = [
  { key: "site_name", type: "text", label: "Site Name", placeholder: "e.g. Gmail" },
  { key: "username", type: "text", label: "Username", placeholder: "Your username or email", isCopyable: true },
  { key: "password", type: "password", label: "Password", placeholder: "Password", isCopyable: true },
];

export const PASSWORD_LAYOUT: string[][] = [["site_name"], ["username"], ["password"]];

export const BANK_FIELDS: FieldDef[] = [
  { key: "bank_name", type: "text", label: "Bank Name", placeholder: "e.g. HDFC Bank" },
];

export const BANK_LAYOUT: string[][] = [["bank_name"]];

export const PIN_FIELDS: FieldDef[] = [
  { key: "name", type: "text", label: "Name", placeholder: "e.g. ATM PIN, MPIN" },
  { key: "pin", type: "password", label: "PIN", placeholder: "PIN value", isCopyable: true },
];

export const PIN_LAYOUT: string[][] = [["name"], ["pin"]];
