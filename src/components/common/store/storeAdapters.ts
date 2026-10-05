/**
 * Domain adapter registry for GenericStorePage.
 *
 * GenericStorePage is a pure list/modal orchestrator. Everything domain-specific —
 * data fetching, parent-record mapping, modal titles/initial data, and CRUD with
 * document linking — lives here, keyed by the `domain` prop. Store routes never
 * pass callbacks or JSX; they only pass declarative config (title, fields, ...).
 *
 * Action visibility is capability-driven: an adapter that omits `unlinkFromParent`
 * / `bulkLinkToParent` / `deleteParent` / `createParent` gets no corresponding UI.
 */

import { ROUTES } from "@/routes/paths";
import type { Priority } from "@/types/common";
import type { Document, DocumentPlaintext } from "@/types/document";
import type { Note, NotePlaintext } from "@/types/taskmanager";
import type { Education, EducationPlaintext } from "@/types/education";
import type { Expense, ExpensePlaintext } from "@/types/expense";
import type { MedicalRecord, MedicalPlaintext } from "@/types/medical";
import type {
  BankEntry,
  BankEntryPlaintext,
  PasswordEntry,
  PasswordEntryPlaintext,
  PersonalRecord,
  PersonalRecordPlaintext,
  VaultRecordItem,
} from "@/types/vault";
import {
  fetchNotes,
  createNote,
  updateNote,
  deleteNote,
} from "@/api/taskmanager";
import {
  fetchEducations,
  createEducation,
  updateEducation,
  deleteEducation,
} from "@/api/education";
import {
  fetchExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
} from "@/api/expense";
import {
  fetchMedicalRecords,
  createMedicalRecord,
  updateMedicalRecord,
  deleteMedicalRecord,
} from "@/api/medical";
import {
  fetchVaultEntriesBySection,
  createVaultEntry,
  updateVaultEntry,
  deleteVaultEntry,
} from "@/api/vault";
import {
  fetchDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
} from "@/api/common/documents";
import {
  uploadFile,
  deleteFile,
} from "@/api/common/encryptedFileStorage";
import { normalizeDateForInput } from "@/lib/utils";
import { EDUCATION_LAYOUT } from "@/components/education/config";
import { BANK_LAYOUT, PASSWORD_LAYOUT, PIN_LAYOUT } from "@/components/vault/storeConfig";
import type {
  FileActions,
  StoreParentRecord,
} from "@/components/common/GenericDomainModal";

// ============================================================
// Types
// ============================================================

export type StoreDomainKey =
  | "taskmanager"
  | "expense"
  | "education"
  | "medical"
  | "vault"
  | "vault_banks"
  | "vault_bank_details"
  | "vault_passwords"
  | "vault_records";

/** A row inside a BankEntry's pins array (vault_bank_details). */
export interface BankPinData {
  id: string;
  name: string;
  pin: string;
}

export interface DocStoreAdapter<T extends { id: string }> {
  storeType: "doc";
  /** Document-table domain string for filtering / linking. */
  domain: DocumentPlaintext["domain"];
  /** Field grouping for the record modal + the standalone create form. */
  modalLayout?: string[][];
  modalTitle: (record: T | null) => string;
  modalInitialData: (record: T | null) => Record<string, unknown>;
  modalAllowFiles: boolean;
  modalAllowLinking: boolean;
  modalDeleteLabel: string;
  /** "cascade" → onDeleteWithCascade; "simple" → onDelete (always deletes attached files). */
  modalDeleteKind: "cascade" | "simple";
  emptyMessage: string;
  searchPlaceholder: string;
  fetchData: (userId: string) => Promise<{ rows: T[]; documents: Document[] }>;
  deriveParentRecords: (rows: T[]) => StoreParentRecord[];
  saveRecord: (
    userId: string,
    record: T | null,
    formData: Record<string, unknown>,
    fileActions: FileActions,
    allDocuments: Document[],
  ) => Promise<T>;
  deleteRecord: (
    userId: string,
    record: T,
    cascadeMode: "unlink" | "cascade",
  ) => Promise<void>;
  /** Inline parent creation from the standalone upload modal (absent → no create form). */
  createParent?: (userId: string, data: Record<string, string>) => Promise<string>;
  /** Cascade-delete of the parent record from document delete confirms (absent → checkbox hidden). */
  deleteParent?: (userId: string, parentId: string) => Promise<void>;
  /** Unlink a document from its parent (absent → unlink buttons hidden). */
  unlinkFromParent?: (
    userId: string,
    documentId: string,
    parentId: string,
  ) => Promise<void>;
  /** Bulk-link documents to a parent (absent → bulk Link button hidden). */
  bulkLinkToParent?: (
    userId: string,
    documentIds: string[],
    parentId: string,
  ) => Promise<void>;
  /** Sync parent document_ids after a document's linked_id changed. */
  syncDocumentSaved?: (
    userId: string,
    documentId: string,
    newLinkedId: string,
    oldLinkedId: string,
  ) => Promise<void>;
}

export interface RecordStoreAdapter<T extends { id: string }> {
  storeType: "record";
  /** Document-table domain used for file filtering when allowFiles is true. */
  domain?: DocumentPlaintext["domain"];
  modalLayout?: string[][];
  modalTitle: (record: T | null) => string;
  modalInitialData: (record: T | null) => Record<string, unknown>;
  modalDeleteLabel: string;
  modalMaxWidthClassName?: string;
  /** Record modal file pane (vault records only). */
  allowFiles?: boolean;
  fetchData: (
    userId: string,
    scope?: Record<string, string>,
  ) => Promise<{ rows: T[]; documents?: Document[]; pageTitle?: string }>;
  mapRecordToItem: (record: T, documents: Document[]) => VaultRecordItem;
  /** When present, clicking a row navigates instead of opening the edit modal. */
  getRowHref?: (record: T) => string;
  saveRecord: (
    userId: string,
    record: T | null,
    formData: Record<string, unknown>,
    fileActions: FileActions,
    allDocuments: Document[],
  ) => Promise<T>;
  deleteRecord: (userId: string, recordId: string) => Promise<void>;
  bulkDeleteRecords: (userId: string, ids: string[]) => Promise<void>;
  itemName: string;
  itemNamePlural?: string;
  singleDeleteDescription?: string;
  emptyMessage?: string;
  searchPlaceholder?: string;
  tileLayout?: "standard" | "body-only";
}

export type StoreAdapter =
  | DocStoreAdapter<Note>
  | DocStoreAdapter<Education>
  | DocStoreAdapter<Expense>
  | DocStoreAdapter<MedicalRecord>
  | DocStoreAdapter<PersonalRecord>
  | RecordStoreAdapter<PasswordEntry>
  | RecordStoreAdapter<PersonalRecord>
  | RecordStoreAdapter<BankEntry>
  | RecordStoreAdapter<BankPinData>;

// ============================================================
// Shared helpers (used by multiple adapters)
// ============================================================

/** A hydrated doc-linked parent row (document_ids lives in the encrypted blob). */
interface RowWithDocs {
  id: string;
  document_ids: string[];
}

/**
 * Orchestrates document mutations around a doc-linked parent save:
 * unlink/delete staged docs, persist the record with the remaining ids,
 * upload the first new file, link one staged existing doc, re-persist if needed.
 *
 * Mirrors the old useXxxActions handleXxxSave flows.
 */
async function saveDocLinkedRecord<
  T extends { id: string; document_ids: string[] },
  P,
>(
  userId: string,
  existing: T | null,
  fileActions: FileActions,
  domain: DocumentPlaintext["domain"],
  fetchRows: (userId: string) => Promise<T[]>,
  createRow: (userId: string, plaintext: P) => Promise<T>,
  updateRow: (userId: string, id: string, plaintext: P) => Promise<T>,
  buildPlaintext: (documentIds: string[], freshRow: T | null) => P,
): Promise<T> {
  const freshDocs = await fetchDocuments(userId);

  // Re-read the row so the save doesn't clobber concurrent edits.
  const freshRow = existing
    ? (await fetchRows(userId)).find((r) => r.id === existing.id) ?? null
    : null;

  let currentDocIds = [...(freshRow?.document_ids ?? [])];
  const nowIso = new Date().toISOString();

  // Unlink staged documents (clear linked_id + drop from parent list)
  if (fileActions.docsToUnlink.length > 0 && existing) {
    for (const docId of fileActions.docsToUnlink) {
      const doc = freshDocs.find((d) => d.id === docId);
      if (doc) {
        await updateDocument(userId, docId, {
          ...doc,
          linked_id: "",
          updated_at: nowIso,
        } as DocumentPlaintext);
      }
      currentDocIds = currentDocIds.filter((id) => id !== docId);
    }
  }

  // Delete staged documents (file + row)
  for (const docId of fileActions.docsToDelete) {
    const doc = freshDocs.find((d) => d.id === docId);
    if (!doc) continue;
    currentDocIds = currentDocIds.filter((id) => id !== docId);
    if (doc.file_name) {
      try {
        await deleteFile(userId, doc.file_name);
      } catch {
        /* best-effort */
      }
    }
    await deleteDocument(docId);
  }

  const saved = freshRow
    ? await updateRow(userId, freshRow.id, buildPlaintext(currentDocIds, freshRow))
    : await createRow(userId, buildPlaintext(currentDocIds, null));

  // New file upload → link to the saved record
  let needsUpdate = false;
  const newDocIds = [...currentDocIds];
  const firstNewFile = fileActions.newFiles[0];
  if (firstNewFile) {
    const { fileName, iv, mimeType } = await uploadFile(userId, firstNewFile.file);
    const doc = await createDocument(userId, {
      label: firstNewFile.label,
      file_name: fileName,
      file_iv: iv,
      file_mime: mimeType,
      domain,
      linked_id: saved.id,
      updated_at: nowIso,
    });
    newDocIds.push(doc.id);
    needsUpdate = true;
  }

  // Link a staged existing document
  const linkId = fileActions.docsToLink[0];
  if (linkId) {
    const pdoc = freshDocs.find((d) => d.id === linkId);
    if (pdoc) {
      await updateDocument(userId, linkId, {
        ...pdoc,
        linked_id: saved.id,
        updated_at: nowIso,
      } as DocumentPlaintext);
      if (!newDocIds.includes(linkId)) newDocIds.push(linkId);
      needsUpdate = true;
    }
  }

  if (needsUpdate) {
    return await updateRow(userId, saved.id, buildPlaintext(newDocIds, freshRow ?? saved));
  }
  return saved;
}

/** Delete a doc-linked parent record, unlinking or cascading its documents first. */
async function deleteDocLinkedRecord(
  userId: string,
  domain: DocumentPlaintext["domain"],
  recordId: string,
  cascadeMode: "unlink" | "cascade",
  deleteRow: (id: string) => Promise<void>,
): Promise<void> {
  const allDocs = await fetchDocuments(userId);
  const recordDocs = allDocs.filter(
    (d) => d.domain === domain && d.linked_id === recordId,
  );
  const nowIso = new Date().toISOString();

  if (cascadeMode === "unlink") {
    for (const doc of recordDocs) {
      await updateDocument(userId, doc.id, {
        ...doc,
        linked_id: "",
        updated_at: nowIso,
      } as DocumentPlaintext);
    }
  } else {
    for (const doc of recordDocs) {
      if (doc.file_name) {
        try {
          await deleteFile(userId, doc.file_name);
        } catch {
          /* best-effort */
        }
      }
      await deleteDocument(doc.id);
    }
  }

  await deleteRow(recordId);
}

/** Sync a parent's document_ids list after a document's linked_id changed. */
async function syncDocParentIds<T extends RowWithDocs>(
  userId: string,
  documentId: string,
  newLinkedId: string,
  oldLinkedId: string,
  fetchRows: (userId: string) => Promise<T[]>,
  updateRow: (userId: string, row: T, documentIds: string[]) => Promise<unknown>,
): Promise<void> {
  if (oldLinkedId === newLinkedId) return;
  const rows = await fetchRows(userId);

  if (oldLinkedId) {
    const oldRow = rows.find((r) => r.id === oldLinkedId);
    if (oldRow) {
      await updateRow(
        userId,
        oldRow,
        oldRow.document_ids.filter((id) => id !== documentId),
      );
    }
  }
  if (newLinkedId) {
    const newRow = rows.find((r) => r.id === newLinkedId);
    if (newRow) {
      await updateRow(
        userId,
        newRow,
        [...new Set([...newRow.document_ids, documentId])],
      );
    }
  }
}

/**
 * Unlink a document: clear its linked_id, then (when the parent tracks
 * document_ids) remove it from the parent's list.
 */
async function unlinkDocFromParent<T extends RowWithDocs>(
  userId: string,
  documentId: string,
  parentId: string,
  fetchRows?: (userId: string) => Promise<T[]>,
  updateRow?: (userId: string, row: T, documentIds: string[]) => Promise<unknown>,
): Promise<void> {
  const docs = await fetchDocuments(userId);
  const doc = docs.find((d) => d.id === documentId);
  if (!doc) return;
  const nowIso = new Date().toISOString();
  await updateDocument(userId, documentId, {
    ...doc,
    linked_id: "",
    updated_at: nowIso,
  } as DocumentPlaintext);

  if (parentId && fetchRows && updateRow) {
    const rows = await fetchRows(userId);
    const parent = rows.find((r) => r.id === parentId);
    if (parent) {
      await updateRow(
        userId,
        parent,
        parent.document_ids.filter((id) => id !== documentId),
      );
    }
  }
}

/**
 * Bulk-link documents to a parent: set each document's linked_id, then (when
 * the parent tracks document_ids) merge the ids into the parent's list.
 */
async function bulkLinkDocsToParent<T extends RowWithDocs>(
  userId: string,
  documentIds: string[],
  parentId: string,
  fetchRows?: (userId: string) => Promise<T[]>,
  updateRow?: (userId: string, row: T, documentIds: string[]) => Promise<unknown>,
): Promise<void> {
  const docs = await fetchDocuments(userId);
  const nowIso = new Date().toISOString();
  for (const docId of documentIds) {
    const doc = docs.find((d) => d.id === docId);
    if (doc) {
      await updateDocument(userId, docId, {
        ...doc,
        linked_id: parentId,
        updated_at: nowIso,
      } as DocumentPlaintext);
    }
  }

  if (fetchRows && updateRow) {
    const rows = await fetchRows(userId);
    const parent = rows.find((r) => r.id === parentId);
    if (parent) {
      await updateRow(
        userId,
        parent,
        [...new Set([...parent.document_ids, ...documentIds])],
      );
    }
  }
}

/** Save a vault personal record + execute its file mutations (records section). */
async function saveVaultRecordWithFiles(
  userId: string,
  existing: PersonalRecord | null,
  formData: Record<string, unknown>,
  fileActions: FileActions,
  allDocuments: Document[],
): Promise<PersonalRecord> {
  const name = (formData.name as string).trim();
  const value = (formData.value as string).trim();
  if (!name || !value) throw new Error("Name and value are required.");

  const nowIso = new Date().toISOString();
  const plaintext: PersonalRecordPlaintext = {
    section: "records",
    name,
    value,
    updated_at: nowIso,
  };
  const saved = existing
    ? ((await updateVaultEntry(userId, existing.id, plaintext)) as PersonalRecord)
    : ((await createVaultEntry(userId, plaintext)) as PersonalRecord);

  for (const docId of fileActions.docsToDelete) {
    const doc = allDocuments.find((d) => d.id === docId);
    if (doc) {
      if (doc.file_name) {
        try {
          await deleteFile(userId, doc.file_name);
        } catch {
          /* best-effort */
        }
      }
      try {
        await deleteDocument(docId);
      } catch {
        /* best-effort */
      }
    }
  }
  for (const docId of fileActions.docsToUnlink) {
    const doc = allDocuments.find((d) => d.id === docId);
    if (doc) {
      try {
        await updateDocument(userId, docId, {
          ...doc,
          linked_id: "",
          updated_at: nowIso,
        } as DocumentPlaintext);
      } catch {
        /* best-effort */
      }
    }
  }
  for (const nf of fileActions.newFiles) {
    try {
      const { fileName, iv, mimeType } = await uploadFile(userId, nf.file);
      await createDocument(userId, {
        label: nf.label,
        file_name: fileName,
        file_iv: iv,
        file_mime: mimeType,
        domain: "vault",
        linked_id: saved.id,
        updated_at: nowIso,
      });
    } catch {
      /* best-effort */
    }
  }
  for (const docId of fileActions.docsToLink) {
    const doc = allDocuments.find((d) => d.id === docId);
    if (doc) {
      try {
        await updateDocument(userId, docId, {
          ...doc,
          linked_id: saved.id,
          updated_at: nowIso,
        } as DocumentPlaintext);
      } catch {
        /* best-effort */
      }
    }
  }

  return saved;
}

/** Delete a vault personal record, cascading its attached documents. */
async function deleteVaultRecordWithFiles(
  userId: string,
  recordId: string,
): Promise<void> {
  const attached = (await fetchDocuments(userId)).filter(
    (d) => d.domain === "vault" && d.linked_id === recordId,
  );
  for (const doc of attached) {
    if (doc.file_name) {
      try {
        await deleteFile(userId, doc.file_name);
      } catch {
        /* best-effort */
      }
    }
    try {
      await deleteDocument(doc.id);
    } catch {
      /* best-effort */
    }
  }
  await deleteVaultEntry(recordId);
}

/** Fetch a bank entry by id (vault_bank_details). */
async function fetchBankById(userId: string, bankId: string): Promise<BankEntry> {
  const entries = await fetchVaultEntriesBySection(userId, "banks");
  const bank = entries.find((e) => e.id === bankId) as BankEntry | undefined;
  if (!bank) throw new Error("Bank not found.");
  return bank;
}

// ============================================================
// Doc-store adapters
// ============================================================

const taskmanagerAdapter: DocStoreAdapter<Note> = {
  storeType: "doc",
  domain: "taskmanager",
  modalTitle: (record) => (record ? "Edit note" : "Add note"),
  modalInitialData: (record) => ({
    name: record?.name ?? "",
    content: record?.content ?? "",
  }),
  modalAllowFiles: true,
  modalAllowLinking: true,
  modalDeleteLabel: "Delete",
  modalDeleteKind: "cascade",
  emptyMessage: "No documents uploaded yet. Add your first file.",
  searchPlaceholder: "Search files...",
  fetchData: async (userId) => {
    const [rows, documents] = await Promise.all([
      fetchNotes(userId),
      fetchDocuments(userId),
    ]);
    return { rows, documents };
  },
  deriveParentRecords: (rows) =>
    rows.map((n) => ({ id: n.id, name: n.name?.trim() || "Untitled Note" })),
  saveRecord: async (userId, record, formData, fileActions) => {
    const name = (formData.name as string).trim();
    if (!name) throw new Error("Note name is required.");
    const content = (formData.content as string).trim();
    return saveDocLinkedRecord<Note, NotePlaintext>(
      userId,
      record,
      fileActions,
      "taskmanager",
      fetchNotes,
      createNote,
      updateNote,
      (documentIds) => ({
        name,
        content,
        document_ids: documentIds,
        updated_at: new Date().toISOString(),
      }),
    );
  },
  deleteRecord: (userId, record, cascadeMode) =>
    deleteDocLinkedRecord(userId, "taskmanager", record.id, cascadeMode, deleteNote),
  createParent: async (userId, data) => {
    const note = await createNote(userId, {
      name: data.name || "",
      content: data.content || "",
      document_ids: [],
      updated_at: new Date().toISOString(),
    });
    return note.id;
  },
  deleteParent: (userId, parentId) => deleteNote(parentId),
  unlinkFromParent: (userId, documentId, parentId) =>
    unlinkDocFromParent<Note>(
      userId,
      documentId,
      parentId,
      fetchNotes,
      (uid, row, documentIds) =>
        updateNote(uid, row.id, {
          name: row.name,
          content: row.content,
          document_ids: documentIds,
          updated_at: new Date().toISOString(),
        }),
    ),
  bulkLinkToParent: (userId, documentIds, parentId) =>
    bulkLinkDocsToParent<Note>(
      userId,
      documentIds,
      parentId,
      fetchNotes,
      (uid, row, documentIds) =>
        updateNote(uid, row.id, {
          name: row.name,
          content: row.content,
          document_ids: documentIds,
          updated_at: new Date().toISOString(),
        }),
    ),
  syncDocumentSaved: (userId, documentId, newLinkedId, oldLinkedId) =>
    syncDocParentIds<Note>(
      userId,
      documentId,
      newLinkedId,
      oldLinkedId,
      fetchNotes,
      (uid, row, documentIds) =>
        updateNote(uid, row.id, {
          name: row.name,
          content: row.content,
          document_ids: documentIds,
          updated_at: new Date().toISOString(),
        }),
    ),
};

const educationAdapter: DocStoreAdapter<Education> = {
  storeType: "doc",
  domain: "education",
  modalLayout: EDUCATION_LAYOUT,
  modalTitle: (record) => (record ? "Edit education" : "Add education"),
  modalInitialData: (record) => ({
    name: record?.name ?? "",
    provider: record?.provider ?? "",
    priority: record?.priority ?? "medium",
    due_date: normalizeDateForInput(record?.due_date),
    description: record?.description ?? "",
    is_completed: record?.is_completed ?? false,
  }),
  modalAllowFiles: true,
  modalAllowLinking: true,
  modalDeleteLabel: "Delete",
  modalDeleteKind: "cascade",
  emptyMessage: "No certificates uploaded yet. Add your first certificate.",
  searchPlaceholder: "Search certificates...",
  fetchData: async (userId) => {
    const [rows, documents] = await Promise.all([
      fetchEducations(userId),
      fetchDocuments(userId),
    ]);
    return { rows, documents };
  },
  deriveParentRecords: (rows) => rows.map((e) => ({ id: e.id, name: e.name })),
  saveRecord: async (userId, record, formData, fileActions) => {
    const draft = {
      name: (formData.name as string) ?? "",
      provider: (formData.provider as string) ?? "",
      priority: (formData.priority as Priority) ?? "medium",
      due_date: (formData.due_date as string) || null,
      description: (formData.description as string) ?? "",
      is_completed: Boolean(formData.is_completed),
    };
    return saveDocLinkedRecord<Education, EducationPlaintext>(
      userId,
      record,
      fileActions,
      "education",
      fetchEducations,
      createEducation,
      updateEducation,
      (documentIds, freshRow) => ({
        ...draft,
        completed_at: draft.is_completed
          ? (freshRow?.completed_at ?? new Date().toISOString())
          : null,
        document_ids: documentIds,
        updated_at: new Date().toISOString(),
      }),
    );
  },
  deleteRecord: (userId, record, cascadeMode) =>
    deleteDocLinkedRecord(userId, "education", record.id, cascadeMode, deleteEducation),
  createParent: async (userId, data) => {
    const nowIso = new Date().toISOString();
    const isCompleted = data.is_completed === "true";
    const edu = await createEducation(userId, {
      name: data.name || "",
      provider: data.provider || "",
      priority: (data.priority as Priority) || "medium",
      due_date: data.due_date || null,
      description: data.description || "",
      is_completed: isCompleted,
      completed_at: isCompleted ? nowIso : null,
      document_ids: [],
      updated_at: nowIso,
    });
    return edu.id;
  },
  deleteParent: (userId, parentId) => deleteEducation(parentId),
  unlinkFromParent: (userId, documentId, parentId) =>
    unlinkDocFromParent<Education>(
      userId,
      documentId,
      parentId,
      fetchEducations,
      (uid, row, documentIds) =>
        updateEducation(uid, row.id, {
          name: row.name,
          provider: row.provider,
          priority: row.priority,
          due_date: row.due_date,
          description: row.description,
          is_completed: row.is_completed,
          completed_at: row.completed_at,
          document_ids: documentIds,
          updated_at: new Date().toISOString(),
        }),
    ),
  bulkLinkToParent: (userId, documentIds, parentId) =>
    bulkLinkDocsToParent<Education>(
      userId,
      documentIds,
      parentId,
      fetchEducations,
      (uid, row, documentIds) =>
        updateEducation(uid, row.id, {
          name: row.name,
          provider: row.provider,
          priority: row.priority,
          due_date: row.due_date,
          description: row.description,
          is_completed: row.is_completed,
          completed_at: row.completed_at,
          document_ids: documentIds,
          updated_at: new Date().toISOString(),
        }),
    ),
  syncDocumentSaved: (userId, documentId, newLinkedId, oldLinkedId) =>
    syncDocParentIds<Education>(
      userId,
      documentId,
      newLinkedId,
      oldLinkedId,
      fetchEducations,
      (uid, row, documentIds) =>
        updateEducation(uid, row.id, {
          name: row.name,
          provider: row.provider,
          priority: row.priority,
          due_date: row.due_date,
          description: row.description,
          is_completed: row.is_completed,
          completed_at: row.completed_at,
          document_ids: documentIds,
          updated_at: new Date().toISOString(),
        }),
    ),
};

const expenseAdapter: DocStoreAdapter<Expense> = {
  storeType: "doc",
  domain: "expense",
  modalTitle: (record) => (record ? "Edit expense" : "Add expense"),
  modalInitialData: (record) => ({
    item: record?.item ?? "",
    seller: record?.seller ?? "",
    cost: record ? String(record.cost) : "",
    date: normalizeDateForInput(record?.date),
    reason: record?.reason ?? "",
  }),
  modalAllowFiles: true,
  modalAllowLinking: false,
  modalDeleteLabel: "Delete",
  modalDeleteKind: "cascade",
  emptyMessage: "No receipts in the store yet.",
  searchPlaceholder: "Search receipts...",
  fetchData: async (userId) => {
    const [rows, documents] = await Promise.all([
      fetchExpenses(userId),
      fetchDocuments(userId),
    ]);
    return { rows, documents };
  },
  deriveParentRecords: (rows) =>
    rows.map((e) => ({
      id: e.id,
      name: `${e.item}${e.seller ? ` — ${e.seller}` : ""} (₹${e.cost.toLocaleString("en-IN")})`,
    })),
  saveRecord: async (userId, record, formData, fileActions) => {
    const item = (formData.item as string).trim();
    if (!item) throw new Error("Item name is required.");
    const cost = parseFloat(formData.cost as string);
    if (isNaN(cost) || cost < 0) throw new Error("Please enter a valid cost.");
    const draft = {
      item,
      seller: (formData.seller as string).trim(),
      cost,
      date: (formData.date as string) || "",
      reason: (formData.reason as string).trim(),
    };
    return saveDocLinkedRecord<Expense, ExpensePlaintext>(
      userId,
      record,
      fileActions,
      "expense",
      fetchExpenses,
      createExpense,
      updateExpense,
      (documentIds) => ({
        ...draft,
        document_ids: documentIds,
        updated_at: new Date().toISOString(),
      }),
    );
  },
  deleteRecord: (userId, record, cascadeMode) =>
    deleteDocLinkedRecord(userId, "expense", record.id, cascadeMode, deleteExpense),
  deleteParent: (userId, parentId) => deleteExpense(parentId),
  syncDocumentSaved: (userId, documentId, newLinkedId, oldLinkedId) =>
    syncDocParentIds<Expense>(
      userId,
      documentId,
      newLinkedId,
      oldLinkedId,
      fetchExpenses,
      (uid, row, documentIds) =>
        updateExpense(uid, row.id, {
          item: row.item,
          seller: row.seller,
          cost: row.cost,
          date: row.date,
          reason: row.reason,
          document_ids: documentIds,
          updated_at: new Date().toISOString(),
        }),
    ),
};

const medicalAdapter: DocStoreAdapter<MedicalRecord> = {
  storeType: "doc",
  domain: "medical",
  modalTitle: (record) => (record ? "Edit medical record" : "Add medical record"),
  modalInitialData: (record) => ({
    name: record?.name ?? "",
    clinic: record?.clinic ?? "",
    date: record?.date ?? "",
    diagnosis_timeline: record?.diagnosis_timeline ?? "",
  }),
  modalAllowFiles: true,
  modalAllowLinking: false,
  modalDeleteLabel: "Delete",
  modalDeleteKind: "simple",
  emptyMessage: "No medical documents yet.",
  searchPlaceholder: "Search documents...",
  fetchData: async (userId) => {
    const [rows, documents] = await Promise.all([
      fetchMedicalRecords(userId),
      fetchDocuments(userId),
    ]);
    return { rows, documents };
  },
  deriveParentRecords: (rows) => rows.map((r) => ({ id: r.id, name: r.name })),
  saveRecord: async (userId, record, formData, fileActions) => {
    const name = (formData.name as string).trim();
    if (!name) throw new Error("Record name is required.");
    const draft = {
      name,
      clinic: (formData.clinic as string).trim(),
      date: (formData.date as string) || "",
      diagnosis_timeline: (formData.diagnosis_timeline as string).trim(),
    };
    return saveDocLinkedRecord<MedicalRecord, MedicalPlaintext>(
      userId,
      record,
      fileActions,
      "medical",
      fetchMedicalRecords,
      createMedicalRecord,
      updateMedicalRecord,
      (documentIds) => ({
        ...draft,
        document_ids: documentIds,
        updated_at: new Date().toISOString(),
      }),
    );
  },
  deleteRecord: (userId, record) =>
    deleteDocLinkedRecord(userId, "medical", record.id, "cascade", deleteMedicalRecord),
  deleteParent: (userId, parentId) => deleteMedicalRecord(parentId),
  syncDocumentSaved: (userId, documentId, newLinkedId, oldLinkedId) =>
    syncDocParentIds<MedicalRecord>(
      userId,
      documentId,
      newLinkedId,
      oldLinkedId,
      fetchMedicalRecords,
      (uid, row, documentIds) =>
        updateMedicalRecord(uid, row.id, {
          name: row.name,
          clinic: row.clinic,
          date: row.date,
          diagnosis_timeline: row.diagnosis_timeline,
          document_ids: documentIds,
          updated_at: new Date().toISOString(),
        }),
    ),
};

/** `/vault/documents` — documents linked to vault personal records. */
const vaultAdapter: DocStoreAdapter<PersonalRecord> = {
  storeType: "doc",
  domain: "vault",
  modalTitle: (record) => (record ? "Edit Record" : "Add Record"),
  modalInitialData: (record) => ({
    name: record?.name ?? "",
    value: record?.value ?? "",
  }),
  modalAllowFiles: true,
  modalAllowLinking: true,
  modalDeleteLabel: "Delete Record",
  modalDeleteKind: "simple",
  emptyMessage: "No documents in the vault.",
  searchPlaceholder: "Search files...",
  fetchData: async (userId) => {
    const [rows, documents] = await Promise.all([
      fetchVaultEntriesBySection(userId, "records") as Promise<PersonalRecord[]>,
      fetchDocuments(userId),
    ]);
    return { rows, documents };
  },
  deriveParentRecords: (rows) => rows.map((r) => ({ id: r.id, name: r.name })),
  saveRecord: (userId, record, formData, fileActions, allDocuments) =>
    saveVaultRecordWithFiles(userId, record, formData, fileActions, allDocuments),
  deleteRecord: (userId, record) => deleteVaultRecordWithFiles(userId, record.id),
  createParent: async (userId, data) => {
    const entry = await createVaultEntry(userId, {
      section: "records",
      name: data.name || "",
      value: data.value || "",
      updated_at: new Date().toISOString(),
    } as PersonalRecordPlaintext);
    return entry.id;
  },
  unlinkFromParent: (userId, documentId) =>
    unlinkDocFromParent(userId, documentId, ""),
  bulkLinkToParent: (userId, documentIds, parentId) =>
    bulkLinkDocsToParent(userId, documentIds, parentId),
};

// ============================================================
// Record-store adapters
// ============================================================

const passwordsAdapter: RecordStoreAdapter<PasswordEntry> = {
  storeType: "record",
  modalLayout: PASSWORD_LAYOUT,
  modalTitle: (record) => (record ? "Edit Credential" : "Add Credential"),
  modalInitialData: (record) => ({
    site_name: record?.site_name ?? "",
    username: record?.username ?? "",
    password: record?.password ?? "",
  }),
  modalDeleteLabel: "Delete Credential",
  modalMaxWidthClassName: "max-w-md",
  fetchData: async (userId) => ({
    rows: (await fetchVaultEntriesBySection(userId, "passwords")) as PasswordEntry[],
  }),
  mapRecordToItem: (p) => ({
    id: p.id,
    title: p.site_name,
    values: [
      { label: "Username", value: p.username },
      { label: "Password", value: p.password, isSecret: true },
    ],
  }),
  saveRecord: async (userId, record, formData) => {
    const siteName = (formData.site_name as string).trim();
    const username = (formData.username as string).trim();
    const password = (formData.password as string).trim();
    if (!siteName || !username || !password) {
      throw new Error("Site name, username, and password are required.");
    }
    const plaintext: PasswordEntryPlaintext = {
      section: "passwords",
      site_name: siteName,
      username,
      password,
      updated_at: new Date().toISOString(),
    };
    if (record) {
      return (await updateVaultEntry(userId, record.id, plaintext)) as PasswordEntry;
    }
    return (await createVaultEntry(userId, plaintext)) as PasswordEntry;
  },
  deleteRecord: (_userId, recordId) => deleteVaultEntry(recordId),
  bulkDeleteRecords: async (_userId, ids) => {
    for (const id of ids) await deleteVaultEntry(id);
  },
  itemName: "password",
  itemNamePlural: "passwords",
  emptyMessage: "No passwords stored yet. Add your first credential.",
  searchPlaceholder: "Search passwords...",
};

const recordsAdapter: RecordStoreAdapter<PersonalRecord> = {
  storeType: "record",
  domain: "vault",
  modalTitle: (record) => (record ? "Edit Record" : "Add Record"),
  modalInitialData: (record) => ({
    name: record?.name ?? "",
    value: record?.value ?? "",
  }),
  modalDeleteLabel: "Delete Record",
  allowFiles: true,
  fetchData: async (userId) => {
    const [rows, documents] = await Promise.all([
      fetchVaultEntriesBySection(userId, "records") as Promise<PersonalRecord[]>,
      fetchDocuments(userId),
    ]);
    return { rows, documents };
  },
  mapRecordToItem: (r, documents) => ({
    id: r.id,
    title: r.name,
    values: [{ value: r.value }],
    hasFiles: documents.some((d) => d.linked_id === r.id && d.domain === "vault"),
  }),
  saveRecord: (userId, record, formData, fileActions, allDocuments) =>
    saveVaultRecordWithFiles(userId, record, formData, fileActions, allDocuments),
  deleteRecord: (userId, recordId) => deleteVaultRecordWithFiles(userId, recordId),
  bulkDeleteRecords: async (userId, ids) => {
    for (const id of ids) await deleteVaultRecordWithFiles(userId, id);
  },
  itemName: "record",
  tileLayout: "body-only",
};

const banksAdapter: RecordStoreAdapter<BankEntry> = {
  storeType: "record",
  modalLayout: BANK_LAYOUT,
  modalTitle: (record) => (record ? "Edit Bank" : "Add Bank"),
  modalInitialData: (record) => ({ bank_name: record?.bank_name ?? "" }),
  modalDeleteLabel: "Delete Bank",
  modalMaxWidthClassName: "max-w-md",
  fetchData: async (userId) => ({
    rows: (await fetchVaultEntriesBySection(userId, "banks")) as BankEntry[],
  }),
  mapRecordToItem: (b) => ({
    id: b.id,
    title: b.bank_name,
    values: [{ label: "PINs", value: `${b.pins.length} saved`, isCopyable: false }],
  }),
  getRowHref: (b) => ROUTES.VAULT_BANK_DETAIL(b.id),
  saveRecord: async (userId, record, formData) => {
    const name = (formData.bank_name as string).trim();
    if (!name) throw new Error("Bank name is required.");
    const plaintext: BankEntryPlaintext = {
      section: "banks",
      bank_name: name,
      pins: record?.pins ?? [],
      updated_at: new Date().toISOString(),
    };
    if (record) {
      return (await updateVaultEntry(userId, record.id, plaintext)) as BankEntry;
    }
    return (await createVaultEntry(userId, plaintext)) as BankEntry;
  },
  deleteRecord: (_userId, recordId) => deleteVaultEntry(recordId),
  bulkDeleteRecords: async (_userId, ids) => {
    for (const id of ids) await deleteVaultEntry(id);
  },
  itemName: "bank account",
  itemNamePlural: "bank accounts",
  singleDeleteDescription:
    "This will permanently delete this bank entry and all its PINs. This action cannot be undone.",
  emptyMessage: "No banks added yet. Add your first bank.",
  searchPlaceholder: "Search banks...",
};

/** `/vault/banks/[bankId]` — PINs mapped to a bank entry (scope-scoped). */
function buildBankDetailsAdapter(scope?: Record<string, string>): RecordStoreAdapter<BankPinData> {
  const bankId = scope?.bankId ?? "";
  return {
    storeType: "record",
    modalLayout: PIN_LAYOUT,
    modalTitle: (record) => (record ? "Edit PIN" : "Add PIN"),
    modalInitialData: (record) => ({
      name: record?.name ?? "",
      pin: record?.pin ?? "",
    }),
    modalDeleteLabel: "Delete PIN",
    modalMaxWidthClassName: "max-w-md",
    fetchData: async (userId) => {
      const bank = await fetchBankById(userId, bankId);
      return {
        rows: (bank.pins ?? []).map((p) => ({ id: p.id, name: p.name, pin: p.pin })),
        pageTitle: bank.bank_name,
      };
    },
    mapRecordToItem: (pin) => ({
      id: pin.id,
      title: pin.name,
      values: [{ value: pin.pin, isSecret: true }],
    }),
    saveRecord: async (userId, record, formData) => {
      const name = (formData.name as string).trim();
      const pin = (formData.pin as string).trim();
      if (!name || !pin) throw new Error("Name and PIN are required.");
      const bank = await fetchBankById(userId, bankId);
      const saved: BankPinData = {
        id: record?.id ?? crypto.randomUUID(),
        name,
        pin,
      };
      const newPins = bank.pins.some((p) => p.id === saved.id)
        ? bank.pins.map((p) => (p.id === saved.id ? saved : p))
        : [...bank.pins, saved];
      await updateVaultEntry(userId, bank.id, {
        section: "banks",
        bank_name: bank.bank_name,
        pins: newPins,
        updated_at: new Date().toISOString(),
      } as BankEntryPlaintext);
      return saved;
    },
    deleteRecord: async (userId, recordId) => {
      const bank = await fetchBankById(userId, bankId);
      await updateVaultEntry(userId, bank.id, {
        section: "banks",
        bank_name: bank.bank_name,
        pins: bank.pins.filter((p) => p.id !== recordId),
        updated_at: new Date().toISOString(),
      } as BankEntryPlaintext);
    },
    bulkDeleteRecords: async (userId, ids) => {
      const bank = await fetchBankById(userId, bankId);
      const idsSet = new Set(ids);
      await updateVaultEntry(userId, bank.id, {
        section: "banks",
        bank_name: bank.bank_name,
        pins: bank.pins.filter((p) => !idsSet.has(p.id)),
        updated_at: new Date().toISOString(),
      } as BankEntryPlaintext);
    },
    itemName: "PIN",
    emptyMessage: "No PINs added yet.",
    searchPlaceholder: "Search PINs...",
    tileLayout: "body-only",
  };
}

// ============================================================
// Registry
// ============================================================

export function getStoreAdapter(
  domain: StoreDomainKey,
  scope?: Record<string, string>,
): StoreAdapter {
  switch (domain) {
    case "taskmanager":
      return taskmanagerAdapter;
    case "education":
      return educationAdapter;
    case "expense":
      return expenseAdapter;
    case "medical":
      return medicalAdapter;
    case "vault":
      return vaultAdapter;
    case "vault_passwords":
      return passwordsAdapter;
    case "vault_records":
      return recordsAdapter;
    case "vault_banks":
      return banksAdapter;
    case "vault_bank_details":
      return buildBankDetailsAdapter(scope);
  }
}
