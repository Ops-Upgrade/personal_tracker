# Plan: Global Bug Fixes, Duplication Remediation & Modal Architecture

**Date**: 2026-07-10
**Status**: Combined

## Goal
Eliminate code duplication across the Task Manager, Education, and Expense domains by introducing shared components, hooks, utilities, and a generic encrypted file storage factory. Concurrently, standardize the entire application's modal architecture by implementing a single, reusable "Global Action Modal" (strict 50/50 Form/Files split), migrating all "View All" lists to dedicated routes, enforcing universal hash-driven state, and implementing a strict "Cancel = Undo" local queuing model. Furthermore, strictly remediate structural and UX discrepancies introduced during the modal implementation (e.g., fixing footer layouts, preventing modal height jumps, enforcing strict queueing lists).

## Reusable Inventory
| Element | Path | Purpose |
|---------|------|---------|
| `format.ts` | `src/lib/format.ts` | Shared formatting (`formatBytes`, `formatShortDate`) |
| `constants.ts` | `src/lib/constants.ts` | Centralized constants (e.g., `MONTH_NAMES`) |
| `viewHelpers.ts` | `src/lib/viewHelpers.ts` | Generic sort/group/trunc helpers |
| `encryptedFileStorage` | `src/api/common/encryptedFileStorage.ts` | Factory for encrypted upload/download/delete |
| `Icons` | `src/components/common/Icons.tsx` | Shared SVG Icons replacing inline definitions |
| `FileUploadZone` | `src/components/common/FileUploadZone.tsx` | Unified drag-and-drop file upload |
| `ErrorBanner` | `src/components/common/ErrorBanner.tsx` | Standard error display for views |
| `useAuthBootstrap` | `src/lib/useAuthBootstrap.ts` | Shared session fetching & loading logic |
| `useHashModal` | `src/lib/useHashModal.ts` | Shared hash listener boilerplate |
| `DocPreviewPanel` | `src/components/common/DocPreviewPanel.tsx` | Generic document preview logic |
| Generic List Views | `src/components/common/*Box.tsx` | Reusable layout for Active/Completed items |
| `GlobalActionModal` | `src/components/common/GlobalActionModal.tsx` | Unified 50/50 form/file editor (replaces ModalFrame) |
| `BackButton` | `src/components/common/BackButton.tsx` | Standardized back navigation for new routes |
| `ConfirmDialog` | `src/components/taskmanager/ConfirmDialog.tsx` | Target for Close button removal. |
| `CertificateStoreView` | `src/components/education/CertificateStoreView.tsx` | Needs standalone modal refactor. |

## ⚠️ Flagged Observations
- Extracting generic layout wrappers requires using a `renderItem` or `renderRow` prop to allow domain-specific card designs.
- `DocPreviewPanel` must accept a generic `onLoadPreview` function to support both Education and Expense domains.
- We must ensure complete cleanup of ghost files and strict adherence to shared constants.
- **State Management for Undo**: Since all text box changes and file deletions are deferred until "Save", the `GlobalActionModal` must maintain a robust internal draft state. 
- **Strict Local Queueing**: To enforce "Cancel = Undo", files MUST be queued locally in browser state (`File` objects). **No network requests for uploads or deletes may occur until "Save" is explicitly pressed.**
- **Lazy Loading Previews**: Deferring the actual fetching/loading of the file preview until the user clicks on it or navigates to it via `< >` will require adjusting how pre-signed URLs or blob URLs are fetched.
- **Height Calculation Jump**: The modal height increases because `DocPreviewPanel` attempts to render the PDF at a natural size. The right-side container must enforce strict CSS containment and the previewer must scale within absolute bounds to respect the left-side form's height.
- **Double Navigation Bars**: `GlobalActionModal` implemented a custom `< >` bar, but `DocPreviewPanel` also renders its own. We must eliminate the redundancy so exactly 1 bar exists.
- **Database Schema Analysis for Linking**: The current schema (`src/types/education.ts`) already supports `certificate_ids: string[]` on Education and `education_id: string` on Certificate. Therefore, implementing the "Link to existing record" feature **requires ZERO database schema changes**. It only requires executing the update API calls to sync the existing two fields.

## Phases & Tasks

### Part 1: Component Creation & Extraction

#### Phase 1 — Constants & Formatting Utilities
- **Task 1.1**: Consolidate `MONTH_NAMES`, `MAX_FILE_SIZE`, `ALLOWED_TYPES` to `src/lib/constants.ts` and `src/lib/fileConstants.ts`.
- **Task 1.2**: Extract `formatBytes` and `formatShortDate` to `src/lib/format.ts`.

#### Phase 2 — Shared Helpers & APIs
- **Task 2.1**: Create `src/api/common/encryptedFileStorage.ts` for unified upload/download/delete logic.
- **Task 2.2**: Consolidate view helpers (e.g., sort, group) in `src/lib/viewHelpers.ts`.

#### Phase 3 — Shared UI Components
- **Task 3.1**: Create `GlobalActionModal.tsx` to serve as the unified 50/50 split modal (Left Form, Right Files). Remove physical 'X' close buttons (rely on Cancel/ESC/Backdrop).
- **Task 3.2**: Consolidate SVG Icons into `src/components/common/Icons.tsx`. Add `< >` navigation icons for the new modal.
- **Task 3.3**: Create `FileUploadZone` with `EncryptedStorageNotice`.
- **Task 3.4**: Create a standard `ErrorBanner` and `BackButton`.

#### Phase 4 — Hooks & Complex UI
- **Task 4.1**: Extract `useHashModal` and `useAuthBootstrap`. Modify `useHashModal` to support deep linking for every CRUD operation globally.
- **Task 4.2**: Create `ActiveItemsBox`, `CompletedItemsBox`, and `GenericCompletedModal` generic structures.
- **Task 4.3**: Refactor `DocPreviewPanel` for generic usage and add lazy-loading capabilities.

### Part 2: Wiring Up & Cleanup

#### Phase 5 — Cleanup Leftovers & Strict Adoption
- **Task 5.1**: Ensure strict usage of `fileConstants.ts` and deduplicate constants.
- **Task 5.2**: Replace local `formatBytes` with `@/lib/format`.
- **Task 5.3**: Replace `invoiceStorage.ts` with a wrapper around `encryptedFileStorage`.
- **Task 5.4**: Delete ghost files (`src/api/expense/in`, `src/components/education/Education`).

#### Phase 6 — Wire Up Hooks & Extract "View All" Routes
- **Task 6.1**: Adopt `useAuthBootstrap` globally.
- **Task 6.2**: Move "View All" modals into dedicated Next.js routes (e.g., `/taskmanager/completed`, `/expense/all`) with the `BackButton`. Implement hash-driven routing (`#edit-[id]`) on all these pages.

#### Phase 7 — Structural Clones Integration
- **Task 7.1**: Create Generic Lists (`GenericActiveBox`, `GenericCompletedBox`).
- **Task 7.2**: Refactor TaskManager and Education layouts to consume the generic box wrappers.

### Part 3: Global Modal Architecture Integration

#### Phase 8 — TaskManager & Expense Migration
- **Task 8.1**: Migrate TaskManager (Tasks/Notes) to `GlobalActionModal`. Hide the right side entirely (form stretches 100%).
- **Task 8.2**: Migrate `ExpenseModal` to `GlobalActionModal`. Strip file upload out of the form fields to strictly live on the right-side panel.

#### Phase 9 — Education Domain Overhaul
- **Task 9.1**: Replace `EducationModal` and `CertificateModal` with a **single shared component** (`GlobalActionModal`). 
- **Task 9.2**: Implement Standalone File UX: Left side shows Dropdown (existing educations) + "OR" Form (create new). Selecting dropdown disables form. Existing standalone files hide "add another file".
- **Task 9.3**: Enforce "Save is Ultimate": Text/files save only on pressing "Save". Cancel = Absolute Undo. Files removed in edit view get a "marked for delete" chip instead of a cascade modal. Uploaded files auto-title to their filename and are locally queued.

#### Phase 10 — Record & Tile Delete UX
- **Task 10.1**: Update `ConfirmDialog` for full record deletion. Add a checkbox: "Delete associated files". (If checked, files deleted; if unchecked, files unlinked but kept).
- **Task 10.2**: Update Quick Delete on Store Tile view. Show confirmation with a checkbox: "Delete associated record". (If checked, record is also deleted; if unchecked, record is saved, file is unlinked then deleted).

### Part 4: Global Modal Strict Remediation

#### Phase 11 — Global UI/UX Fixes
- **Task 11.1 — Left-Anchored Footer Buttons**: Move the Save and Cancel buttons out of the modal-wide footer. They must be rendered strictly at the bottom of the **left** (form) half. (`src/components/common/GlobalActionModal.tsx`)
- **Task 11.2 — Strict Modal Height Constraint**: Prevent the modal height from increasing after a PDF preview is loaded. The left form dictates the natural height. The right side must stretch to match it and use `overflow-hidden` with the PDF scaled to fit inside. (`src/components/common/GlobalActionModal.tsx` & `DocPreviewPanel.tsx`)
- **Task 11.3 — Accurate `isDirty` Cancel Logic**: Ensure that pressing "Cancel" closes the modal instantly without a confirmation dialog **unless** there are actual unsaved changes. Parent Views must correctly compute and pass `isDirty`. (Parent Views & `GlobalActionModal.tsx`)
- **Task 11.4 — Drag-and-Drop Empty State**: Replace the simple "Upload file" button with the full `FileUploadZone` component (drag-and-drop space) that includes the specific "your files are encrypted" message. (`src/components/common/GlobalActionModal.tsx`)
- **Task 11.5 — Queued File List vs. Auto-Preview**: When a file is uploaded, do NOT instantly show the preview. Instead, display a list of uploaded/queued files on the right side, showing their names and an 'X' button beside them. The preview should only load if the user explicitly clicks on a file in the list. (`src/components/common/GlobalActionModal.tsx`)
- **Task 11.6 — Consolidate Top Bar & Action Buttons**: 1. Fix the "2 bars" issue: Remove duplicate `< >` and name bars so exactly 1 single bar exists above the preview. 2. Fix the `...` menu: Remove the 3-dot dropdown menu entirely. Replace it with 3 distinct action buttons side-by-side: **Unlink**, **Download**, **Delete**. (`src/components/common/GlobalActionModal.tsx`)
- **Task 11.7 — ConfirmDialog Close Behavior**: Completely remove the 'X' close button from all delete/other confirmation dialog boxes. Clicking outside the confirmation dialog is equivalent to pressing Cancel. (`src/components/taskmanager/ConfirmDialog.tsx`)

#### Phase 12 — Education Domain Re-Routing & Linking
- **Task 12.1 — Right-Side "Link File" Dropdown UI (For Standard Records)**: Inside a standard Education Record modal, replace the "Link file" button on the right side with a `<select>` dropdown menu populated with available unlinked files from the vault, paired immediately next to an "OK" button to confirm linkage. (`src/components/education/EducationView.tsx` / `GlobalActionModal.tsx`)
- **Task 12.2 — Standalone Certificate Modal Reuse**: Do NOT build a separate modal for standalone files. Ensure that clicking "Add" in the Store, or clicking an existing unlinked standalone file, explicitly renders the exact same **Education Record Modal Component** (`EducationModal`) used for standard records, passing it a specific prop (e.g., `isStandaloneMode={true}`) to enforce the following strict constraints:
  1. Only 1 file can be uploaded (no multi-file list).
  2. **No file label** input, and the word **"Standalone"** must NOT appear anywhere.
  3. **Left side top**: Add a label "link to existing record" with a searchable dropdown listing ALL education records (regardless of completion). Append a completion status chip to each item in the dropdown. Include a "Clear" button next to the dropdown to unselect.
  4. **Left side middle**: Render the text `--- or ---`.
  5. **Left side bottom**: Render the standard Add Education record form. If the dropdown above is selected, this form must be **disabled**. If the dropdown is cleared/empty, the form is **enabled**. (`src/components/education/CertificateStoreView.tsx` and the unified `EducationModal.tsx` component.)
- **Task 12.3 — Automatic Modal Upgrading (Re-Routing)**: Enforce strict modal re-routing for linked files. Any Education record (view/add/edit) must show the standard Education modal. Once a standalone file in the store is linked to a record, clicking on that file from the store must open the **Standard Education Modal** for the linked record, NOT the standalone "Link" modal from Task 12.2. (`src/components/education/CertificateStoreView.tsx`)

## Verification Plan
- [ ] TypeScript compilation passes without errors (`npm run build`).
- [ ] Linter passes with 0 errors and 0 warnings (`npm run lint`).
- [ ] No local `formatBytes`, `MONTH_NAMES`, or `MAX_FILE_SIZE` definitions remain.
- [ ] All modals trigger via specific URL hashes (`#edit-[id]`).
- [ ] Left form and right file panel match height precisely on desktop, and stack correctly on mobile.
- [ ] File previews lazy-load only upon clicking/navigating to them.
- [ ] "View All" routes load independently and Back buttons work.
- [ ] Removing a file in edit mode applies a "marked for delete" chip (no instant cascade modal).
- [ ] Text boxes and "marked for delete" chips properly revert on "Cancel" (after unsaved changes warning).
- [ ] Quick delete on tile view shows the "delete associated record" checkbox with correct branch logic.
- [ ] Deleting a full record inside the modal shows the "delete associated files" checkbox with correct branch logic.
- [ ] Standalone file logic handles the Dropdown OR Form toggling on the left side.
- [ ] Verify Save/Cancel buttons are constrained to the left column.
- [ ] Verify loading a 10-page PDF does not stretch the modal height beyond the form's height.
- [ ] Verify clicking Cancel on an untouched form closes instantly without confirmation.
- [ ] Verify empty state shows the drag-and-drop zone with the encryption notice.
- [ ] Verify uploading a file adds it to a queue list with an 'X', rather than instantly previewing.
- [ ] Verify only 1 top bar exists with Unlink/Download/Delete buttons explicitly exposed.
- [ ] Verify `ConfirmDialog` has no 'X' button and backdrop clicks trigger Cancel.
- [ ] Verify Store Standalone modal has no file label, no "Standalone" text, restricts to 1 file upload, and correctly implements the Dropdown OR Form logic on the left.
- [ ] Verify clicking a Store file that is already linked correctly opens the Standard Education Record Modal instead of the Standalone modal.
- [ ] Verify Database state updates correctly without requiring new migrations.
