# Plan: Education Store Rename & Bulk Actions

**Date**: 2026-07-12
**Status**: Complete

## Goal
Implement two highly requested quality-of-life features in the Education Certificate Store:
1. **Inline File Rename**: A pencil icon directly next to filenames in the Store TileView and GlobalActionModal allowing for rapid, frictionless renaming without opening a full edit form.
2. **Bulk Actions**: Checkboxes on files allowing users to batch rename (with automatic numeric suffixes), batch delete (with a unified cascade dialog), and batch link unlinked files to a single education record.

## Reusable Inventory (from existing codebase)
| Element | Path | How it's reused |
|---------|------|-----------------|
| `updateCertificate`, `deleteCertificate`, `deleteEducation` | `src/api/education/` | Reused for executing the rename, delete, and link actions individually and in batch. |
| `getUniqueFileName` | `src/components/education/helpers.ts` | Used during Bulk Rename to safely append `(1)`, `(2)`, etc. while checking against the global taken names. |
| `ConfirmDialog` | `src/components/taskmanager/ConfirmDialog.tsx` | Reused for the bulk delete confirmation prompt. |
| `GlobalActionModal` | `src/components/common/GlobalActionModal.tsx` | Core modal framework, modified to support inline renaming. |

## Package Decisions
No new packages are required. We will use existing native React state and UI components, alongside icons from the already installed `lucide-react` library.

## ⚠️ Flagged Observations
- **Orphaned File Edge Case**: Bulk renaming (changing the label) correctly updates the database without abandoning files. However, the existing system leaves an orphaned file in R2 if a user uploads a *replacement* file for an existing certificate in `StoreCertificateModal`. This plan focuses purely on the requested UI features, but this is flagged for future cleanup.

## Phases & Tasks

### Phase 1 — Feature 1: Inline File Rename
#### Task 1.1 — TileView Rename UI ✅ Completed
- **What**: Add a `Pencil` icon next to the filename in both tile and list views. Clicking it transforms the text into an `<input>` field. Pressing Enter or clicking away triggers `onRenameConfirmed`.
- **Where**: `src/components/common/TileView.tsx`
- **Why**: Allows rapid renaming without losing context. Does not touch the existing action buttons (Download, Delete, Unlink).
- **New Artifacts**: None.

#### Task 1.2 — GlobalActionModal Rename UI ✅ Completed
- **What**: Add the same `Pencil` inline rename behavior to the right-panel file list in the modal.
- **Where**: `src/components/common/GlobalActionModal.tsx`
- **Why**: Extends the rename convenience to the modal view.

#### Task 1.3 — Hook up Rename Handlers ✅ Completed
- **What**: Implement the `onRenameConfirmed` callback in the main store view to hit the Supabase API. Ensure `StoreCertificateModal` and `EducationModal` propagate the rename state for unsaved files.
- **Where**: `src/components/education/CertificateStoreView.tsx`, `src/components/education/StoreCertificateModal.tsx`, `src/components/education/EducationModal.tsx`
- **Why**: Connects the UI to the data layer.

### Phase 2 — Feature 2: Bulk Selection UI
#### Task 2.1 — TileView Checkboxes ✅ Completed
- **What**: Add checkboxes to the top-left of the tile view, and the far-left of the list view. Add a "Select All" checkbox to the list view header. Pass `selectedIds`, `onSelectionChange`, and `onSelectAll` props.
- **Where**: `src/components/common/TileView.tsx`

#### Task 2.2 — Store View State & Action Bar ✅ Completed
- **What**: Add a floating/sticky action bar in the `CertificateStoreView` that appears when `selectedIds.size > 0`. It will contain the "Bulk Rename", "Bulk Delete", and "Bulk Link" buttons.
- **Where**: `src/components/education/CertificateStoreView.tsx`

### Phase 3 — Feature 2: Bulk Action Handlers
#### Task 3.1 — Bulk Rename Logic ✅ Completed
- **What**: Implement a small modal to prompt for a `Base Name`. Loop through `selectedIds`, pass the base name to `getUniqueFileName` to generate the suffix, and batch `updateCertificate` via `Promise.all`.
- **Where**: `src/components/education/CertificateStoreView.tsx`

#### Task 3.2 — Bulk Delete Logic ✅ Completed
- **What**: Implement a unified confirmation dialog. Check if *any* selected certificates are linked. If so, provide the "Delete associated record(s)" cascade checkbox. Execute batched deletions.
- **Where**: `src/components/education/CertificateStoreView.tsx`

#### Task 3.3 — Bulk Link Logic ✅ Completed
- **What**: The "Bulk Link" button is only enabled if all selected IDs belong to unlinked certificates. Create a new `BulkLinkModal` containing the searchable dropdown for educations. On save, batch update the selected certificates with the `education_id` and update the target education record's `certificate_ids`.
- **Where**: 
  - `src/components/education/CertificateStoreView.tsx`
  - `src/components/education/BulkLinkModal.tsx` (NEW)
- **New Artifacts**: `BulkLinkModal.tsx` — A highly reusable modal containing just the searchable education dropdown and a submit button.

## New Reusable Components Introduced
| Component | Path | Purpose | Reusable for |
|-----------|------|---------|--------------|
| `BulkLinkModal` | `src/components/education/BulkLinkModal.tsx` | Allows selecting a target education record from a searchable dropdown. | Any future flow requiring a user to "Move to" or "Link to" a specific education record en masse. |

## Verification Plan
- [ ] Verify pencil icon appears and works correctly in both Tile and List modes of `TileView`.
- [ ] Verify pencil icon appears and works correctly in `GlobalActionModal` right panel.
- [ ] Verify original Download, Unlink, and Delete icons are undisturbed.
- [ ] Select multiple items, verify action bar appears.
- [ ] Test Bulk Rename generates correct suffixes and updates UI.
- [ ] Test Bulk Delete properly cascades or unlinks based on checkbox.
- [ ] Test Bulk Link button enables only for unlinked files, and successfully attaches them to a target education.
