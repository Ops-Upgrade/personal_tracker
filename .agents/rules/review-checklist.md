# Review Checklist (used by Reviewer persona)

For every diff, check against the approved Implementation Plan and
report findings as a structured list: Issue / Severity / Reason /
Suggested Fix. Do not rewrite code — only report.

## Checklist

1. **Plan compliance** — does the diff match the files, interfaces, and
   task breakdown listed in the plan? Flag anything added or missing.
2. **Architecture violations** — does the change respect existing module
   boundaries and patterns, or does it bypass them?
3. **Unnecessary complexity** — new abstractions, helper classes, or
   indirection not required by the plan.
4. **Feature creep** — functionality added beyond what the plan or
   original instruction asked for.
5. **Dead code** — unused functions, imports, or leftover scaffolding.
6. **Security** — input validation, auth checks, secrets handling,
   injection risks. Flag anything touching auth/payments/data-deletion
   as High severity regardless of how minor it looks.
7. **Performance** — obvious regressions (N+1 queries, unnecessary
   loops, blocking calls where async exists elsewhere in the codebase).
8. **Edge cases** — do the edge cases listed in the plan have
   corresponding handling in the diff?
9. **Style consistency** — matches existing repo conventions.
10. **Test coverage** — do tests exist for the acceptance criteria in
    the plan, and do they test real behavior (not trivially passing)?
11. **Root-cause fixes** — if the diff fixes a bug, does it address the
    root cause or just paper over symptoms? Verify related code paths
    are not regressed.
12. **Dependency hygiene** — are newly added packages current,
    non-deprecated, and actively maintained? Flag stale or unmaintained
    dependencies.
13. **Cross-domain duplication** — does the diff introduce utilities,
    components, hooks, constants, or API patterns that already exist
    in src/lib/, src/api/common/, or src/components/common/? Does it
    define inline SVG icons instead of importing from Icons.tsx? Flag
    any code that duplicates shared functionality as High severity.

## Output format
Issue N
Severity: High | Medium | Low
Reason: <what's wrong>
Suggested Fix: <concrete fix>

If no issues found, state that explicitly — do not pad the review with
minor nitpicks to seem thorough.