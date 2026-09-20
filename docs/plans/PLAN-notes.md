# Plan: Notes Domain — OneNote/Obsidian Hybrid Canvas

**Date**: 2026-09-06
**Status**: Final — implementation-ready (Revision 4)
**Supersedes**: Revision 3 (2026-09-06, "Final — implementation-ready"), patched for three
data-integrity/first-paint bugs found in review. No architectural change from Revision 3 — this
is a targeted patch, not a rewrite.

This document is standalone. An implementing agent should not need to read Revision 1, 2, or 3 to
build this feature — everything locked in that matters is restated here as a contract, not as
review commentary.

## Changelog: Revision 3 → Revision 4 (this patch)

Three bugs were found in Revision 3 after it was marked final. All three are patched in place —
no task numbering changed, no new phases, no architecture change.

1. **Migration steal/skip logic was name-based, not identity-based (Task 0.1).** Matching a
   migrated page by `(notebook name, section name, first ~40 chars of title)` collides whenever
   two legacy notes start with the same text, and gives a re-run nothing reliable to check against
   after a crash. Fixed: every migrated page carries `migrated_from: <legacy note id>` in
   `PagePlaintext`. Skip/steal logic checks for an existing page with that exact `migrated_from`
   value — an operation-idempotent key, not a fuzzy text match. `notes_migration_lock` still has no
   `created_at` column — that is intentional, not an oversight; see the rewritten Task 0.1 for
   why, so nobody adds a phantom column at implementation time.
2. **Image garbage collection couldn't see pages outside the current session (Task 1.2/1.3).**
   The prior rule ("delete a `document_id` if no other page *currently open* references it") is
   wrong the moment an image is shared across a page in a different, unopened notebook — it gets
   deleted out from under a page nobody has looked at yet this session. Fixed: `PagePlaintext`
   gains `image_ids: string[]`, maintained the same way `outbound_links` already is. Since all
   page metadata (not `page_content`) is bulk-decrypted on every load regardless of what's open
   (Flagged Observation #4), GC becomes a metadata-only set-membership check across *all* of the
   user's pages — no content decryption, no dependence on which tabs happen to be open.
3. **Two first-paint/restore bugs.**
   - **Dead-looking new pages.** Nothing set an initial `selection`, so a freshly opened page's
     flow block never mounted a live editor until the user clicked — an "Untitled" page looked
     inert. Fixed: opening a page always sets `selection = { kind: "text", blockId: flow.id }` as
     part of the same store action that sets `activePageId`; the same rule applies to the
     click-on-empty-paper caret-placement path, which must also select (and thereby mount) the
     flow block, not just move a caret inside a block nothing has mounted.
   - **Draft-restore condition silently dropped a valid draft.** "Prompt only if
     `draft.revision >= server.revision`" throws away a legitimate unsaved edit the instant another
     device has saved anything in between (draft made against revision 5, another device pushes
     revision 6 — the draft's local edit is real and still wanted, but the old rule never offers
     it). Fixed: the prompt condition is now "decrypted draft content differs from the freshly
     fetched server content," full stop, independent of revision. Restoring loads the draft into
     local state; if `draft.revision < server.revision` the page is simply `conflicted` the moment
     it opens, and the existing Reload | Keep mine banner (Task 8.2) handles it exactly as it would
     any other conflict — no new conflict path is introduced.

## Changelog from Revision 3 (historical — unchanged from before, kept for context)

Revision 3 closed the storage/runtime gaps found in the Revision 2 cross-review. Six things were
closed there:

1. **Gesture table completed** with an explicit 8px click-vs-drag threshold on empty paper, and a
   load-bearing flow-layout rule: the flow editor's height is its content's height, never stretched
   to fill the sheet.
2. **Conflict UX matches compare-and-swap.** Exactly two outcomes, **Reload** or **Keep mine**,
   both explicit, auditable writes. No silent third path.
3. **Migration lock is two-phase** (claim → complete), so a crashed tab doesn't permanently brick
   the account or double-run the migration.
4. **Crash drafts are encrypted** — `sessionStorage` holds the same `{ iv, data }` shape every
   other encrypted write in this app produces.
5. **Lazy Tiptap mounting is a required task**, not an aspiration.
6. **CAS is backed by a plaintext `revision` column** on `notes_page_content`, mirrored inside the
   encrypted blob for convenience only.

Nine smaller product decisions were also locked there (click vs. drag, explicit page titles edited
from three places, first-run auto-notebook, encrypted-draft restore prompt, `[[` suggestions
showing `Notebook / Section / Title`, sidebar collapse state living only in `localStorage`,
unmatched wiki-links rendering as non-navigating dangling pills).

Everything else — the domain boundary, the table shape, the one-sheet product model, the package
list, the two-pane cap, and the single-mount invariant — is unchanged and restated below as frozen.

## Goal
Extract Notes out of the Task Manager tile entirely and build it as its own standalone domain at
`/notes`. The new Notes is a hierarchical **Notebook → Section → Page** workspace (OneNote's file
structure) where each Page is one sheet: a default continuously-flowing text body (Obsidian-style)
plus optional freely-positioned boxes for text or images (OneNote-style), a right-click Figma-style
stacking order, a toggleable, selection-aware right-side formatting panel (Foxit-style), Obsidian-
style `[[backlinks]]`/`#hashtags`, multi-tab + two-pane split navigation, a freehand drawing layer,
and near-real-time sync across the user's own open tabs/devices that never silently discards an
in-progress edit or silently overwrites a revision it never read. This is the first canvas editor
and the first realtime feature in the app — it deliberately does not sit inside `GenericViewPage` /
`GenericDomainPage`. It reuses the crypto, storage, and store architecture from the rest of the
app, not the list/grid architecture.

## Non-Goals (frozen)
- **No multi-user real-time collaboration.** No CRDT, no Operational Transform. "Live sync" means
  one account's own devices/tabs staying current with each other.
- **No nested/recursive pane splits.** Exactly two panes side by side, max.
- **No Figma-style grouping, connectors, shapes, or alignment guides.**
- **No version history / revision browsing.** The revision counter exists only to detect conflicts.
- **No offline-first merge engine.** Edits made while offline queue locally and flush through the
  same debounced-save path on reconnect; the conflict banner and the encrypted crash draft are the
  entire offline story.
- **No server-side search over ciphertext.**
- **No AI features.**
- **No infinite canvas.** The sheet grows to fit content; it does not pan/zoom at infinite scale.

---

## Runtime Contracts

The page is **one sheet that is both a flowing document and a canvas, at all times.** There is no
`pageKind` field, no view toggle. A single `PageCanvas` component always renders both.

### Gesture table

| Gesture | What happens |
|---|---|
| Click in the flowing text | Caret. Type. Normal document. |
| Drag inside existing text | Text selection. |
| Click on empty paper, pointer moves **< 8px** before release | Selects the flow block (`selection = { kind: "text", blockId: flow.id }`, mounting it if not already mounted) and places the caret at the end of its content. |
| Drag on empty paper, pointer moves **≥ 8px** before release | Create a new floating text box sized to the dragged rectangle, and select it. |
| Click a box | Select/edit it. Move/resize only from its border/handle — the interior of a text box types instead of dragging. |
| Paste/drop/upload image | Floating image box at the drop/cursor position, captured before Tiptap ever sees the event. |
| Pen or Eraser tool active | Ink on this sheet. Switching the pointer tool back to default returns to normal typing/dragging — this is a pointer-tool state in `useNotesStore`, not a page mode. |

Empty = unused paper: margins, below the last line, gaps between/around boxes. The sheet **grows**
with content (sizing rule below) rather than clipping. Boxes sit beside, below, or over text
(`z`-ordered). `blocks[0]` (the flow body) is undeletable and unmovable.

**Selection on click is load-bearing, not cosmetic.** Because text blocks mount a live editor only
while selected (Editor mounting, below), any gesture that lands in or creates a text block must
also update `selection` — "place a caret" and "select the block" are the same action here, never
two. Skipping this on the empty-paper-click path is exactly what made a freshly opened page look
dead until the user clicked twice (Revision 4, item 3).

### Hit-testing order for a pointer-down event on the sheet

1. `pointerTool` is `pen` or `eraser` → the ink layer handles it, full stop.
2. Target is inside a floating block's drag handle/border → `react-rnd` drag/resize.
3. Target is inside a floating block's content area → that block's own editor/image handles caret
   placement or text selection; dragging must **not** start here.
4. Target is inside the flow body's content box (its glyphs/its editable region) → normal
   `RichTextEditor` caret/selection.
5. Target is empty sheet space → classify by movement distance before release: **< 8px is a click**
   (select the flow block, caret at end), **≥ 8px is a drag** (create a floating box from the rect,
   select it).

### Flow layout rule (load-bearing)

The flow `RichTextEditor` is constrained to a **readable column width (~700–800px)**, and its
**height is its content's height — never `min-height: 100%` of the sheet.** If the flow body is
stretched to fill the sheet, step 4 of the hit-test order swallows every click below the last
paragraph and a floating box can never be created underneath the note. This is a rendering
constraint, not a preference: get it wrong and Phase 3's floating-box creation is unreachable on
any page whose flow body is shorter than the sheet.

### Sheet sizing rule

The sheet is not fixed and not infinite. Its rendered size is
`max(minimum 900×1200, bounding box of {flow body height, all floating blocks, all ink strokes} + margin)`,
recomputed on every content save and persisted as `sheet_w`/`sheet_h` so reopening a page doesn't
require recomputing layout from a cold start. It never shrinks below the minimum and has no upper
bound. There is no pan/zoom.

### Coordinates

All `x`/`y` in `CanvasBlock` and all points in `InkStroke` are **page-local** — relative to the
sheet's own top-left origin — converted to/from viewport space only at the render boundary.
Scrolling the page must never visibly shift a box or a stroke relative to the text under it.

### Editor mounting

Only the **currently selected** text block (flow or floating) has a live `RichTextEditor` instance
mounted. Every other text block on the page renders static, sanitized HTML of its own `html`
field. Selecting a block mounts an editor on it and focuses it; deselecting tears the editor down
and writes its HTML back into the block's data. A page with fifteen floating text boxes therefore
never has more than one live Tiptap instance at a time, regardless of how many panes are open
(the single-mount-per-`pageId` invariant below is a separate, additional constraint on top of this).

**Opening a page is never a "nothing selected" state.** The store action that sets `activePageId`
(Task 2.1's single "open a page" action) always also sets `selection = { kind: "text", blockId: flow.id }`
in the same update, so the flow editor is mounted and focused the instant the page appears —
matching whatever was already true for a brand-new page (Task 2.7's auto-created "Untitled") and
for every existing page reopened from the tree, a tab, a backlink, or a deep link.

---

## Reusable Inventory (from existing codebase)
| Element | Path | How it's reused |
|---------|------|-----------------|
| `encryptField` / `decryptField` | `src/lib/crypto/index.ts` | Encrypts/decrypts every Notebook, Section, Page, and PageContent row's JSON blob. |
| `encryptBlob` / `decryptBlob` | `src/lib/crypto/index.ts` | Encrypts pasted/dropped/uploaded images before storage, decrypts them for canvas rendering, and encrypts the crash-draft payload written to `sessionStorage`. |
| `documents` table + `src/api/common/documents.ts` / `documentStorage.ts` | `src/api/common/` | Reused as-is for every image or file placed on a canvas. Notes becomes a fourth `domain` value alongside `education \| expense \| medical`. File bytes live in Cloudflare R2 behind presigned URLs issued by `src/app/api/storage/{upload,download,delete}/route.ts` — not Supabase Storage. |
| `GenericStorePage` | `src/components/common/store/` | Powers `/notes/store` for standalone files not tied to any page, `storeType="doc" domain="notes"` — same pattern as taskmanager/expense/education/medical. |
| `RichTextEditor` (Tiptap) | `src/components/common/RichTextEditor.tsx` | Base for every text block; extended with the extensions in Package Decisions. Tiptap's own History extension covers per-editor text undo/redo. |
| `(protected)/layout.tsx` → `CryptoProvider` | existing | Same DEK-bootstrap boundary every other domain relies on. |
| `useLocalStorage` | `src/lib/useLocalStorage.ts` | Persists sidebar collapse state, tab/split layout — per-device UI state, never encrypted DB data. |
| `BackButton`, `ErrorBanner`, `LoadingSpinner` | `src/components/common/` | Standard chrome for the Notes shell and Store page. |
| `ConfirmDialog` | `src/components/common/ConfirmDialog.tsx` (moved as part of this plan — Task 1.6) | Delete-notebook/section/page and clear-drawing confirmations. |
| `@supabase/supabase-js` realtime channel API | already installed | Cross-tab/cross-device live sync — first realtime feature in the app; `useNotesRealtime` is the template for any future domain wanting it. |

## Package Decisions
| Package | Version | Decision | Reason |
|---------|---------|----------|--------|
| `react-rnd` | Latest | New | Drag + resize for freeform canvas boxes. |
| `perfect-freehand` | Latest | New | Smooth, pressure-shaped ink stroke paths. |
| `@tiptap/extension-underline` | Latest | New | Not in `starter-kit`; needed for the formatting panel. |
| `@tiptap/extension-color` | Latest | New | Text color, alongside the already-installed `extension-highlight`. |
| `@tiptap/suggestion` | Bundled with `@tiptap/core` (already installed) | Reuse | Powers the `[[` trigger/autocomplete. |
| Context menu (right-click stacking menu) | — | None — build custom | A 4-item menu doesn't justify a dependency. |
| Eraser hit-testing | — | None — build custom | Point-to-segment distance check; a stroke within threshold is removed outright. |
| Ink undo/redo | — | None — build custom | Small in-memory stack of stroke-array snapshots, session-only. |
| Notes state store | — | None — build custom `React.Context` + `useReducer` | Matches the app's existing convention; no Redux/Zustand exists anywhere in the codebase. |
| CRDT / OT library (e.g. Yjs) | — | Rejected | See Non-Goals. |

## Data Model

### Supabase Tables
All follow the encrypted-blob convention (`id`, `user_id`, `iv`, `data`, `created_at`) with two
deliberate plaintext exceptions: `notes_page_content.id` equals its parent page's `id`, and
`notes_page_content.revision` is a plaintext integer (rationale below).

| Table | Columns | Notes |
|---|---|---|
| `notes_notebooks` | `id, user_id, iv, data, created_at` | One row per notebook. |
| `notes_sections` | `id, user_id, iv, data, created_at` | One row per section; `notebook_id` lives inside the blob. |
| `notes_pages` | `id, user_id, iv, data, created_at` | One row per page — lightweight metadata, tags, outbound links, image references, migration provenance; `section_id` lives inside the blob. |
| `notes_page_content` | `id, user_id, iv, data, revision, created_at` | `id` = the owning page's `id`. `revision` is a plaintext integer, source of truth for compare-and-swap. |
| `notes_migration_lock` | `user_id (PK), completed_at` | Two-phase mutex for the legacy-notes migration (Task 0.1). `completed_at` is `NULL` while a migration is in progress or claimed, set once the migration has fully finished. **Deliberately has no `created_at` column** — see Task 0.1 for why the stale-claim window doesn't need one. |

**Encrypted JSON blob shapes:**

```typescript
interface NotebookPlaintext {
  name: string;
  order: number;
  updated_at: string;
  // No `collapsed` field — expand/collapse is per-device UI state, kept only in
  // localStorage (Task 2.2). Storing it here would mean dual-writing UI chrome
  // into an encrypted row on every click, for no cross-device benefit anyone asked for.
}

interface SectionPlaintext {
  notebook_id: string;
  name: string;
  order: number;
  color?: string;
  updated_at: string;
}

interface PagePlaintext {
  section_id: string;
  title: string;            // explicit, user-edited — see Task 2.2/6.2. Never derived from content.
  order: number;
  tags: string[];
  outbound_links: string[];
  image_ids: string[];      // REV 4: every document_id currently placed as an image block on this
                             // page's content, kept in lockstep with outbound_links — updated by
                             // the same save-time metadata patch (Task 6.2), not derived on demand.
                             // This is what lets image GC (Task 1.2/1.3) work as a pure metadata
                             // set-membership check with zero notes_page_content decryption.
  migrated_from?: string;   // REV 4: set only on pages created by Task 0.1's legacy migration,
                             // to the source `notes` (legacy) row's id. Absent on every normally
                             // created page. This is the sole identity key the migration uses for
                             // idempotency — never the notebook/section name or the title text.
  created_at: string;
  updated_at: string;
}

interface PageContentPlaintext {
  page_id: string;   // redundant with the row's own id, kept for defensive validation
  revision: number;  // mirrors the plaintext `revision` DB column at time of write; the DB
                      // column is the source of truth for CAS, this is a read convenience
  sheet_w: number;
  sheet_h: number;
  blocks: CanvasBlock[];
  strokes: InkStroke[];
  updated_at: string;
}

type CanvasBlock =
  | { id: string; type: "text"; role: "flow" | "floating";
      x: number; y: number; w: number; h: number; z: number; html: string }
  | { id: string; type: "image";
      x: number; y: number; w: number; h: number; z: number;
      document_id: string; alt?: string };
// role "flow" = the single undeletable, unmovable Obsidian-style body — always blocks[0].
// role "floating" = a user-created OneNote-style movable box.
// x/y/w/h are page-local, never viewport-local.

interface InkStroke {
  id: string;
  points: [number, number, number?][];  // x, y, optional pressure — page-local
  color: string;
  size: number;
  z: number;
}

function emptyFlowBlock(): CanvasBlock {
  return { id: crypto.randomUUID(), type: "text", role: "flow",
           x: 0, y: 0, w: 760, h: 0, z: 0, html: "" };
}
```

`emptyFlowBlock()` lives once in `src/types/notes.ts` and is the only place that constructs a
brand-new page's initial content — both `createPage` (Task 1.2) and the migration script
(Task 0.1) call it, rather than each inlining their own empty-block literal.

### DDL (to run in Supabase SQL Editor)

```sql
CREATE TABLE public.notes_notebooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    iv TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.notes_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    iv TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.notes_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    iv TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- id is NOT auto-generated: the client sets it equal to the corresponding notes_pages.id,
-- and inserts this row in the SAME createPage call (Task 1.2), never lazily.
-- revision is the plaintext compare-and-swap column (Task 1.3) — the ciphertext's own
-- mirrored `revision` field is never used as the lock condition.
CREATE TABLE public.notes_page_content (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    iv TEXT NOT NULL,
    data TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Two-phase migration mutex (Task 0.1). completed_at NULL means "claimed, in progress, or
-- abandoned" — a row existing is NOT proof of success. Only a non-null completed_at is.
-- No created_at column: intentional (REV 4). See Task 0.1 for why the stale-claim window is
-- tracked client-side, not from a database timestamp. Do not add one at implementation time.
CREATE TABLE public.notes_migration_lock (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_notes_notebooks_user_id ON public.notes_notebooks(user_id);
CREATE INDEX idx_notes_sections_user_id ON public.notes_sections(user_id);
CREATE INDEX idx_notes_pages_user_id ON public.notes_pages(user_id);
CREATE INDEX idx_notes_page_content_user_id ON public.notes_page_content(user_id);

ALTER TABLE public.notes_notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes_page_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes_migration_lock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own notes_notebooks" ON public.notes_notebooks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage their own notes_sections" ON public.notes_sections FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage their own notes_pages" ON public.notes_pages FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage their own notes_page_content" ON public.notes_page_content FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage their own notes_migration_lock" ON public.notes_migration_lock FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

## ⚠️ Flagged Observations
1. **Encryption model vs. high-frequency updates.** Every write re-encrypts a full blob with a
   fresh IV (IV reuse under AES-GCM is a hard security failure). Canvas mutations update local
   React state instantly; encryption + write happens after a **1.5s debounce**, keyed per `pageId`
   (Task 3.6).
2. **"Live sync" = multi-device continuity for one account, not multi-user collaboration.** No
   CRDT/OT. Conflict handling is revision-counter-based (Observation #12, Task 8.2).
3. **`notes_page_content.id` is deliberately set equal to its parent `notes_pages.id`.** A
   plaintext primary-key lookup avoids bulk-decrypting every page's content to find one page's
   content, and leaks nothing beyond what every table's `id` column already exposes.
4. **Notebook/Section/Page metadata is still bulk-decrypted on load** (small — titles, order,
   tags, outbound links, image references, migration provenance), matching every other domain's
   convention. Only `notes_page_content`'s heavy blob opts out, per #3. **This is precisely what
   makes the Revision 4 image-GC fix free**: the `image_ids` array added to `PagePlaintext` rides
   along on metadata the app was already decrypting in full, on every page, on every load — no
   new decrypt path, no new round trip.
5. **Backlinks never require decrypting canvas content.** Each save derives `outbound_links` (the
   set of page_ids its wiki-link nodes point to) and `image_ids` (the set of `document_id`s its
   image blocks reference) and writes both onto the page's own lightweight `notes_pages` row
   (Task 6.2). The inbound backlink index (Task 6.3) is just inverting `outbound_links` across
   already bulk-decrypted metadata; image GC (Task 1.2/1.3) is just a set-membership check across
   the same already bulk-decrypted metadata.
6. **Dragging must never start from inside a text box's content.** `react-rnd`'s
   `dragHandleClassName` is scoped to a thin border/handle element that does not overlap the
   block's own content area, so text stays selectable (Task 3.2, hit-test steps 2–3).
7. **Coordinates are page-local, not viewport-local** (Runtime Contracts, "Coordinates").
8. **Sheet sizing: grow, don't stretch, don't clip.** The flow body's height is its content's
   height — it must never be forced to `min-height: 100%` of the sheet, or floating boxes become
   uncreatable beneath it (Runtime Contracts, "Flow layout rule"). The sheet itself starts at a
   minimum 900×1200 and grows to the bounding box of all content plus margin on every save
   (Task 3.1). No fixed maximum, no pan/zoom.
9. **The R2 storage allow-list is a source-code fix, not a dashboard setting.**
   `src/app/api/storage/upload/route.ts` (and the matching `download`/`delete` routes) hard-code
   `const allowedFolders = ["expenses", "certificates"]` and will 400 any other folder value. Task
   1.5 traces what folder value `documentStorage.ts` actually sends today and adds whatever is
   missing — likely `"notes"`, and very likely `"medical"` too as a pre-existing gap from when that
   domain was added, unrelated to this plan but cheap to fix in the same edit. This is entirely an
   agent code change; there is no Human Action for it.
10. **Sequencing conflict with the in-flight Global Architecture Refactor.** Its Stage 7 (marked
    "current focus") still lists `/taskmanager/notes` for migration onto `GenericViewPage`. This
    plan's Phase 0 **deletes that exact route** once the legacy-notes migration is verified. If
    Stage 7 reaches that route first, the work is thrown away. See HA-03.
11. **Old `notes` table is superseded, not immediately dropped.** Migrated once (Task 0.1), left
    in place unreferenced for one release cycle as a rollback safety net before a human manually
    drops it.
12. **Conflict UX has exactly two outcomes, both explicit CAS writes.** When a realtime update for
    an open page arrives with a newer revision than the page's `lastSyncedRevision` **and** the
    page has unsaved local edits, autosave stops firing blindly and a banner offers **Reload**
    (discard local edits and the encrypted draft, adopt the remote revision) or **Keep mine**
    (write local content with `expectedRevision` set to the *remote* revision the client has now
    seen, producing a new, explicit revision). There is no silent "ignore and let the next autosave
    win" path — that would overwrite a revision the client never read, the exact failure CAS exists
    to prevent (Task 8.2). **A page found conflicted at open time (Revision 4's draft-restore fix)
    reuses this exact same banner** — there is no second, restore-flavored conflict UI.
13. **Migration claim and migration completion are different states.** A row existing in
    `notes_migration_lock` means a tab *claimed* the migration, not that it *finished*. Only a
    non-null `completed_at` means done. A tab that claims and then crashes (browser closed,
    network drop mid-batch) must not leave the account permanently unmigrated — a stale, incomplete
    claim can be stolen and retried (Task 0.1).
14. **Crash drafts are encrypted, never plaintext.** The `sessionStorage` safety net (Task 3.7)
    stores the same `{ iv, data }` shape as any other encrypted write via `encryptField` — never
    raw HTML or raw ink point arrays sitting readable in browser storage.
15. **CAS is a plaintext-column `WHERE` clause, not a decrypt-then-compare race.** `savePageContent`
    (Task 1.3) conditions its `UPDATE` on `revision = expectedRevision` as a plain SQL predicate.
    Zero rows affected means someone else won the race; the client gets a typed
    `RevisionConflictError` back, not a silently stale write. This is only viable because
    `revision` is a plaintext integer column (Data Model) — deciding to keep it encrypted-only
    would reintroduce exactly the TOCTOU race CAS is meant to close.
16. **Lazy Tiptap mounting is required, not an optimization to consider later.** A page with many
    floating text boxes must never have more than one live editor instance mounted at a time
    (Runtime Contracts, "Editor mounting"; Task 3.5).
17. **(REV 4) Migration identity is an id, never a text match.** `migrated_from` is the only thing
    the migration's skip/steal logic checks. Two legacy notes with identical opening text produce
    two distinct migrated pages, correctly, because they have two distinct legacy ids — a
    name-matching scheme would have silently merged or skipped one of them.
18. **(REV 4) `notes_migration_lock`'s missing `created_at` is by design.** Staleness is judged by
    how long *this tab* has been polling since it first observed the claim (an in-memory
    `Date.now()` captured at discovery time), not by a database timestamp. A DB-side `created_at`
    would need clock-skew handling across the client and Postgres for no benefit the client-side
    timer doesn't already provide. Do not add the column.
19. **(REV 4) Selection is part of "open a page," not a separate afterthought.** Every code path
    that changes `activePageId` — tree click, tab click, backlink click, deep link, first-run
    auto-notebook, empty-paper click — goes through the same single store action (Task 2.1), and
    that action is what guarantees a text block is always selected and mounted afterward. There is
    intentionally no second place that has to remember to do this.

---

## Phases & Tasks

### Phase 0 — Migration Off Task Manager
#### Task 0.1 — Two-Phase Migration Lock & Identity-Based Data Migration (REV 4: rewritten)
- **What**: Triggered on first `/notes` visit, before the tree loads:
  1. Attempt `INSERT INTO notes_migration_lock (user_id, completed_at) VALUES (?, NULL)`.
  2. **Insert succeeds** → this tab owns the migration.
     - Ensure a Notebook named "Migrated Notes" exists (create it only if a notebook with that
       exact name doesn't already exist for this user — relevant on a stolen/retried run); same
       for a Section "General" under it.
     - For each existing legacy `notes` row, decrypt `{content, updated_at}`. **Before creating
       anything**, check whether any `notes_pages` row for this user already has
       `PagePlaintext.migrated_from === <this legacy row's id>`. If yes, skip it — already
       migrated, whether by this run or an earlier stolen attempt. If no, create one Page
       (`title` = first ~40 chars of `content`, used only for display — never used for identity),
       setting `migrated_from` to the legacy row's id, whose content is `emptyFlowBlock()` with
       `html` set to the old content, written via the same `createPage` + `notes_page_content`
       insert path as Task 1.2, at `revision: 0`.
     - **`migrated_from` is the only identity key.** Title text is never compared, hashed, or
       truncated for matching purposes — two legacy notes that happen to start with the same forty
       characters produce two distinct migrated pages, correctly, because their legacy ids differ.
     - When every legacy row has been checked (migrated or already-present), `UPDATE
       notes_migration_lock SET completed_at = now() WHERE user_id = ?`.
  3. **Insert violates the unique `user_id` constraint** → another tab already claimed it. Read
     that row: if `completed_at` is set, the migration is done — just load the tables normally.
     If `completed_at` is null, this tab has just discovered a live claim: record
     `firstObservedAt = Date.now()` **in local memory** (not written anywhere) and poll the lock
     row every few seconds. If `completed_at` becomes non-null while polling, done. If it's still
     null once `Date.now() - firstObservedAt` exceeds ~2 minutes, treat the claim as abandoned
     (crashed tab) and steal it: re-run step 2 in full. Step 2 is safe to re-run from scratch by
     construction — every check is `migrated_from === legacy_id`, so a partial prior run (some
     pages created, others not) simply skips what already exists and creates only what's missing;
     it cannot produce a duplicate.
  4. If legacy `notes` had zero rows, still mark `completed_at` — an empty migration is a completed
     one, not a skipped one, and must not be indistinguishable from "never tried."
- **Where**: `src/api/notes/migrateLegacyNotes.ts`, invoked from `src/app/(protected)/notes/page.tsx` on mount.
- **Reuse**: `encryptField`/`decryptField`; `emptyFlowBlock()` from `src/types/notes.ts`.
- **Note on the lock table**: `notes_migration_lock` intentionally has no `created_at` column
  (Flagged Observation #18). The 2-minute stale-claim window above is timed by the polling tab
  itself, from the moment it first saw the claim — never from a database timestamp. Do not add a
  column to make this "more correct"; it isn't needed and adds clock-skew surface for nothing.

#### Task 0.2 — Detach Notes From Task Manager
- **What**: Remove the `miscSlot` content (Notes Store link + `NotesBox`) from `TaskManagerView`'s
  `GenericDomainPage` config. Delete `NotesBox.tsx`, `NoteModal.tsx`, and the `/taskmanager/notes`
  route.
- **Where**: `src/components/taskmanager/TaskManagerView.tsx`, `src/app/(protected)/taskmanager/notes/`
- **Depends on**: Task 0.1 verified in production for one release cycle (Flagged Observation #11).
  See HA-03 for sequencing against the Global Architecture Refactor before doing this.

#### Task 0.3 — Add Notes Tile to the Main Dashboard
- **What**: Add a "Notes" tile to the top-level dashboard grid alongside Task Manager/Expense/Education/Medical/Vault/Media, linking to `/notes`.
- **Where**: main dashboard page component.

### Phase 1 — Types, Tables, Data APIs, and Cross-Cutting Fixes
#### Task 1.1 — Define Types
- **What**: The plaintext interfaces and `emptyFlowBlock()` factory from the Data Model section
  (including REV 4's `image_ids` and `migrated_from` fields on `PagePlaintext`), plus their
  encrypted-row counterparts.
- **Where**: `src/types/notes.ts`

#### Task 1.2 — Notebook/Section/Page CRUD (create/rename/delete/reorder, cascade-aware, repairable; REV 4: metadata-only image GC)
- **What**: `notebooks.ts`, `sections.ts`, `pages.ts`:
  - `createPage(userId, sectionId, title)` inserts both the `notes_pages` row (with `image_ids: []`
    and `migrated_from` unset unless called from Task 0.1) and its `notes_page_content` row
    (`revision: 0`, `blocks: [emptyFlowBlock()]`, `strokes: []`, minimum `sheet_w`/`sheet_h`) as two
    calls that are not wrapped in a database transaction (no RPC helper exists for this yet).
    Document, don't pretend: `getPageContent` (Task 1.3) treats "page row exists, content row
    missing" as a repairable partial-create — it inserts the missing empty content row at
    `revision: 0` on read, rather than erroring. This is the actual atomicity story: repair-on-read,
    not a transaction.
  - `patchPageLinks(userId, pageId, { tags, outbound_links, image_ids })` — metadata-only update.
    (REV 4: this function now also carries `image_ids`, so the one call that updates a page's
    outbound links after a save updates its image references in the same write — see Task 6.2.)
  - `reorderNotebooks` / `reorderSections` / `reorderPages(userId, orderedIds)`.
  - `renamePage`/`renameSection`/`renameNotebook(userId, id, newTitle)` — a metadata-only save;
    editing a page's title from the sidebar, the tab label, or the page header (Task 2.2, 5.1,
    6.4) all call this same function against the same `PagePlaintext.title` field. Title is never
    derived from the flow body's first line, and (REV 4) is never used as a migration identity key
    either.
  - `deleteNotebook(userId, notebookId)` / `deleteSection(userId, sectionId)` — explicit cascade,
    in this order: for every descendant page, delete its `notes_page_content` row, then GC any
    `documents` rows referenced by that page's `image_ids` (see REV 4 rule below), then the
    `notes_pages` row, then each child `notes_sections` row (notebook delete only), then the
    `notes_notebooks`/`notes_sections` row itself. Nothing cascades at the DB level (blob-embedded
    parent IDs, per the app's existing convention) — the client walks this order explicitly.
  - `deletePage(userId, pageId)` — same content → image GC → page-row order, without the
    notebook/section levels.
  - **Image GC rule (REV 4, rewritten)**: `PagePlaintext.image_ids` is the source of truth for
    "which images does this page use" — it is metadata, already bulk-decrypted for every page the
    user has, regardless of what's open this session (Flagged Observation #4/#5). When deleting one
    or more pages, collect the union of their `image_ids`. For each such `document_id`, delete the
    underlying `documents` row/file **only if no *other* page in the user's full, already-decrypted
    `notes_pages` list still has that id in its own `image_ids`.** This is a pure metadata
    set-membership check — it never decrypts any `notes_page_content`, and it never depends on
    which tabs/panes happen to be open. (The prior "no other page *currently open* references it"
    rule is what let a shared image get deleted out from under a closed page — fixed.) Never touch
    Notes Store files that aren't placed on any canvas — those are the user's standalone uploads
    and are managed only from `/notes/store`, and never appear in any page's `image_ids`.
- **Where**: `src/api/notes/`
- **Why**: A `ConfirmDialog` (Task 1.6) at each delete entry point shows the count of what will be
  removed (e.g., "Delete 'Q3 Planning'? This will permanently delete 4 pages and 2 files.").

#### Task 1.3 — Page Content API (compare-and-swap on a plaintext column)
- **What**: `pageContent.ts`:
  - `getPageContent(userId, pageId)` — `.eq('id', pageId)` fetch; if no row exists (Task 1.2's
    partial-create case), insert an empty one at `revision: 0` before returning it.
  - `savePageContent(userId, pageId, content, expectedRevision)` — re-encrypts with a fresh IV
    (mirroring `expectedRevision + 1` into the blob's own `revision` field), then issues
    `UPDATE notes_page_content SET iv = ?, data = ?, revision = ? WHERE id = ? AND user_id = ? AND revision = ?`
    with the last two params being `expectedRevision + 1` and `expectedRevision`. **Zero rows
    affected → throw `RevisionConflictError`.** The caller never retries this write silently
    (Task 3.6, Task 8.2 own that decision).
  - `garbageCollectPageImages(userId, removedDocumentIds)` (REV 4: no longer takes a `pageId` /
    "currently open" notion) — called by Task 1.2's cascade delete with the set of candidate
    `document_id`s freed by the pages just deleted; applies Task 1.2's metadata-only membership
    check against the user's full page list before actually deleting each `documents` row/file via
    `documents.ts`.
- **Where**: `src/api/notes/pageContent.ts`
- **Why**: This is the one function every other CAS-related task (3.6, 8.2) calls into — it is the
  single place the `revision` column's `WHERE` clause is enforced (Flagged Observation #15).

#### Task 1.4 — Extend the Shared Documents System
- **What**: Add `"notes"` to the `domain` union used by `DocumentPlaintext`, `GenericStorePage`'s
  domain theming, and `documentStorage.ts`'s upload path prefixing.
- **Where**: `src/types/document.ts`, `src/components/common/store/GenericStorePage.tsx`, `src/api/common/documentStorage.ts`

#### Task 1.5 — Fix the R2 Storage Allow-List
- **What**: Open `src/app/api/storage/upload/route.ts`, `download/route.ts`, and `delete/route.ts`.
  Trace the folder value `documentStorage.ts` actually sends via `createEncryptedFileStorage({ bucket: ... })`.
  Add whatever value is missing for Notes uploads to the `allowedFolders` array in all three
  routes, and add `"medical"` in the same edit if it's absent (Flagged Observation #9).
- **Where**: `src/app/api/storage/upload/route.ts`, `src/app/api/storage/download/route.ts`, `src/app/api/storage/delete/route.ts`
- **Depends on**: Do this before Task 3.4 needs to upload a single image, or it will 400.

#### Task 1.6 — Move `ConfirmDialog` to `common/`
- **What**: Move `src/components/taskmanager/ConfirmDialog.tsx` to `src/components/common/ConfirmDialog.tsx`
  with no behavior change. Update every existing importer (Task Manager, Education, Medical,
  Expense bulk-delete, Store bulk-delete) to the new path; Notes imports it from `common/`.
- **Where**: `src/components/common/ConfirmDialog.tsx`, plus one import-line edit in each caller above.

### Phase 2 — The Notes Store, Sidebar Tree, and Deep Linking
#### Task 2.1 — `useNotesStore`: the single state owner (REV 4: "open a page" always sets selection)
- **What**: One `React.Context` + `useReducer` holding:
  - `tree: { notebooks, sections, pages }` (decrypted metadata, kept in sync with realtime)
  - `activePageId` (mirrors `?page=`, Task 2.5)
  - `panes: { tabs: pageId[]; activePageId: string }[]` and `focusedPaneIndex`
  - `pageContents: Map<pageId, { content, dirty: boolean | "conflicted", lastSyncedRevision: number }>`
  - `pointerTool: "default" | "pen" | "eraser"`
  - `selection: { kind: "text" | "image" | "none"; blockId?: string }` — **the reducer never holds
    a Tiptap `Editor` instance.** Editor instances are non-serializable, per-mount objects; they
    live in a `Map<blockId, Editor>` ref outside the reducer, looked up by `selection.blockId` when
    a component needs the live instance (Task 4.1, Task 3.5's lazy-mount logic).
  - `syncStatus: "saved" | "syncing" | "offline"`
  There is exactly one "open a page" action on this store, used identically by the tree, the
  backlinks footer, wiki-link clicks, the `?page=` deep link, and the first-run auto-notebook. **It
  always sets both `activePageId` and `selection = { kind: "text", blockId: <that page's flow
  block id> }` in the same update** (Runtime Contracts, "Editor mounting"; Flagged Observation #19)
  — no caller opens a page without also getting a mounted, focused flow editor for free. It also
  pushes the query param.
- **Where**: `src/components/notes/useNotesStore.tsx`

#### Task 2.2 — Notebook/Section Tree (CRUD, reorder, search, collapse)
- **What**: Collapsible notebook list; expanding reveals sections. Each level has: inline "+" to
  create, rename-in-place (calling Task 1.2's rename functions — same field the tab label and page
  header edit), delete wired to Task 1.2's cascade behind the moved `ConfirmDialog` with counts,
  and drag-to-reorder within a parent. A search input above the tree filters the visible page list
  by title or `#tag` client-side over already-decrypted metadata, no server round-trip. **Expand/
  collapse state lives only in `useLocalStorage`, keyed by notebook/section id — it is never
  written to `NotebookPlaintext` or any encrypted row.**
- **Where**: `src/components/notes/NotebookTree.tsx`

#### Task 2.3 — Section Page Flyout (CRUD, reorder)
- **What**: Selecting a section opens the narrow middle column listing its pages, with "+" to add
  (`createPage`), inline rename, delete (`deletePage`, `ConfirmDialog`), and drag-to-reorder
  (`reorderPages`).
- **Where**: `src/components/notes/SectionPageList.tsx`

#### Task 2.4 — Notes Store Link
- **What**: A "Notes Store" button in the sidebar footer, routing to `/notes/store`.
- **Where**: `src/components/notes/NotebookTree.tsx`

#### Task 2.5 — Deep Link Route
- **What**: `/notes?page=<pageId>` drives `activePageId` in `useNotesStore` on load; opening a page
  through any of the four entry points pushes this query param via the store's single "open a
  page" action, so refresh and browser back/forward both work.
- **Where**: `src/app/(protected)/notes/page.tsx`

#### Task 2.6 — Narrow-Viewport Default
- **What**: On mount, below a tablet-width breakpoint, default both the notebook tree and the
  formatting sidebar to collapsed (still toggleable, still persisted per-device from that point on
  via `useLocalStorage`).
- **Where**: `src/components/notes/useNotesStore.tsx` (initial state), consumed by `NotebookTree.tsx` and `FormattingSidebar.tsx`.

#### Task 2.7 — First-Run Auto-Notebook
- **What**: On first `/notes` visit, after Task 0.1's migration check completes, if the tree is
  still empty (no notebooks — either nothing to migrate, or migration produced nothing), auto-create
  Notebook "My Notebook" → Section "General" → Page "Untitled" via the normal `createPage` path,
  and open it through the store's single "open a page" action (Task 2.1) — which is what makes it
  land ready-to-type rather than requiring an extra click (Flagged Observation #19).
- **Where**: `src/app/(protected)/notes/page.tsx`, after Task 0.1's migration call.

### Phase 3 — Canvas Core
#### Task 3.1 — Page Shell, Flow Block, and Sheet Sizing
- **What**: `PageCanvas.tsx` renders `blocks[0]` as a `RichTextEditor` constrained to a ~700–800px
  readable column, **height sized to content, never `min-height: 100%`** (Runtime Contracts, "Flow
  layout rule" — this is the single most important rendering constraint in this phase). The sheet
  itself renders at `sheet_w`×`sheet_h` from the loaded content; on every save (Task 3.6) it's
  recomputed per the sizing rule and persisted back. Block/stroke coordinates are converted from
  page-local space to viewport position only at the DOM boundary (page-local coordinates,
  Flagged Observation #7).
- **Where**: `src/components/notes/PageCanvas.tsx`

#### Task 3.2 — Freeform Box Creation & Manipulation (5-step hit-test, 8px threshold; REV 4: click also selects)
- **What**: Implements the hit-testing order from Runtime Contracts exactly, including the 8px
  click-vs-drag threshold at step 5. On a sub-8px click on empty paper, the flow block is both
  selected (`selection = { kind: "text", blockId: flow.id }`, mounting it if it wasn't already the
  selection) and given a caret at the end of its content — these are one update, not two, so a
  click on empty space below a short note both mounts and focuses the editor in a single gesture
  (Runtime Contracts, "Selection on click is load-bearing"). On a ≥8px drag, the newly created
  floating box is selected the same way. `react-rnd`'s `dragHandleClassName` is scoped to a thin
  border/handle that doesn't overlap the block's content area, so dragging never starts on top of
  editable text (Flagged Observation #6).
- **Where**: `src/components/notes/FloatingBlock.tsx`

#### Task 3.3 — Stacking Order Context Menu
- **What**: Right-click on a floating block opens Bring to Front / Forward / Backward / Send to
  Back, mutating that block's `z`.
- **Where**: `src/components/notes/BlockContextMenu.tsx`

#### Task 3.4 — Images Onto the Canvas (capture-phase, before Tiptap)
- **What**: Clipboard paste, drag-and-drop, and an explicit "Insert Image" upload button all
  converge on one path. Clipboard/drop events are captured at the `PageCanvas` container level in
  the **capture phase**, before they can bubble into any nested Tiptap editor's own paste handler —
  this is what stops an image from being embedded as a base64 data URL inside a text block,
  bypassing encryption entirely. Each entry point encrypts via `encryptBlob`, uploads through
  `documentStorage.ts` with `domain: "notes"` (unblocked by Task 1.5), and inserts a new `image`
  floating block referencing the returned `document_id`. Images are capped via
  `MAX_FILE_SIZE`/`ALLOWED_TYPES` (`src/lib/fileConstants.ts`); decrypted image blobs are cached
  per `document_id` with LRU eviction, and their `URL.createObjectURL` handles are revoked when a
  block is removed or the page closes. **The new `document_id` is added to the page's
  `image_ids` on the next metadata patch (Task 6.2), which is what image GC (Task 1.2/1.3) reads.**
- **Where**: `src/components/notes/PageCanvas.tsx`, `src/components/notes/useImageInsert.ts`

#### Task 3.5 — Lazy Tiptap Mounting
- **What**: A text block (flow or floating) mounts a live `RichTextEditor` only while
  `selection.blockId === block.id`. On selection, mount and focus; on deselection, read the
  editor's HTML back into the block's data and unmount it. Every unselected text block renders its
  `html` field as static, sanitized markup. This holds across both panes — the single-mount-per-
  `pageId` invariant (Task 5.1) is a separate constraint layered on top of this per-page rule.
  **A page is never in a state with `selection.kind === "none"` immediately after opening**
  (Task 2.1) — `"none"` only arises later, if the user explicitly deselects everything by clicking
  page chrome outside the sheet.
- **Where**: `src/components/notes/FloatingBlock.tsx`, `src/components/notes/PageCanvas.tsx`

#### Task 3.6 — Debounced, Compare-and-Swap Autosave
- **What**: `useDebouncedSave(pageId, content, 1500)` calls `savePageContent` (Task 1.3) 1.5s after
  the last local mutation, passing the page's current `lastSyncedRevision`. The debounce timer does
  **not** arm while a `compositionstart` (IME) is in progress — it waits for `compositionend`
  before starting the 1.5s countdown, so mid-composition input (e.g. CJK IMEs) never gets split
  into a garbled intermediate save. On success, `lastSyncedRevision` updates and `dirty` clears. On
  `RevisionConflictError`, `dirty` becomes `"conflicted"` and autosave stops retrying for that page
  until Task 8.2's banner resolves it via Reload or Keep mine — it never blindly retries the write.
- **Where**: `src/components/notes/useDebouncedSave.ts`

#### Task 3.7 — Sync Status Chrome & Encrypted Crash Draft (REV 4: content-diff restore condition)
- **What**: A header indicator reads `syncStatus`: "Saved," "Syncing…," or "Offline" (a save
  failed on what looks like a network error, distinct from a revision conflict — Task 8.3). On
  every local mutation (debounced, not per-keystroke), encrypt `{ pageId, revision: lastSyncedRevision, content }`
  via `encryptField` and write the `{ iv, data }` result to `sessionStorage` under
  `notes-draft:{userId}:{pageId}` — never plaintext. On `beforeunload` and on closing the last tab
  showing a page, attempt (best-effort, not guaranteed) a synchronous flush of any pending save;
  regardless of whether that flush completes, the encrypted draft is the actual safety net, not the
  flush attempt.
  **On next load of that page (REV 4)**: fetch the current server content/revision, decrypt any
  existing draft, and compare *decrypted draft content to decrypted server content* — not
  revision numbers. If they differ at all, prompt "Restore unsaved edits?"; never auto-apply.
  - If the user restores: load the draft's content into local state as the page's working content.
    If `draft.revision === server.revision` (or is stale in a way `savePageContent` would still
    accept), this is a normal dirty page and the next autosave just saves it. If
    `draft.revision < server.revision` — another device saved something in between — the page is
    simply `conflicted` the instant it opens, and the existing Reload/Keep mine banner (Task 8.2)
    handles it exactly as it would any other conflict; no separate restore-conflict UI is built.
  - If the user declines, or draft content matches server content exactly (nothing to restore),
    discard the draft.
  The old rule — "prompt only if `draft.revision >= server.revision`" — is dropped: it silently
  threw away a real, wanted edit whenever another device had saved anything in the interim, which
  is exactly the situation a crash-recovery prompt exists for (Revision 4, item 3).
  All `notes-draft:*` keys are wiped on logout / DEK destroy, alongside the rest of the crypto
  teardown.
- **Where**: `src/components/notes/useNotesStore.tsx`, `src/components/notes/useDebouncedSave.ts`

### Phase 4 — Selection-Aware Formatting Sidebar
#### Task 4.1 — Canvas Selection
- **What**: `selection` (Task 2.1) is `{ kind, blockId? }` on `useNotesStore`; the live Tiptap
  `Editor` for a `kind: "text"` selection is looked up from the per-mount `Map<blockId, Editor>`
  ref (Task 3.5), never stored in the reducer itself.
- **Where**: consumers in `src/components/notes/FormattingSidebar.tsx`, `BlockContextMenu.tsx`

#### Task 4.2 — Right Formatting Panel (Foxit-style, ink controls folded in)
- **What**: One collapsible right sidebar, toggled from the page header. Content depends on
  `pointerTool` first, `selection.kind` second:
  - `pointerTool !== "default"` → ink controls (`InkToolbar`, Task 7.1, rendered as a child section
    of this panel — never a second floating panel).
  - Otherwise, by `selection.kind`: `text` → bold/italic/underline/font size/highlight/color/
    alignment/lists bound to the looked-up editor; `image` → width/height, position, the same
    layer actions as the right-click menu, and Delete; `none` → page-level tools (rename, tags,
    delete page).
  There is exactly one right-side panel component in the DOM at any time.
- **Where**: `src/components/notes/FormattingSidebar.tsx`
- **Reuse**: existing `RichTextEditor` toolbar logic, extended with `extension-underline`/`extension-color`.

### Phase 5 — Tabs & Split View
#### Task 5.1 — Tab/Pane State (single-mount invariant)
- **What**: `panes`/`focusedPaneIndex` (Task 2.1), persisted to `useLocalStorage`, per-device only.
  A given `pageId` is mounted as a live `PageCanvas` at most once across both panes — opening a
  page already open in the other pane focuses the existing tab instead of mounting a second
  instance. The tab strip's title reads and writes the same `PagePlaintext.title` field as the
  sidebar and page header (Task 1.2's `renamePage`).
- **Where**: `src/components/notes/TabbedPaneManager.tsx`

#### Task 5.2 — Split Action (capped at two panes)
- **What**: "Split Right" duplicates the current pane so two pages render side-by-side, each with
  its own tab strip. Once two panes exist, Split is disabled on both.
- **Where**: `src/components/notes/TabbedPaneManager.tsx`

#### Task 5.3 — Per-Page Debounce, Flush, and Empty States
- **What**: `useDebouncedSave` timers are keyed by `pageId`, not by pane — closing one pane's tab
  for a page still open in the other pane must not cancel that page's pending save. Closing the
  **last** tab showing a page force-flushes its pending save via the same path as Task 3.7's
  `beforeunload` handler (and still writes/keeps the encrypted draft as the fallback). Closing the
  last tab in a pane collapses that pane back to single-pane view (Split re-enables). Closing the
  last tab in the last remaining pane shows an empty state ("Open or create a page") rather than a
  dead canvas.
- **Where**: `src/components/notes/useDebouncedSave.ts`, `src/components/notes/TabbedPaneManager.tsx`

### Phase 6 — Backlinks & Hashtags
#### Task 6.1 — Wiki-Link Tiptap Extension
- **What**: Custom Tiptap node via `@tiptap/suggestion`, triggered by `[[`. Suggestions display as
  `Notebook / Section / Title` (disambiguates same-named pages across sections) and store the
  target `page_id`, never the title — renaming a page never breaks the link. If the target
  `page_id` no longer resolves to any page in the tree, the pill renders in a visibly dangling
  style and clicking it does nothing — it never creates a new page on click.
- **Where**: `src/components/notes/tiptap/WikiLinkExtension.ts`

#### Task 6.2 — Outbound Link, Hashtag, and Image Reference Extraction (REV 4: now also extracts image_ids)
- **What**: On content save, scan the saved blocks for wiki-link `page_id`s, `#tag` tokens, and
  (REV 4) every `document_id` referenced by an `image`-type block. If any of the three sets —
  `outbound_links`, `tags`, `image_ids` — differs from the page's current `notes_pages` row, call
  `patchPageLinks` (Task 1.2, now taking all three). This is the single write path that keeps
  `image_ids` accurate; it fires on every content save, the same moment `outbound_links` is kept
  accurate, so there is no separate "sync images" step to forget. Duplicate page titles are allowed
  (the tree groups by notebook/section anyway, and Task 6.1's suggestion list disambiguates by
  path) — no uniqueness constraint or auto-suffixing is applied to `PagePlaintext.title`.
- **Where**: `src/components/notes/useDebouncedSave.ts` (fires alongside Task 3.6's content save)

#### Task 6.3 — Backlink Index
- **What**: `Map<pageId, pageId[]>` of inbound links, built by inverting `outbound_links` across
  the already bulk-decrypted `notes_pages` list — no `page_content` decryption required.
  Recomputed on local metadata change or realtime update.
- **Where**: `src/components/notes/useBacklinkIndex.ts`

#### Task 6.4 — Header/Footer UI, Tag-Click Filtering
- **What**: Page header shows hashtag chips from `PagePlaintext.tags` and the page title (editable
  in place, calling `renamePage` — Task 1.2); page footer shows "Linked mentions" from the
  backlink index. Clicking a hashtag chip sets the sidebar search (Task 2.2) to that tag.
- **Where**: `src/components/notes/PageHeader.tsx`, `src/components/notes/PageFooter.tsx`

### Phase 7 — Drawing Layer
#### Task 7.1 — Ink Toolbar (child of the formatting panel)
- **What**: Pen, Eraser, width slider, color picker, Undo, Redo, Clear (behind `ConfirmDialog`).
  Selecting Pen or Eraser sets `pointerTool` on `useNotesStore`. This component is rendered
  **inside** `FormattingSidebar` (Task 4.2) — it is not a second floating panel, even though it
  lives in its own file for organization.
- **Where**: `src/components/notes/InkToolbar.tsx`

#### Task 7.2 — Stroke Capture (simplified on pointer-up)
- **What**: Pointer events while `pointerTool === "pen"` feed `perfect-freehand` and are recorded
  in page-local coordinates. Raw pointer-rate points are **not** what gets stored: on pointer-up,
  the accumulated point array is simplified/decimated (e.g. Douglas-Peucker or `perfect-freehand`'s
  own simplification) before being appended to `strokes`, so a single stroke doesn't balloon the
  save payload or the realtime broadcast size.
- **Where**: `src/components/notes/InkLayer.tsx`

#### Task 7.3 — Eraser Hit-Testing
- **What**: While `pointerTool === "eraser"`, pointer movement is checked against each stroke's
  point array via point-to-segment distance; a stroke within threshold is removed outright.
- **Where**: `src/components/notes/InkLayer.tsx`

#### Task 7.4 — Local Undo/Redo (ink only)
- **What**: In-memory stack of stroke-array snapshots taken before each draw/erase/clear, popped
  on Undo/Redo. Session-only, separate from Tiptap's text-undo history.
- **Where**: `src/components/notes/useInkHistory.ts`

#### Task 7.5 — Stroke Storage & Rendering
- **What**: Strokes persist through the same debounced CAS autosave as blocks (Task 3.6), rendered
  as an SVG layer z-ordered alongside blocks.
- **Where**: `src/components/notes/InkLayer.tsx`

### Phase 8 — Live Sync
#### Task 8.1 — Realtime Subscription (all four data tables)
- **What**: Subscribe to Postgres Changes on `notes_notebooks`, `notes_sections`, `notes_pages`,
  and `notes_page_content`, filtered to `user_id = eq.<uid>`. Metadata-table events update the tree
  in `useNotesStore` directly. For `notes_page_content` events, pre-filter by the plaintext `id`
  column against currently-open page IDs before decrypting anything.
- **Where**: `src/components/notes/useNotesRealtime.ts`

#### Task 8.2 — Revision-Aware Merge & Conflict Banner (Reload | Keep mine)
- **What**: On a `notes_page_content` event, decrypt and compare its `revision` to
  `pageContents.get(pageId).lastSyncedRevision`:
  - Newer **and** page not dirty → apply silently, update `lastSyncedRevision`.
  - Newer **and** page `dirty` or `conflicted` → do not overwrite; show the banner with exactly two
    actions (Flagged Observation #12):
    - **Reload**: discard local in-memory edits and the `sessionStorage` draft for this page,
      apply the incoming content, set `lastSyncedRevision` to the incoming revision, clear `dirty`.
    - **Keep mine**: call `savePageContent(userId, pageId, localContent, expectedRevision = incomingRevision)`.
      Success produces a new revision and clears `dirty`/the banner. Another conflict (someone else
      wrote in the meantime) re-shows the same banner against the newer revision.
  Metadata-table events always apply directly — there's no "dirty" concept for sidebar metadata.
  **This same banner is what a restored draft that's behind the server (Task 3.7, REV 4) surfaces
  into** — a page can arrive at this state either from a live realtime event or from finding itself
  behind on open; the banner doesn't need to know which.
- **Where**: `src/components/notes/useNotesRealtime.ts`

#### Task 8.3 — Offline Detection & Retry
- **What**: A failed save that looks like a network error (not a `RevisionConflictError`) sets
  `syncStatus` to `"offline"` rather than surfacing the conflict banner. The browser's `online`
  event retries the pending debounced save automatically.
- **Where**: `src/components/notes/useNotesRealtime.ts`, `src/components/notes/useDebouncedSave.ts`

### Phase 9 — Routing & Store
#### Task 9.1 — Notes Routes
- **What**: `/notes` (main shell, reads/writes `?page=` via `useNotesStore`), `/notes/store`
  (`<GenericStorePage storeType="doc" domain="notes" />`).
- **Where**: `src/app/(protected)/notes/page.tsx`, `src/app/(protected)/notes/store/page.tsx`, `src/routes/paths.ts`

## New Reusable Components Introduced
| Component | Path | Purpose | Reusable for |
|-----------|------|---------|--------------|
| `useNotesStore` | `src/components/notes/useNotesStore.tsx` | Single reducer-backed store for tree, tabs/panes, in-memory page contents, pointer tool, and ref-based selection — with "open a page" guaranteed to select/mount a text block | Any future multi-pane/multi-document editor |
| `FloatingBlock` | `src/components/notes/FloatingBlock.tsx` | `react-rnd` drag/resize wrapper, Figma-style z-order menu, handle-only dragging, lazy Tiptap mount, click-to-select | Any future freeform surface |
| `InkLayer` + `useInkHistory` | `src/components/notes/InkLayer.tsx` | Drawing overlay, eraser hit-testing, local undo/redo, page-local coordinates, pointer-up simplification | Any future annotation feature |
| `FormattingSidebar` (+ child `InkToolbar`) | `src/components/notes/FormattingSidebar.tsx` | Selection-aware and pointer-tool-aware single right panel | Any screen with selectable elements plus an active drawing mode |
| `WikiLinkExtension` | `src/components/notes/tiptap/WikiLinkExtension.ts` | `[[ ]]` autocomplete storing a stable id, dangling-link handling | Any future rename-safe cross-referencing |
| `useNotesRealtime` | `src/components/notes/useNotesRealtime.ts` | Revision-aware, non-destructive multi-table realtime pattern, also the landing spot for open-time conflicts | First realtime infra in the app |
| `TabbedPaneManager` | `src/components/notes/TabbedPaneManager.tsx` | Multi-tab + capped two-pane manager, single-mount-per-document enforcement | Any future multi-document editor |
| `ConfirmDialog` (relocated) | `src/components/common/ConfirmDialog.tsx` | App-wide delete confirmation, no longer cross-domain-imported from Task Manager | Every domain |

## Verification Plan
- [ ] Clicking empty paper with < 8px of movement selects and mounts the flow block and places a caret at the end of it; dragging ≥ 8px creates a floating box sized to the drag rectangle and selects it.
- [ ] The flow editor's height tracks its content and never expands to fill the sheet; a short note still allows a floating box to be created in the empty space below it.
- [ ] Migration runs exactly once even when two tabs open `/notes` for the first time simultaneously; killing the browser mid-migration and reopening `/notes` completes the migration rather than leaving it permanently stuck.
- [ ] **(REV 4)** Two legacy notes whose content starts with identical text both survive migration as two distinct pages, each carrying its own correct `migrated_from` id — verify by checking `migrated_from` on both, not by title.
- [ ] **(REV 4)** Killing the migrating tab partway through and letting another tab steal the claim does not duplicate any already-migrated page — verify by counting migrated pages against the legacy row count after a forced steal.
- [ ] A brand-new account with no legacy notes lands on an auto-created "My Notebook / General / Untitled" page, ready to type immediately with no extra click needed to focus it.
- [ ] **(REV 4)** Opening any existing page — from the tree, a tab, a backlink, or a `?page=` deep link — always lands with the flow block already selected and mounted; no page requires a click before typing works.
- [ ] Notes tile no longer appears inside Task Manager; `/notes` works as a standalone dashboard tile.
- [ ] Notebooks/sections/pages can be created, renamed (from sidebar, tab, and page header — all three update the same title), reordered by drag, and deleted with an accurate item-count confirmation; deleting a notebook removes its sections, pages, page content, and only the images no other surviving page references.
- [ ] **(REV 4)** An image placed on a page in Notebook A that is also referenced by a page in Notebook B survives deleting Notebook A, even when the Notebook B page has never been opened this session (verify the `documents` row/file still exists and `image_ids` on the surviving page still lists it).
- [ ] **(REV 4)** Deleting the only page that references an image removes the underlying `documents` row/file; deleting one of two pages that reference it does not.
- [ ] The tree search box filters by title and `#tag` with no server round-trip; sidebar expand/collapse state does not round-trip through the encrypted notebook blob (confirm no network write on expand/collapse).
- [ ] `/notes?page=<id>` opens the right page on load; back/forward navigates between opened pages.
- [ ] Dragging from a floating text box's border moves it; dragging from inside its text content selects text instead.
- [ ] Scrolling the page does not visibly shift any floating box or ink stroke relative to the text under it.
- [ ] A long flow body and, separately, a page with many spread-out floating boxes both grow the sheet instead of clipping.
- [ ] Pasting an image inside an active text block does not leave a base64 data URL embedded in that block's HTML; the image lands as a separate floating block instead, and its `document_id` appears in the page's `image_ids` after the next save.
- [ ] Opening a page with 15 floating text boxes and clicking through them one at a time never has more than one live Tiptap instance mounted at once (verify via a mount counter in dev, not just visually).
- [ ] Switching to Pen or Eraser shows ink controls in the same single right panel regardless of what was previously selected; there is never a second floating toolbar on screen.
- [ ] `[[` suggestions display as `Notebook / Section / Title`; renaming a linked page doesn't break the link; deleting a link's target turns the pill dangling and unclickable (it does not create a new page); typing an unmatched `[[Foo]]` and clicking it does nothing.
- [ ] `#tags` appear as header chips without any `notes_page_content` decrypt in that code path; clicking a chip filters the sidebar list.
- [ ] Opening the same page already open in the other pane focuses the existing tab instead of mounting a second editor; closing one pane's tab for a page still open elsewhere does not cancel that page's pending autosave; closing the last tab in a pane collapses the split; closing the last tab overall shows an empty state, not a dead canvas.
- [ ] Editing the same page in two tabs: the dirty tab shows the Reload/Keep mine banner (not a silent overwrite) when a remote edit lands; choosing Reload discards local changes and the draft; choosing Keep mine writes successfully against the revision it was shown and a second concurrent conflict re-shows the banner instead of silently succeeding twice.
- [ ] Force-closing a tab (or simulating a crash) with an edit still in the debounce window: on reopening the same page in the same browser, a "Restore unsaved edits?" prompt appears rather than the edit silently vanishing or silently reapplying; inspecting `sessionStorage` directly shows only `{iv, data}`, never readable HTML or point arrays.
- [ ] **(REV 4)** Simulate a crash draft made against revision 5, then have another (simulated) device push revision 6 before the page is reopened: the restore prompt still appears (content differs from server), and restoring correctly lands the page in a `conflicted` state that the Reload/Keep mine banner handles — the draft is not silently dropped just because the server has moved on.
- [ ] Typing in an IME composition (e.g. a CJK input method) does not trigger a mid-composition autosave.
- [ ] A change on one device — including creating a notebook — appears on another idle, already-open session within ~3 seconds without a manual refresh.
- [ ] The header sync indicator shows Saved/Syncing/Offline correctly, and a save made while offline retries automatically on reconnect.
- [ ] `/notes/store` lists and manages standalone Notes files identically to other domain stores; uploading a file does not 400 from the R2 storage route.
- [ ] On a narrow viewport, both side panels default to collapsed on first load and remain independently toggleable and persisted afterward.

---

# Human Actions: Notes Domain

**Paired with**: [PLAN-notes.md](./PLAN-notes.md) (Revision 4)
**Date**: 2026-09-06

## Action Index

| # | Action | When | Where | Blocking? |
|---|--------|------|-------|-----------|
| 1 | Create Supabase Tables (`notes_notebooks`, `notes_sections`, `notes_pages`, `notes_page_content`, `notes_migration_lock`) | Before Phase 1 | Supabase SQL Editor | Yes |
| 2 | Enable Realtime Replication on all four `notes_*` data tables | Before Phase 8 | Supabase Dashboard → Database → Replication | Yes (for Phase 8 only) |
| 3 | Decide and communicate the Stage 7 / Phase 0 sequencing | Before Phase 0, Task 0.2 | Project planning | Yes, to avoid wasted refactor work |

There is no Human Action for the R2 storage allow-list — it is Task 1.5, an agent code edit.
There is no Human Action for any of the three Revision 4 fixes — all three are pure application
logic (`migrated_from` field, `image_ids` field, store/selection wiring, and a restore-condition
change); none require a schema change, a dashboard toggle, or a new table/column.

## Detailed Actions

### HA-01 — Create Supabase Tables
- **When**: Before beginning implementation (Phase 1).
- **Where**: Supabase SQL Editor.
- **What**: Run the full DDL block from the Data Model section above — five tables (including the
  `revision` column on `notes_page_content` and the two-phase `notes_migration_lock`, which
  deliberately has no `created_at` column — see Flagged Observation #18), RLS enabled, policies
  created, `user_id` indexes created.
- **Why this can't be automated**: The agent has no direct database connection or dashboard access.
- **Blocking**: Yes — Phase 1's APIs cannot be tested without these tables.

### HA-02 — Enable Realtime Replication
- **When**: Before starting Phase 8 (can be done any time earlier with no effect).
- **Where**: Supabase Dashboard → Database → Replication.
- **What**: Toggle Realtime on for `public.notes_notebooks`, `public.notes_sections`,
  `public.notes_pages`, and `public.notes_page_content` — all four (Task 8.1).
- **Why this can't be automated**: Replication toggles are dashboard-only, no SQL equivalent.
- **Blocking**: Yes, but only for Phase 8 — every earlier phase works fully without it.

### HA-03 — Sequence This Plan Against the Global Architecture Refactor
- **When**: Before Phase 0, Task 0.2 (deleting `/taskmanager/notes`).
- **Where**: Wherever both roadmaps are tracked and prioritized.
- **What**: Confirm whether Stage 7 of the global refactor has already migrated
  `/taskmanager/notes` onto `GenericViewPage` by the time this plan reaches Task 0.2. If not, either
  do Task 0.2 first, or strike `/taskmanager/notes` from the Stage 7 route list so that work isn't
  built and then immediately deleted.
- **Why this can't be automated**: A project-sequencing decision between two independent plans.
- **Blocking**: Yes, in the sense that doing it wrong wastes work.