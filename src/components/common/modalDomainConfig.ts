/**
 * Central modal-domain configuration for GenericDomainModal.
 *
 * Every domain the unified modal serves is described here exactly once: file
 * pane flags, linking rules, delete semantics, create-mode defaults, edit-mode
 * field mapping, context fetching, and the save/delete adapters that route
 * CRUD automatically based on the modal's `domain` prop. The modal component
 * itself contains no per-domain logic.
 *
 * NOTE: modal domain keys differ from the store adapter registry
 * (StoreDomainKey) in two places — see storeToModalDomain.
 */

import { getServerDateIST } from "@/api/serverDate";
import { createTask, deleteTask, updateTask } from "@/api/taskmanager";
import {
  createDocument,
  deleteDocument,
  fetchDocuments,
  updateDocument,
} from "@/api/common/documents";
import { deleteDocumentFile, uploadDocumentFile } from "@/api/common/documentStorage";
import type { Document, DocumentPlaintext } from "@/types/document";
import type { Education } from "@/types/education";
import type { Expense } from "@/types/expense";
import type { MedicalRecord } from "@/types/medical";
import type { Note, Task } from "@/types/taskmanager";
import type { BankEntry, PasswordEntry, PersonalRecord } from "@/types/vault";
import {
  getStoreAdapter,
  type BankPinData,
  type DocStoreAdapter,
  type RecordStoreAdapter,
  type StoreDomainKey,
} from "./store/storeAdapters";
import type { FileActions, StoreParentRecord } from "./GenericDomainModal";

// ============================================================
// Types
// ============================================================

/** Modal domain keys (differs from StoreDomainKey — see storeToModalDomain). */
export type ModalDomainKey =
  | "taskmanager"
  | "taskmanager_notes"
  | "education"
  | "expense"
  | "medical"
  | "vault_records"
  | "vault_documents"
  | "vault_passwords"
  | "vault_banks"
  | "vault_bank_details";

/**
 * Declarative modal target.
 * `type: "document"` → standalone file mode; `type: "record"` → record mode.
 * `data` carries the hydrated row for edit mode; a missing `target` means create.
 */
export interface ModalTarget {
  type: "record" | "document";
  id: string;
  data?: Record<string, unknown>;
}

/** Result of a config-driven save (what the modal hands to onSaved). */
export interface ModalSavedResult {
  id: string;
  name: string;
  /** Standalone document saves: the resolved linked parent id ("" if none). */
  linkedId?: string;
  /** The saved row when the save path produces one. */
  data?: Record<string, unknown>;
}

/** Save outcome context handed to onSaved alongside the result. */
export interface ModalSavedContext {
  wasCreate: boolean;
  unlinkedDocIds: string[];
}

/** Internal context the modal fetches for its file pane / parent dropdown. */
export interface ModalDomainContext {
  documents: Document[];
  parentRecords: StoreParentRecord[];
}

/** Per-domain modal behavior — the modal's single source of domain truth. */
export interface ModalDomainConfig {
  /** Human label used in the parent-link dropdown ("taskmanager", "education", ...). */
  label: string;
  /** Document domain used to filter files for record modals (undefined → no file pane). */
  docDomain?: DocumentPlaintext["domain"];
  allowFiles: boolean;
  allowLinking: boolean;
  /** Standalone mode: allow inline parent creation below the "— or —" divider. */
  canCreateParent: boolean;
  /** "cascade" → delete confirm may cascade to attached files; "simple" → plain delete. */
  deleteKind: "simple" | "cascade";
  deleteLabel: string;
  layout?: string[][];
  maxWidthClassName?: string;
  deleteCascadeDescription?: string;
  deleteCascadeFilesLabel?: string;
  /** Create-mode defaults merged over field-schema defaults (e.g. IST today). */
  createDefaults?: () => Promise<Record<string, unknown>>;
  /** Edit-mode form values from a hydrated row. */
  initialDataFor: (
    data: Record<string, unknown> | null,
  ) => Record<string, unknown>;
  /** Fetch file/parent context for the modal's panes. */
  fetchContext: (userId: string) => Promise<ModalDomainContext>;
  /** Modal title: standalone document saves vs record saves, create vs edit. */
  modalTitle: (
    type: "record" | "document",
    isEdit: boolean,
    data?: Record<string, unknown> | null,
  ) => string;
  saveRecord: (
    userId: string,
    target: ModalTarget | null,
    formData: Record<string, unknown>,
    fileActions: FileActions,
    ctx: ModalDomainContext,
  ) => Promise<ModalSavedResult>;
  deleteRecord: (
    userId: string,
    target: ModalTarget,
    cascadeMode: "unlink" | "cascade",
  ) => Promise<void>;
  /** Standalone document CRUD (absent → standalone mode unsupported). */
  saveDocument?: (
    userId: string,
    target: ModalTarget | null,
    fileActions: FileActions,
  ) => Promise<ModalSavedResult>;
  deleteDocument?: (
    userId: string,
    target: ModalTarget,
    cascadeMode: "unlink" | "cascade",
  ) => Promise<void>;
}

/** Store adapter registry key → modal domain key (tasks and vault docs differ). */
export function storeToModalDomain(domain: StoreDomainKey): ModalDomainKey {
  switch (domain) {
    case "taskmanager":
      // Store registry: "taskmanager" = notes. Modal registry: "taskmanager" = tasks.
      return "taskmanager_notes";
    case "vault":
      // Store registry: "vault" = documents. Modal registry: "vault" records = vault_records.
      return "vault_documents";
    default:
      return domain;
  }
}

// ============================================================
// Helpers
// ============================================================

function asDocAdapter<T extends { id: string }>(domain: StoreDomainKey): DocStoreAdapter<T> {
  const adapter = getStoreAdapter(domain);
  if (adapter.storeType !== "doc") {
    throw new Error(`Store domain "${domain}" is not a document store.`);
  }
  return adapter as unknown as DocStoreAdapter<T>;
}

function asRecordAdapter<T extends { id: string }>(
  domain: StoreDomainKey,
  scope?: Record<string, string>,
): RecordStoreAdapter<T> {
  const adapter = getStoreAdapter(domain, scope);
  if (adapter.storeType !== "record") {
    throw new Error(`Store domain "${domain}" is not a record store.`);
  }
  return adapter as unknown as RecordStoreAdapter<T>;
}

/** Upload the first staged file, replacing the document's previous file if any. */
async function replaceDocumentFile(
  userId: string,
  existing: Document,
  entry: { file: File; label: string },
): Promise<{ file_name: string; file_iv: string; file_mime: string }> {
  if (existing.file_name) {
    try {
      await deleteDocumentFile(userId, existing.file_name);
    } catch {
      // Best-effort — the parent save must not fail on a stale object.
    }
  }
  const { fileName, iv, mimeType } = await uploadDocumentFile(userId, entry.file);
  return { file_name: fileName, file_iv: iv, file_mime: mimeType };
}

/**
 * Shared standalone-document save, mirroring GenericStorePage's old
 * handleStoreSave: inline parent creation → file replace or plain update →
 * create for new docs (file required) → syncDocumentSaved.
 */
async function saveStoreDocument<T extends { id: string }>(
  userId: string,
  adapter: DocStoreAdapter<T>,
  target: ModalTarget | null,
  fileActions: FileActions,
): Promise<ModalSavedResult> {
  const nowIso = new Date().toISOString();
  const existing = target?.data as unknown as Document | undefined;
  const oldLinkedId = existing?.linked_id || "";

  let resolvedLinkedId = fileActions.linkedParentId || "";
  if (!resolvedLinkedId && fileActions.newRecordData && adapter.createParent) {
    resolvedLinkedId = await adapter.createParent(userId, fileActions.newRecordData);
  }

  const firstNewFile = fileActions.newFiles[0];
  let docId: string;
  if (existing) {
    if (firstNewFile) {
      const stored = await replaceDocumentFile(userId, existing, firstNewFile);
      await updateDocument(userId, existing.id, {
        ...existing,
        label: firstNewFile.label,
        ...stored,
        linked_id: resolvedLinkedId,
        updated_at: nowIso,
      });
    } else {
      await updateDocument(userId, existing.id, {
        ...existing,
        linked_id: resolvedLinkedId,
        updated_at: nowIso,
      });
    }
    docId = existing.id;
  } else {
    if (!firstNewFile) throw new Error("File is required for new documents.");
    const { fileName, iv, mimeType } = await uploadDocumentFile(userId, firstNewFile.file);
    const newDoc = await createDocument(userId, {
      label: firstNewFile.label,
      file_name: fileName,
      file_iv: iv,
      file_mime: mimeType,
      domain: adapter.domain,
      linked_id: resolvedLinkedId,
      updated_at: nowIso,
    });
    docId = newDoc.id;
  }

  if (adapter.syncDocumentSaved) {
    await adapter.syncDocumentSaved(userId, docId, resolvedLinkedId, oldLinkedId);
  }

  return {
    id: docId,
    name: firstNewFile?.label ?? existing?.label ?? "Document",
    linkedId: resolvedLinkedId,
  };
}

/**
 * Shared standalone-document delete, mirroring GenericStorePage's old
 * handleStoreDelete: cascade → deleteParent; unlink → unlinkFromParent;
 * then delete the file (best-effort) and the document row.
 */
async function deleteStoreDocument<T extends { id: string }>(
  userId: string,
  adapter: DocStoreAdapter<T>,
  target: ModalTarget,
  cascadeMode: "unlink" | "cascade",
): Promise<void> {
  const doc = target.data as unknown as Document;
  if (cascadeMode === "cascade" && doc.linked_id && adapter.deleteParent) {
    await adapter.deleteParent(userId, doc.linked_id);
  } else if (cascadeMode === "unlink" && doc.linked_id && adapter.unlinkFromParent) {
    await adapter.unlinkFromParent(userId, doc.id, doc.linked_id);
  }
  if (doc.file_name) {
    try {
      await deleteDocumentFile(userId, doc.file_name);
    } catch {
      // Best-effort — deleting the row must still succeed.
    }
  }
  await deleteDocument(doc.id);
}

// ============================================================
// Task config (record modal only — tasks have no file support)
// ============================================================

const taskConfig: ModalDomainConfig = {
  label: "taskmanager",
  allowFiles: false,
  allowLinking: false,
  canCreateParent: false,
  deleteKind: "simple",
  deleteLabel: "Delete",
  maxWidthClassName: "max-w-lg",
  createDefaults: async () => ({ due_date: await getServerDateIST() }),
  initialDataFor: (data) => ({
    name: data?.name ?? "",
    priority: data?.priority ?? "medium",
    due_date: data?.due_date ?? "",
    mode: data?.mode ?? "online",
    description: data?.description ?? "",
    is_completed: data?.is_completed ?? false,
  }),
  fetchContext: async () => ({ documents: [], parentRecords: [] }),
  modalTitle: (_type, isEdit) => (isEdit ? "Edit task" : "Add task"),
  saveRecord: async (userId, target, formData) => {
    const name = (formData.name as string).trim();
    if (!name) throw new Error("Task name is required.");

    const existing = target?.data as unknown as Task | undefined;
    const nowIso = new Date().toISOString();
    const payload = {
      name,
      priority: formData.priority as Task["priority"],
      due_date: (formData.due_date as string) || null,
      mode: formData.mode as Task["mode"],
      description: (formData.description as string).trim(),
      is_completed: !!formData.is_completed,
      completed_at: formData.is_completed
        ? existing?.completed_at ?? nowIso
        : null,
      updated_at: nowIso,
    };
    const saved = existing
      ? await updateTask(userId, existing.id, payload)
      : await createTask(userId, payload);
    return {
      id: saved.id,
      name: saved.name,
      data: saved as unknown as Record<string, unknown>,
    };
  },
  deleteRecord: async (_userId, target) => {
    await deleteTask(target.id);
  },
};

// ============================================================
// Document-linked record configs (notes / education / expense / medical / vault)
// ============================================================

function docLinkedModalConfig<T extends { id: string }>(
  adapter: DocStoreAdapter<T>,
  opts?: {
    createDefaults?: () => Promise<Record<string, unknown>>;
  },
): ModalDomainConfig {
  return {
    label: adapter.domain,
    docDomain: adapter.domain,
    allowFiles: adapter.modalAllowFiles,
    allowLinking: adapter.modalAllowLinking,
    canCreateParent: !!adapter.createParent,
    deleteKind: adapter.modalDeleteKind,
    deleteLabel: adapter.modalDeleteLabel,
    layout: adapter.modalLayout,
    deleteCascadeDescription:
      "This document is linked to a record. Deleting it will also unlink it.",
    deleteCascadeFilesLabel: "Delete associated record",
    createDefaults: opts?.createDefaults,
    initialDataFor: (data) => adapter.modalInitialData(data as unknown as T | null),
    fetchContext: async (userId) => {
      const fresh = await adapter.fetchData(userId);
      return {
        documents: fresh.documents,
        parentRecords: adapter.deriveParentRecords(fresh.rows),
      };
    },
    modalTitle: (type, isEdit, data) =>
      type === "document"
        ? isEdit
          ? "Edit Document"
          : "Add Document"
        : adapter.modalTitle(data as unknown as T | null),
    saveRecord: async (userId, target, formData, fileActions, ctx) => {
      const saved = await adapter.saveRecord(
        userId,
        target?.data as unknown as T | null,
        formData,
        fileActions,
        ctx.documents,
      );
      return {
        id: saved.id,
        name: (saved as unknown as { name?: string }).name ?? adapter.domain,
        data: saved as unknown as Record<string, unknown>,
      };
    },
    deleteRecord: async (userId, target, cascadeMode) => {
      await adapter.deleteRecord(
        userId,
        target.data as unknown as T,
        cascadeMode,
      );
    },
    saveDocument: (userId, target, fileActions) =>
      saveStoreDocument(userId, adapter, target, fileActions),
    deleteDocument: (userId, target, cascadeMode) =>
      deleteStoreDocument(userId, adapter, target, cascadeMode),
  };
}

const noteModalConfig = docLinkedModalConfig(asDocAdapter<Note>("taskmanager"));

const educationModalConfig = docLinkedModalConfig(asDocAdapter<Education>("education"), {
  createDefaults: async () => ({ due_date: await getServerDateIST() }),
});

const expenseModalConfig = docLinkedModalConfig(asDocAdapter<Expense>("expense"), {
  createDefaults: async () => ({ date: await getServerDateIST() }),
});

const medicalModalConfig = docLinkedModalConfig(asDocAdapter<MedicalRecord>("medical"), {
  createDefaults: async () => ({ date: await getServerDateIST() }),
});

const vaultDocumentsConfig = docLinkedModalConfig(asDocAdapter<PersonalRecord>("vault"));

// ============================================================
// Record-store configs (vault records / passwords / banks / pins)
// ============================================================

function recordModalConfig<T extends { id: string }>(
  adapter: RecordStoreAdapter<T>,
  opts: {
    resultName: (saved: T) => string;
    deleteLabel: string;
    editTitle: string;
    addTitle: string;
    maxWidthClassName?: string;
  },
): ModalDomainConfig {
  return {
    label: adapter.domain ?? "vault",
    docDomain: adapter.domain,
    allowFiles: !!adapter.allowFiles,
    allowLinking: !!adapter.allowFiles,
    canCreateParent: false,
    deleteKind: "simple",
    deleteLabel: opts.deleteLabel,
    layout: adapter.modalLayout,
    maxWidthClassName: opts.maxWidthClassName,
    initialDataFor: (data) => adapter.modalInitialData(data as unknown as T | null),
    fetchContext: async (userId) => ({
      documents: await fetchDocuments(userId),
      parentRecords: [],
    }),
    modalTitle: (_type, isEdit) => (isEdit ? opts.editTitle : opts.addTitle),
    saveRecord: async (userId, target, formData, fileActions, ctx) => {
      const saved = await adapter.saveRecord(
        userId,
        target?.data as unknown as T | null,
        formData,
        fileActions,
        ctx.documents,
      );
      return {
        id: saved.id,
        name: opts.resultName(saved),
        data: saved as unknown as Record<string, unknown>,
      };
    },
    deleteRecord: async (userId, target) => {
      await adapter.deleteRecord(userId, target.id);
    },
  };
}

const vaultRecordsConfig = recordModalConfig(
  asRecordAdapter<PersonalRecord>("vault_records"),
  {
    resultName: (s) => s.name,
    deleteLabel: "Delete Record",
    editTitle: "Edit Record",
    addTitle: "Add Record",
  },
);

const vaultPasswordsConfig = recordModalConfig(
  asRecordAdapter<PasswordEntry>("vault_passwords"),
  {
    resultName: (s) => s.site_name,
    deleteLabel: "Delete Credential",
    editTitle: "Edit Credential",
    addTitle: "Add Credential",
    maxWidthClassName: "max-w-md",
  },
);

const vaultBanksConfig = recordModalConfig(asRecordAdapter<BankEntry>("vault_banks"), {
  resultName: (s) => s.bank_name,
  deleteLabel: "Delete Bank",
  editTitle: "Edit Bank",
  addTitle: "Add Bank",
  maxWidthClassName: "max-w-md",
});

// buildBankDetailsAdapter produces a fresh adapter per call; cache the config
// per bank so its identity is stable across re-renders.
const bankDetailsConfigCache = new Map<string, ModalDomainConfig>();

function vaultBankDetailsConfig(scope?: Record<string, string>): ModalDomainConfig {
  const bankId = scope?.bankId ?? "";
  const cached = bankDetailsConfigCache.get(bankId);
  if (cached) return cached;
  const config = recordModalConfig(
    asRecordAdapter<BankPinData>("vault_bank_details", scope),
    {
      resultName: (s) => s.name,
      deleteLabel: "Delete PIN",
      editTitle: "Edit PIN",
      addTitle: "Add PIN",
      maxWidthClassName: "max-w-md",
    },
  );
  bankDetailsConfigCache.set(bankId, config);
  return config;
}

// ============================================================
// Registry
// ============================================================

export function getModalDomainConfig(
  domain: string,
  scope?: Record<string, string>,
): ModalDomainConfig {
  switch (domain) {
    case "taskmanager":
      return taskConfig;
    case "taskmanager_notes":
      return noteModalConfig;
    case "education":
      return educationModalConfig;
    case "expense":
      return expenseModalConfig;
    case "medical":
      return medicalModalConfig;
    case "vault_records":
      return vaultRecordsConfig;
    case "vault_documents":
      return vaultDocumentsConfig;
    case "vault_passwords":
      return vaultPasswordsConfig;
    case "vault_banks":
      return vaultBanksConfig;
    case "vault_bank_details":
      return vaultBankDetailsConfig(scope);
    default:
      throw new Error(`Unknown modal domain: ${domain}`);
  }
}
