---
description: Run the plan → implement → review pipeline for a new task, with user approval gates
---

When the user types `/startcycle <task description>`, orchestrate the
following sequence strictly using agents.md and .agents/skills/.

### Execution Sequence

1. **Architect phase**
   - Invoke the write-plan skill with `<task description>`.
   - Before planning, read `.agents/rules/global.md` for standing
     constraints and project conventions.
   - Architect reads /docs and the relevant codebase, produces an
     Implementation Plan artifact.
   - STOP. Wait for the user to explicitly approve or comment on the
     plan. If the user comments, revise the plan and re-present it.
     Do not proceed to implementation without explicit approval.

2. **Engineer phase**
   - The user must already be on the correct branch before this phase.
   - Invoke the implement-task skill against the approved plan.
   - Engineer implements only the files/interfaces listed in the plan.
   - If ambiguity is hit, stop and report it to the user instead of
     guessing.
   - On completion, produce a Task List and Walkthrough of what was
     done.

3. **Reviewer phase**
   - Invoke the review-diff skill against the branch diff, the approved
     plan, and .agents/rules/review-checklist.md.
   - Produce a structured issue list (or explicit "no issues found").
   - STOP. Present the diff + review to the user.

4. **User decision**
   - If the user requests code changes: return to step 2 on the same
     branch with the new instructions.
   - If the user wants to rework the plan itself (not just code fixes):
     return to step 1 with the updated instructions.
   - If the user approves: leave the branch ready for the user to
     commit/merge manually. Do not auto-merge.