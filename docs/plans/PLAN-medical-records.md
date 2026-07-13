# Plan: Medical Records & Global Document Store

**Date**: 2026-07-13
**Status**: Complete

## Goal
Implement a new Medical Records domain (with fields: name, clinic/hospital, date, diagnosis timeline, and files) that shares the UI interface of Education but without a "completed" section. Concurrently, extract the "Store" from Education into a completely independent Global Document Store, refactoring the database to use a single generic `documents` table. This Global Store will then be integrated into Education, Expense, and the new Medical domains. Finally, introduce a global Rich Text Editor to support basic formatting (font size, bullets, numbering, highlight, justification) for all timeline and description fields.

## Reusable Inventory (from existing codebase)
| Element | Path | How it's reused |
|---------|------|-----------------|
| `TileView`, `DocumentTile` | `src/components/common/TileView.tsx` | Used to render the grid of documents in the Global Store. |
| `BoxContainer` | `src/components/common/BoxContainer.tsx` | Used for laying out the Medical active records box. |
| `BackButton` | `src/components/common/BackButton.tsx` | Used for navigation in the new Medical and Store pages. |
| `ErrorBanner`, `LoadingSpinner` | `src/components/common/` | Standardized error and loading states. |
| `GenericActiveBox` | `src/components/common/GenericActiveBox.tsx` | Will be used to render the list of active medical records (no completed box needed). |
| `useAuthBootstrap` | `src/lib/useAuthBootstrap.ts` | Used for auth enforcement and data loading on Medical page. |
| Crypto Utils | `src/lib/crypto.ts` | Standard payload encryption/decryption for Medical records and Documents. |

## Package Decisions
| Package | Version | Decision | Reason |
|---------|---------|----------|--------|
| `@tiptap/react` | Latest | New | Industry standard headless React rich-text editor for modern apps. |
| `@tiptap/starter-kit` | Latest | New | Provides basic formatting (bold, italic, bullets, numbering). |
| `@tiptap/extension-text-align` | Latest | New | Provides text justification. |
| `@tiptap/extension-highlight` | Latest | New | Provides text highlighting. |
| `@tiptap/extension-text-style` | Latest | New | Prerequisite for font size/style custom formatting. |

## ⚠️ Flagged Observations
- **Data Migration**: Migrating Expense from inline `invoice_file` to the new `documents` array structure means existing expenses with invoices will need to be manually re-uploaded or migrated via a script. The UI will expect the new `document_ids` array. 
- **Array Support**: We will manage the `document_ids` as an array of strings inside the encrypted plaintext blob for all domain records (Education, Expense, Medical).
- **Rich Text Storage**: The output of the Tiptap editor is typically raw HTML or JSON. We will store it as a stringified HTML representation within the encrypted `data` blob to easily render it back.

## Phases & Tasks

### Phase 0 — Rich Text Editor Implementation
#### Task 0.1 — Create Global Rich Text Component ✅
- **What**: Build `RichTextEditor.tsx` using Tiptap. Include a formatting toolbar (font size, bullets, numbering, highlight, justification).
- **Where**: `src/components/common/RichTextEditor.tsx`
- **Why**: Replaces standard text areas across all domains to allow rich formatting.

### Phase 1 — Global Document Store & API Extraction
#### Task 1.1 — Create Global Document Types ✅
- **What**: Create `src/types/document.ts` defining `DocumentPlaintext` (replacing `CertificatePlaintext`). It will have `label`, `file_name`, `file_iv`, `file_mime`, `domain` (education|expense|medical), `linked_id` (the parent ID), and `updated_at`.
- **Where**: `src/types/document.ts`
- **Why**: Standardizes the document type for all domains.

#### Task 1.2 — Refactor Document API ✅
- **What**: Move and rename `certificates.ts` and `certificateStorage.ts` from `src/api/education/` to `src/api/common/`. Rename them to `documents.ts` and `documentStorage.ts`. Update the API to query the `documents` Supabase table instead of `certificates`.
- **Where**: `src/api/common/documents.ts`, `src/api/common/documentStorage.ts`
- **Why**: Makes the API globally accessible.

#### Task 1.3 — Create Global Store Components ✅
- **What**: Move `CertificateStoreView.tsx` to `src/components/common/store/GlobalStoreView.tsx` and refactor it to accept a generic `domain` prop. It will fetch documents using the new API.
- **Where**: `src/components/common/store/GlobalStoreView.tsx`, `src/components/common/store/StoreDocumentModal.tsx`
- **Why**: Extracts the Store out of Education so it can be reused anywhere.

### Phase 2 — Refactor Existing Domains to use Global Store & Rich Text
#### Task 2.1 — Update Education Domain ✅
- **What**: Update `EducationPlaintext` to rename `certificate_ids` to `document_ids`. Update `EducationModal` to use the new `StoreDocumentModal` and the new `RichTextEditor` for the description field. Replace the route `src/app/education/store/page.tsx` to render `<GlobalStoreView domain="education" />`. Remove old certificate components.
- **Where**: `src/types/education.ts`, `src/components/education/`, `src/app/education/store/page.tsx`
- **Why**: Completes the decoupling of the Store from Education and upgrades the text area.

#### Task 2.2 — Update Expense Domain ✅
- **What**: Update `ExpensePlaintext` to remove `invoice_file`, `invoice_iv`, `invoice_mime` and add `document_ids: string[]`. Update `ExpenseModal.tsx` to support the new document attachment flow and use `RichTextEditor` for the reason field.
- **Where**: `src/types/expense.ts`, `src/components/expense/ExpenseModal.tsx`, `src/api/expense/expenses.ts`
- **Why**: Integrates Expense with the Global Store and rich formatting.

#### Task 2.3 — Update Task Manager Domain ✅
- **What**: Update task creation modal (`TaskModal.tsx`) to use the new `RichTextEditor` for the task description field.
- **Where**: `src/components/taskmanager/TaskModal.tsx`
- **Why**: Ensures all 4 domains (Medical, Education, Expense, Task Manager) have consistent rich-text descriptive fields.

### Phase 3 — Implement Medical Records Domain
#### Task 3.1 — Medical API and Types ✅
- **What**: Create `MedicalPlaintext` type (name, clinic, date, diagnosis_timeline, document_ids). Create CRUD API fetching from the `medical_records` table.
- **Where**: `src/types/medical.ts`, `src/api/medical/records.ts`

#### Task 3.2 — Medical UI Components ✅
- **What**: Build `MedicalView.tsx` (using `GenericActiveBox` to display records, NO completed box). Build `MedicalModal.tsx` to handle the form (name, clinic, date, and `RichTextEditor` for diagnosis timeline).
- **Where**: `src/components/medical/MedicalView.tsx`, `src/components/medical/MedicalModal.tsx`

#### Task 3.3 — Medical Routes ✅
- **What**: Create Next.js pages for the Medical dashboard and its Store.
- **Where**: `src/app/medical/page.tsx`, `src/app/medical/store/page.tsx` (renders `<GlobalStoreView domain="medical" />`)

## New Reusable Components Introduced
| Component | Path | Purpose | Reusable for |
|-----------|------|---------|--------------|
| `RichTextEditor` | `src/components/common/RichTextEditor.tsx` | Provides Tiptap-powered rich text formatting. | Any text area in the app. |
| `GlobalStoreView` | `src/components/common/store/GlobalStoreView.tsx` | Manages standalone and linked documents in a grid view. | Any future domain requiring file uploads. |
| `StoreDocumentModal` | `src/components/common/store/StoreDocumentModal.tsx` | The modal to upload, rename, and link a document. | Any future domain requiring file uploads. |

## Verification Plan
- [ ] Verify `documents` table rename works without losing existing certificates.
- [ ] Test uploading a standalone document in the Education Store.
- [ ] Test attaching an existing document to a new Expense.
- [ ] Test creating a Medical Record with rich text (bold, highlight, bullets) and an uploaded file.
- [ ] Ensure Medical Record page has no "Completed" section or tab.
