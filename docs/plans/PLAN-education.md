# Plan: Education Domain Implementation

**Date**: 2026-07-07
**Status**: Draft

## Goal
Implement a new "Education" domain for tracking courses and certifications. The UI will follow the Task Manager's 3-box layout, replacing the "Notes" section with a "Certificate Store". Users can attach multiple encrypted files (certificates) to a completed education record, or upload certificates independently to the store. The file upload and encryption will follow the exact same architecture as the Expense manager's invoice uploads.

## Reusable Inventory (from existing codebase)
| Element | Path | How it's reused |
|---------|------|-----------------|
| `encryptBlob` / `decryptBlob` | `src/lib/crypto/index.ts` | Used to encrypt and decrypt certificate files before/after S3 upload. |
| `encryptField` / `decryptField` | `src/lib/crypto/index.ts` | Used to encrypt database row data for educations and certificates. |
| 3-Box Layout Pattern | `src/components/taskmanager/*` | The visual layout structure will be mirrored for Education. |
| S3 Storage Pattern | `src/api/expense/invoiceStorage.ts` | The exact API design will be replicated for `certificateStorage.ts`. |
| `useLocalStorage` | `src/lib/useLocalStorage.ts` | For remembering the user's preferred view (months vs priority). |

## Package Decisions
| Package | Version | Decision | Reason |
|---------|---------|----------|--------|
| - | - | None | No new packages required. We are relying entirely on the existing `@supabase/supabase-js` and `hash-wasm` implementations already in the workspace. |

## ⚠️ Flagged Observations
- Certificates are treated as raw file uploads (no additional metadata fields like Issuer/Date), matching the user's request that it's just "multi-file support". They will be treated as independent entities in the database to support linking from both the Education modal and the standalone Certificate modal.

## Phases & Tasks

### Phase 1 — Types and Database API
#### Task 1.1 — Define Types
- **What**: Create `Education` and `Certificate` types (along with their Plaintext counterparts).
- **Where**: `src/types/education.ts`
- **Why**: Defines the data shapes for the encrypted blobs. `Education` will have an array of attached `certificate_ids`. `Certificate` will store filename, MIME type, and IV.

#### Task 1.2 — Certificate Storage API
- **What**: Replicate `invoiceStorage.ts` to handle certificate uploads/downloads.
- **Where**: `src/api/education/certificateStorage.ts`
- **Why**: Handles chunking, encryption, and Supabase storage upload for certificates up to 45MB.

#### Task 1.3 — Entity APIs
- **What**: Create CRUD methods for `educations` and `certificates`.
- **Where**: `src/api/education/educations.ts` & `src/api/education/certificates.ts`
- **Why**: Interface with the Supabase `educations` and `certificates` tables, encrypting the JSON payload for each row.

### Phase 2 — Core UI Components
#### Task 2.1 — Box Components
- **What**: Create `ActiveEducationBox`, `CompletedEducationBox`, and `CertificateStoreBox`.
- **Where**: `src/components/education/`
- **Why**: Builds the 3 main grid items for the dashboard.
- **Reuse**: The CSS structure and table/list views from `ActiveTasksBox` and `NotesBox`.

#### Task 2.2 — Modals
- **What**: Create `EducationModal` and `CertificateModal`.
- **Where**: `src/components/education/`
- **Why**: Allows users to create/edit educations and independently upload certificates. The `EducationModal` will support linking/uploading multiple certificates if marked as completed. The `CertificateModal` will support linking to existing completed educations.

### Phase 3 — Page Assembly and Routing
#### Task 3.1 — Main View Wiring
- **What**: Create `EducationView` that coordinates state and fetching.
- **Where**: `src/components/education/EducationView.tsx`
- **Why**: The controller component for the feature, mimicking `TaskManagerView`.

#### Task 3.2 — Page and Route
- **What**: Add the Next.js App Router page and update centralized routes.
- **Where**: `src/app/(protected)/education/page.tsx` and `src/routes/paths.ts`
- **Why**: Exposes the feature to the user.

## New Reusable Components Introduced
| Component | Path | Purpose | Reusable for |
|-----------|------|---------|--------------|
| FileUploadList | `src/components/common/FileUploadList.tsx` (optional) | Abstracted UI for attaching multiple files | Any future domain needing multi-file uploads |

## Verification Plan
- [ ] Verify that a user can create an Active Education record.
- [ ] Verify that completing an Education record allows uploading up to N certificates.
- [ ] Verify that standalone certificates can be uploaded to the Certificate Store.
- [ ] Verify that files up to 45MB can be encrypted, uploaded, downloaded, and decrypted correctly.
