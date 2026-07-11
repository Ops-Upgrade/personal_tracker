# Global Rules (all personas, all tasks)

## Source of truth
- /docs is the authoritative source for architecture, schema, and prior
  plans. Read it before any plan is produced. Treat docs/schema.* as
  authoritative over what the code currently does — if they conflict,
  flag the drift instead of silently trusting either one.

## Branching
- The user manages branches. Do not create, switch, or delete branches.
  Work on whatever branch is currently checked out.
- Never commit directly to the base branch (main/master).

## Approval gates
- Do not proceed past the Implementation Plan without explicit user
  approval.
- Do not proceed past the Reviewer's output without explicit user
  decision to iterate or finish.

## Scope discipline
- Do not modify files not listed in the approved plan.
- Do not modify database schema unless the plan explicitly says so.
- Do not rename existing public interfaces/endpoints unless the plan
  explicitly says so.

## Style
- Match existing code style and conventions found in the repo; do not
  introduce a new pattern where an existing one already covers the case.
- Commit messages: <type>: <short summary>  (e.g. feat: add refresh
  token validation)

## When uncertain
- Report ambiguity to the user rather than guessing. Never invent
  requirements not present in the plan or /docs.

## Code comprehension
- Before writing new code, read the existing files that will be modified
  or are closely related. Do not assume structure — open the files.
- Search the codebase for existing utilities, components, or helpers
  before creating new ones. Do not re-implement functionality that
  already exists.

## Code reuse
- This project has shared locations for cross-domain utilities.
  Before creating a new utility, component, hook, constant, or API
  helper, check these locations first:
    - src/lib/              — shared utilities, hooks, constants, formatters
    - src/api/common/       — shared API patterns (e.g. encrypted file storage)
    - src/components/common/ — shared UI components (ModalFrame, Icons,
      FileUploadZone, ErrorBanner, DocPreviewPanel, BoxContainer, etc.)
- If a utility or component is needed by more than one domain
  (taskmanager, expense, education), it must live in a shared location —
  never duplicated per domain folder.
- Do not define inline SVG icon functions in component files. Import
  icons from @/components/common/Icons.tsx or lucide-react.
- Do not duplicate constants (MONTH_NAMES, MAX_FILE_SIZE, ALLOWED_TYPES)
  across files. Import from @/lib/constants.ts.

## Thoroughness
- Never take shortcuts or produce surface-level work. Exhaust available
  tools (search, read docs, inspect code) before proposing or building.
- When multiple approaches exist, research and evaluate them before
  selecting one. Do not default to the first pattern that comes to mind.

## Debugging
- When fixing bugs, trace to the root cause. Do not apply surface-level
  hotfixes that mask the real problem.
- After fixing, verify the fix does not introduce regressions in related
  code paths.

## Dependencies
- Before adding a new package, verify it is the current version and not
  deprecated. Prefer actively maintained packages with strong community
  support and regular release cadence.

## Security
- Apply DevSecOps principles. Consider the OWASP Top 10 when designing
  or implementing features.
- This project uses client-side encryption (AES-GCM via Web Crypto).
  Never bypass the @/api/ layer or store plaintext data in Supabase.

## Project conventions (from /docs/context.md)
- Read /docs/context.md "Key conventions" section before any work.
  The following are critical gotchas:
- proxy.ts (not middleware.ts) — Next.js 16 renamed the convention.
- getClaims() (not getUser() or getSession()) for auth session refresh.
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (not legacy ANON_KEY).
- Components import from @/api/ — never call Supabase SDK directly.
- Route paths from @/routes/paths.ts — no hardcoded route strings.
- Encrypted tables follow the id/user_id/iv/data/created_at blob
  convention. Use encryptField()/decryptField() for data operations.
- All pages must be responsive. Use Tailwind breakpoints (sm, md, lg).
- UI preferences (view modes, sort state) persist via useLocalStorage
  hook — no server-side storage needed.
- Shared hooks: useHashModal (hash-based modal state),
  useAuthBootstrap (session + data loading). Use these instead of
  re-implementing the same patterns in each View component.