# Feature 1 — Task Manager (`/taskmanager`)

> Pre-requisite for **PLAN-crypto.md Phase 7** (encrypt/decrypt wrappers for data layer).  
> This is the first feature that writes and reads user data through the crypto pipeline.  
> **Companion docs:** [`context.md`](./context.md), [`PLAN-crypto.md`](./PLAN-crypto.md), [`schema.md`](./schema.md).

---

## Overview

A personal task and notes manager at `/taskmanager`. Two distinct data entities — **tasks** and **notes** — each stored in their own Supabase table following the encrypted-blob pattern from Phase 7.

Because all sensitive fields live inside a single AES-GCM ciphertext blob per row, **all filtering, sorting, and grouping happens client-side** after decryption. Supabase only stores opaque `iv` + `data` columns per row.

### Year-end lifecycle (context only — not in scope for this feature)

The app is designed around a **calendar-year cycle**: at year-end the user exports/emails their data, then resets the database for a fresh year. This informs two design choices in the task manager:

1. Data volumes stay small (one year of tasks) — client-side decrypt-then-filter is always fast.
2. Month-based views align naturally with this cycle (Jan → Dec + a "Next Year" overflow tile).

---

## Wireframe Summary

### Main View — `/taskmanager`

The page has a **static 3-box layout** — the boxes themselves don't scroll or resize, but the **content inside each box is independently scrollable**.

```
┌──────────────────────────────────────────────────────────────┐
│  /taskmanager                                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Tasks  [Priority ▾ | Months]       [+ Add]    Completed     │
│  ┌───────────────────────────────────────┐ ┌───────────────┐ │
│  │ ↕ scrollable                          │ │ ↕ scrollable  │ │
│  │                                       │ │ Task1         │ │
│  │ ▸ Critical                            │ │ Task1         │ │
│  │ ┌─────────────────────────────────┐   │ │ Task1         │ │
│  │ │ Task  Due Date   Mode   Description │ │               │ │
│  │ │ T1    2026-04-15  On    ...     │   │ │  >>View all   │ │
│  │ └─────────────────────────────────┘   │ └───────────────┘ │
│  │ ▸ High                                │                   │
│  │ ┌─────────────────────────────────┐   │  Notes  [+ Add]   │
│  │ │ T2    2026-04-20  Off   ...     │   │ ┌───────────────┐ │
│  │ │ T3    2026-05-01  On    ...     │   │ │ ↕ scrollable  │ │
│  │ └─────────────────────────────────┘   │ │ Note1         │ │
│  │ ▸ Medium                              │ │ Note1         │ │
│  │ ┌─────────────────────────────────┐   │ │ Note1         │ │
│  │ │ T4    —           Off   ...     │   │ │               │ │
│  │ └─────────────────────────────────┘   │ │  >>View all   │ │
│  │                                       │ └───────────────┘ │
│  └───────────────────────────────────────┘                   │
└──────────────────────────────────────────────────────────────┘
```

- **Left / main area:** Active tasks in one of two switchable views (toggle at the top):
- **Priority view** (default) — flat table with columns: Task, Priority, Due Date, Mode, Description. Sorted by priority descending (Critical → High → Medium → Low), then by due date ascending within each level.
  - **Months view** — tasks grouped by their `due_date` month (January → December). Tasks with no due date go into an "Unscheduled" group. Tasks whose due date falls in the **next calendar year** appear in a **"Next Year"** tile after December.
- **Top-right:** Completed tasks — scrollable compact list showing task names and completion dates in separate columns, with a quick `< Reopen` action per row. `>>View all` opens the expanded view as a hash-modal (`/taskmanager#completed`).
- **Bottom-right:** Notes — scrollable compact list. `+ Add` opens the notes modal. `>>View all` opens expanded view (`/taskmanager#notes`).

### Task Modal (shared for Create / Edit / View)

```
┌──────────────────────────────────────────────────────────────┐
│  /taskmanager                                                │
│  ┌────────────────────────────────────────────────┐          │
│  │                                                │          │
│  │  [Task modal — overlay]                        │          │
│  │                                                │          │
│  │  Task Name:     ___________________________    │          │
│  │  Priority:      [Low | Medium | High | Critical]          │
│  │  Due Date:      [date picker]                  │          │
│  │  Mode:          [Online | Offline]             │          │
│  │  Task Description: [textarea]                  │          │
│  │                                                │          │
│  │  [☐ Mark Complete]                             │          │
│  │                        [Save] [Delete] [Cancel]│          │
│  │                                                │          │
│  └────────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────────┘
```

- **One modal for all three actions.** `+ Add` opens it blank for creation. Clicking a task row opens it pre-filled in edit mode (which also serves as the view).
- Modal overlays the main page content (no route change).
- **Delete** requires a confirmation dialog before permanent removal.
- Active task rows include a **`Complete >`** quick-action link in the outside list view (in addition to the modal checkbox flow).

### Completed Tasks — Expanded View (`/taskmanager#completed`)

```
┌──────────────────────────────────────────────────────────────┐
│  /taskmanager#completed                                      │
│  ┌────────────────────────────────────────────────┐          │
│  │                                                │          │
│  │  Completed Tasks    [Priority ▾ | Months]      │          │
│  │                                                │          │
│  │  ── Months view ──                             │          │
│  │                                                │          │
│  │  April 2026                                    │          │
│  │  ──────────                                    │          │
│  │  Task1   completed 2026-04-10                  │          │
│  │  Task2   completed 2026-04-08                  │          │
│  │                                                │          │
│  │  March 2026                                    │          │
│  │  ──────────                                    │          │
│  │  Task3   completed 2026-03-22                  │          │
│  │                                                │          │
│  │  ── OR Priority view ──                        │          │
│  │                                                │          │
│  │  Critical                                      │          │
│  │  ──────────                                    │          │
│  │  Task2   completed 2026-04-08                  │          │
│  │                                                │          │
│  │  High                                          │          │
│  │  ──────────                                    │          │
│  │  Task1   completed 2026-04-10                  │          │
│  │                                                │          │
│  └────────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────────┘
```

- Opens as a **hash-modal** at `/taskmanager#completed` (URL-navigable — typing the hash URL directly opens the modal).
- **Two view toggles** matching the active tasks box: Priority view and Months view.
  - **Months view:** grouped by `completed_at` month/year. Newest month first.
  - **Priority view:** grouped by priority level (Critical → High → Medium → Low). Newest first within each group.
- Clicking a completed task **re-opens the task modal** in edit mode — user can un-complete it (set `is_completed = false`) to move it back to active tasks.
- Completed rows in both compact and expanded views include a quick **`< Reopen`** link action.
- All grouping/sorting is client-side.

### Notes Modal (Create / Edit)

```
┌──────────────────────────────────────────────────────────────┐
│  /taskmanager                                                │
│  ┌────────────────────────────────────────────────┐          │
│  │                                                │          │
│  │  [Notes modal — overlay]                       │          │
│  │                                                │          │
│  │  Content:  [textarea]                          │          │
│  │                                                │          │
│  │                    [Save] [Delete] [Cancel]     │          │
│  │                                                │          │
│  └────────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────────┘
```

- `+ Add` opens blank for creation. Clicking a note opens it for viewing/editing.
- Same shared-modal pattern as tasks.
- **Delete** requires a confirmation dialog before permanent removal.

### Notes — Expanded View (`/taskmanager#notes`)

- Opens as a **hash-modal** at `/taskmanager#notes`.
- Flat list, sorted by `created_at` descending (newest first).
- Clicking a note opens it in the note edit modal.

---

## Data Model

### Supabase Tables

Both tables follow the Phase 7 encrypted-blob convention: only `id`, `user_id`, `iv`, `data`, `created_at` are stored as columns. All actual fields live inside the encrypted `data` JSON blob.

#### `public.tasks`

| Column       | Type          | Nullable | Default              | Notes                                           |
|--------------|---------------|----------|----------------------|-------------------------------------------------|
| `id`         | `UUID`        | NO       | `gen_random_uuid()`  | PK                                              |
| `user_id`    | `UUID`        | NO       | —                    | FK → `auth.users(id) ON DELETE CASCADE`          |
| `iv`         | `TEXT`        | NO       | —                    | Per-record AES-GCM IV (Base64)                   |
| `data`       | `TEXT`        | NO       | —                    | Base64 ciphertext (encrypted JSON blob)          |
| `created_at` | `TIMESTAMPTZ` | YES      | `now()`              | Row creation timestamp (not sensitive — plaintext)|

**Encrypted JSON blob shape** (plaintext inside `data` after decryption):

```typescript
interface TaskPlaintext {
  name: string;
  priority: "low" | "medium" | "high" | "critical";
  due_date: string | null;  // ISO 8601 date (YYYY-MM-DD), nullable
  mode: "online" | "offline";
  description: string;
  is_completed: boolean;
  completed_at: string | null; // ISO 8601 datetime, set when marked complete
  updated_at: string;          // ISO 8601 datetime, last edit timestamp
}
```

#### `public.notes`

| Column       | Type          | Nullable | Default              | Notes                                           |
|--------------|---------------|----------|----------------------|-------------------------------------------------|
| `id`         | `UUID`        | NO       | `gen_random_uuid()`  | PK                                              |
| `user_id`    | `UUID`        | NO       | —                    | FK → `auth.users(id) ON DELETE CASCADE`          |
| `iv`         | `TEXT`        | NO       | —                    | Per-record AES-GCM IV (Base64)                   |
| `data`       | `TEXT`        | NO       | —                    | Base64 ciphertext (encrypted JSON blob)          |
| `created_at` | `TIMESTAMPTZ` | YES      | `now()`              | Row creation timestamp (not sensitive — plaintext)|

**Encrypted JSON blob shape** (plaintext inside `data` after decryption):

```typescript
interface NotePlaintext {
  content: string;        // Note body text
  updated_at: string;     // ISO 8601 datetime, last edit timestamp
}
```

### DDL (to run in Supabase SQL Editor)

```sql
-- Tasks table
CREATE TABLE public.tasks (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    iv         TEXT NOT NULL,
    data       TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own tasks"
    ON public.tasks
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Notes table
CREATE TABLE public.notes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    iv         TEXT NOT NULL,
    data       TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own notes"
    ON public.notes
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
```

### Why everything is in the encrypted blob

- **Threat model:** Supabase (or anyone with DB access) cannot read task names, descriptions, priorities, dates, or note contents. Only the user's browser with the DEK can decrypt.
- **Trade-off:** No server-side filtering or sorting. All data is fetched as opaque rows, decrypted client-side, then filtered/sorted/grouped in memory.
- **Scalability note:** For a personal tracker with 1–3 users, this is fine. Hundreds or even low thousands of tasks/notes decrypt in well under a second with AES-GCM.

---

## Encryption Integration (Phase 7 Wiring)

This feature is the trigger to complete **PLAN-crypto.md Phase 7**. The patterns:

### Write path (create / update)

```typescript
import { encryptField } from "@/lib/crypto";

const plaintext: TaskPlaintext = { name, priority, due_date, mode, description, is_completed: false, completed_at: null, updated_at: new Date().toISOString() };
const encrypted = await encryptField(userId, JSON.stringify(plaintext));

await supabase.from("tasks").insert({
  user_id: userId,
  iv: encrypted.iv,
  data: encrypted.ciphertext,
});
```

### Read path (list / view)

```typescript
import { decryptField } from "@/lib/crypto";

const { data: rows } = await supabase.from("tasks").select("*").eq("user_id", userId);

const tasks = await Promise.all(
  rows.map(async (row) => {
    const plaintext = await decryptField(userId, row.iv, row.data);
    return { id: row.id, created_at: row.created_at, ...JSON.parse(plaintext) };
  })
);
```

### Update path (edit task / mark complete)

Re-encrypt the full blob with a **new IV** on every update (IV reuse is a security failure for AES-GCM):

```typescript
const updated: TaskPlaintext = { ...existing, name: newName, updated_at: new Date().toISOString() };
const encrypted = await encryptField(userId, JSON.stringify(updated));

await supabase.from("tasks").update({ iv: encrypted.iv, data: encrypted.ciphertext }).eq("id", taskId);
```

---

## UI Behavior Details

### Main `/taskmanager` Page — Static 3-Box Layout

The page is a fixed layout with three boxes. The boxes themselves are static (no page-level scrolling needed); only their **inner content scrolls** independently.

#### Box 1 — Active Tasks (left / main area)

- Shows all tasks where `is_completed === false` (filtered client-side after decryption).
- **Two switchable views** via a toggle at the top of the box:

  **Priority view (default):**
  - Tasks grouped into **4 sub-sections** (sub-rectangles stacked vertically): **Critical**, **High**, **Medium**, **Low** — in that order top-to-bottom.
  - Each sub-section has a header label and contains only the tasks of that priority level, displayed as rows with columns: Task, Due Date, Mode, Description.
  - Within each sub-section, sorted by due date ascending (nearest deadline first); tasks with no due date sort last.
  - Empty sub-sections stay visible and render `None`.

  **Months view:**
  - Tasks grouped by their `due_date` month: January tile, February tile, … December tile.
  - All month tiles are rendered, including empty tiles, with `None` when no tasks are present.
  - Tasks with no due date appear in an **"Unscheduled"** group.
  - **Next-year edge case:** if a task's `due_date` falls in the next calendar year (e.g. a December task has a January due date), it appears in a **"Next Year"** tile rendered after December. This avoids confusion during the year-end cycle.
  - Within each month, sorted by due date ascending.

- Clickable rows — clicking any row opens the task modal in edit mode.
- Rows also include a quick **Complete** button to mark the task complete without opening the modal.
- `+ Add` button opens the task modal in create mode.

#### Box 2 — Completed Tasks (top-right)

- Scrollable compact list showing completed task names + completion dates (sorted by `completed_at` descending).
- Each compact completed row also includes a quick `< Reopen` action.
- `>>View all` navigates to `/taskmanager#completed` which opens the completed-tasks expanded modal.

#### Box 3 — Notes (bottom-right)

- Scrollable compact list showing note content (truncated).
- `+ Add` button opens the notes modal in create mode.
- `>>View all` navigates to `/taskmanager#notes` which opens the notes expanded modal.

### Task Modal (Create / Edit)

- **Single modal component** used for create, edit, and view.
- **Create mode:** opened via `+ Add` button. All fields blank. Save encrypts and inserts a new row.
- **Edit mode:** opened by clicking a task row (active or completed). Fields pre-filled with decrypted data. Save re-encrypts with a new IV and updates.
- **No separate "view" mode** — edit mode is the view.
- **Mark as complete** — a checkbox in the modal. Checking it sets `is_completed = true` and `completed_at = now()`. Task moves from active box to completed box on save.
- **Un-complete** — for completed tasks, unchecking the checkbox sets `is_completed = false` and `completed_at = null`. Task moves back to active box on save.
- **Delete** — button in the modal. Opens a **confirmation dialog** ("Are you sure? This cannot be undone.") before permanent hard-delete from Supabase.

### Completed Tasks — Expanded Modal (`/taskmanager#completed`)

- Opened via `>>View all` or by navigating directly to `/taskmanager#completed`.
- Closing the modal removes the hash from the URL (back to `/taskmanager`).
- **Two view toggles** (same grouped-sub-section pattern as the active tasks box):
  - **Priority view:** 4 sub-sections (Critical → High → Medium → Low). Each sub-section lists completed tasks of that priority. Sorted by `completed_at` descending (newest first) within each group. Empty groups hidden.
  - **Months view:** sub-sections grouped by `completed_at` month/year (e.g. "April 2026", "March 2026"). Newest month first. Same next-year tile logic applies if `completed_at` crosses the year boundary. Empty months hidden.
- Clicking a completed task opens the task modal in edit mode (allows un-completing).
- Expanded completed rows include a quick `< Reopen` action.

### Notes Modal (Create / Edit)

- Same shared-modal pattern as tasks.
- **Create mode:** `+ Add` → blank textarea → Save encrypts and inserts.
- **Edit mode:** clicking a note → pre-filled → Save re-encrypts with new IV and updates.
- **Delete** — confirmation dialog before permanent removal.

### Notes — Expanded Modal (`/taskmanager#notes`)

- Opened via `>>View all` or by navigating directly to `/taskmanager#notes`.
- Flat list, sorted by `created_at` descending (newest first).
- Clicking a note opens the note edit modal.

### Hash-Based Modal Navigation

All expanded views use URL hashes so they are **URL-navigable**:

| Hash | Opens |
|------|-------|
| `/taskmanager#completed` | Completed tasks expanded modal |
| `/taskmanager#notes` | Notes expanded modal |
| `/taskmanager` (no hash) | Main 3-box view, no modal |

On page load, the app reads `window.location.hash` and opens the corresponding modal if present. Closing a modal uses `history.replaceState` to strip the hash without a page reload.

### Empty States

When a box or modal has no data to display, show a minimal text: **"None"**.

---

## Resolved Design Decisions

| # | Question | Answer |
|---|----------|--------|
| 1 | `mode` values | `"online"` or `"offline"` — binary choice, no free-form. |
| 2 | `priority` values | `"low"`, `"medium"`, `"high"`, `"critical"` — four levels. |
| 3 | Active tasks view structure | **Both views are grouped sub-sections** (sub-rectangles stacked vertically), not a flat sorted list. **Priority view:** 4 groups (Critical / High / Medium / Low), due date asc within each, empty groups show `None`. **Months view:** Jan–Dec groups + Unscheduled + Next Year, due date asc within each, empty groups show `None`. |
| 4 | Completed task re-opening | Yes — clicking a completed task opens the task modal; user can un-complete to move it back to active. |
| 5 | Notes linking | Standalone — notes are not linked to tasks. |
| 6 | Preview counts | No truncation — all items shown in scrollable boxes. Content scrolls; the box frame is static. |
| 7 | `>>View all` navigation | Hash-based modals (`/taskmanager#completed`, `/taskmanager#notes`). URL-navigable. |
| 8 | Delete confirmation | Yes — confirmation dialog required before permanent delete (tasks and notes). |
| 9 | Empty states | Show "None". |

---

## Proposed File Structure

```
src/
├── api/
│   ├── auth/
│   │   ├── auth.ts                  # login, logout, changePassword, getSession
│   │   ├── keys.ts                  # fetchUserKeys, upsertUserKeys
│   │   └── index.ts                 # Sub-barrel re-exports auth + keys
│   ├── taskmanager/
│   │   ├── tasks.ts                 # CRUD for tasks table (encrypt/decrypt wired in)
│   │   ├── notes.ts                 # CRUD for notes table (encrypt/decrypt wired in)
│   │   └── index.ts                 # Sub-barrel re-exports tasks + notes
│   └── index.ts                     # Top-level barrel (re-exports from all feature barrels)
├── app/(protected)/
│   └── taskmanager/
│       └── page.tsx                 # Main task manager page (server component shell)
├── components/taskmanager/
│   ├── TaskManagerView.tsx          # Client component — orchestrates 3-box layout + hash modals
│   ├── ActiveTasksBox.tsx           # Box 1: active tasks with priority/months view toggle
│   ├── CompletedTasksBox.tsx        # Box 2: compact scrollable completed list
│   ├── NotesBox.tsx                 # Box 3: compact scrollable notes list
│   ├── CompletedTasksModal.tsx      # Expanded modal — priority/months views for completed
│   ├── NotesModal.tsx               # Expanded modal — full notes list
│   ├── TaskModal.tsx                # Shared create/edit modal for a single task
│   ├── NoteModal.tsx                # Shared create/edit modal for a single note
│   ├── ConfirmDialog.tsx            # Reusable delete confirmation dialog
│   └── ViewToggle.tsx               # Reusable priority/months view switcher
├── types/
│   └── taskmanager.ts               # TaskPlaintext, NotePlaintext, TaskView, etc.
└── routes/
    └── paths.ts                     # Add TASK_MANAGER route
```

---

## Implementation Phases

| Phase | What | Depends on | Status |
|-------|------|------------|--------|
| **F1.1** | Supabase: create `tasks` + `notes` tables + RLS (human, SQL Editor) | Nothing | **Done** (2026-04-12) |
| **F1.2** | Phase 7 completion: verify `encryptField` / `decryptField` work end-to-end with a real table | F1.1 | **Done** (2026-04-12) |
| **F1.3** | Types + API layer: `src/types/taskmanager.ts`, `src/api/taskmanager/tasks.ts`, `src/api/taskmanager/notes.ts` | F1.2 | **Done** (2026-04-12) |
| **F1.4** | Route + page shell: `/taskmanager` route, `page.tsx`, `TaskManagerView.tsx` with 3-box layout | F1.3 | **Done** (2026-04-12) |
| **F1.5** | Active tasks box: priority view + months view + view toggle | F1.4 | **Done** (2026-04-12) |
| **F1.6** | Task modal: create / edit / mark complete / un-complete / delete with confirmation | F1.5 | **Done** (2026-04-12) |
| **F1.7** | Completed tasks: box preview + hash-modal expanded view with priority/months toggle | F1.6 | **Done** (2026-04-12) |
| **F1.8** | Notes: box preview + note modal (create/edit/delete) + hash-modal expanded view | F1.4 | **Done** (2026-04-12) |
| **F1.9** | Entry integration: activate dashboard Task Manager tile as primary route entry (no feature button in Navbar) | F1.4 | **Done** (2026-04-12) |
| **F1.10** | Polish: empty states ("None"), loading states, error handling, responsive layout | F1.5–F1.8 | **Done** (2026-04-12) |

---

## Revision Log

| Date       | Change |
|------------|--------|
| 2026-04-11 | Initial draft based on wireframes and discussion. |
| 2026-04-11 | Revision 1: Resolved all open questions. Added priority/months dual-view for active + completed tasks. Added hash-based modals for `>>View all`. Defined mode (`online`/`offline`), priority (4 levels incl. `critical`), un-complete flow, delete confirmation, empty states ("None"), scrollable-content static-box layout, next-year edge case for months view. Year-end lifecycle context added. |
| 2026-04-11 | Revision 2: Clarified that Priority and Months views are **grouped sub-section layouts** (sub-rectangles stacked vertically with headers), not flat sorted tables. Updated wireframe to show grouped sub-rectangles. Priority column removed from per-row display in priority view (redundant when grouped). |
| 2026-04-12 | **F1.1 done** (human): `tasks` + `notes` tables + RLS created in Supabase. `schema.md` updated. |
| 2026-04-12 | **F1.2 done**: Crypto Phase 7 verified. `encryptField(userId, plaintext)` → `{ iv, ciphertext }` maps to `iv`/`data` columns. `decryptField(userId, iv, ciphertext)` → plaintext. No crypto module changes needed. PLAN-crypto.md Phase 7 marked complete. |
| 2026-04-12 | **F1.3 done**: `src/types/taskmanager.ts` (TaskPlaintext, NotePlaintext, Task, Note, Priority, TaskMode, TaskView, PRIORITIES const). `src/api/taskmanager/tasks.ts` (fetchTasks, createTask, updateTask, deleteTask). `src/api/taskmanager/notes.ts` (fetchNotes, createNote, updateNote, deleteNote). Barrel updated. |
| 2026-04-12 | **F1.3 remediation**: Restructured `src/api/` from flat files to feature-grouped subdirectories (`auth/`, `taskmanager/`). Added sub-barrel `index.ts` per feature. Moved existing `auth.ts`+`keys.ts` into `auth/`. Top-level barrel re-exports from sub-barrels — zero consumer import-path changes except `crypto/manager.ts` (`@/api/keys` → `@/api/auth`). Future features slot in as new subdirectories. |
| 2026-04-12 | **Doc alignment pass**: F1.3 phase-table file paths updated to `src/api/taskmanager/*` to match the post-remediation API structure. |
| 2026-04-12 | **F1.4 done**: Added `ROUTES.TASK_MANAGER`, created `src/app/(protected)/taskmanager/page.tsx`, and created `src/components/taskmanager/TaskManagerView.tsx` with the static 3-box shell layout (Tasks, Completed, Notes) and scrollable inner content containers. |
| 2026-04-12 | **F1.5–F1.8 done (frontend)**: Implemented modular task manager components (`ActiveTasksBox`, `CompletedTasksBox`, `NotesBox`, `TaskModal`, `NoteModal`, `CompletedTasksModal`, `NotesModal`, `ConfirmDialog`, `ViewToggle`, `ModalFrame`, shared helpers). Wired client-side session+data loading, active/completed split views (priority/months), hash-modals (`#completed`, `#notes`), task/note CRUD forms, completion/un-completion flow, and delete confirmations. |
| 2026-04-12 | **F1.9 done (revised)**: Activated dashboard Task Manager tile as the primary entry point to `/taskmanager`; removed Task Manager button from `Navbar` to keep feature access tile-driven. |
| 2026-04-12 | **F1.10 done**: Polish pass completed — loading states are rendered inside each box, error banner includes retry action, hash-modal close preserves URL query parameters, and active task rows use responsive stacked-on-mobile layout for readability. |
| 2026-04-12 | **Task field naming update**: Renamed task `note` to `description` (Task Description) in task data model, task modal, task row rendering, and taskmanager docs. |
| 2026-04-12 | **Task manager UX update**: Active task priority/month groups now always render (empty groups show `None`), active task rows include quick Complete action, and completed-task compact list now shows completion date alongside task name. |
| 2026-04-12 | **Task row action polish**: Quick complete action styled as hyperlink (`Complete >`); completed rows now use bordered two-column layout (name/date) and include quick `< Reopen` action in both compact and expanded views. |
