---
name: vibe-coding
description: Route coding changes through the smallest useful engineering workflow and verify outcomes. Use for features, bug fixes, behavior changes, and nontrivial refactors; skip for research or documentation-only requests.
---

# Vibe Coding

Turn fast, conversational coding into a disciplined feedback loop. Compose existing skills; do not duplicate their instructions.

## Route the work

1. Read repository guidance, the smallest relevant code surface, and existing test commands.
2. Pick only the applicable lanes:
   - Unknown bug cause, intermittent failure, or competing hypotheses: use `diagnosing-bugs` when installed; otherwise reproduce, rank hypotheses, change one variable, and preserve the regression test. Skip the long diagnostic Skill for an obvious local correction.
   - Feature, bug fix, or behavior change: follow the red-green-refactor loop below directly. Load `tdd` only when test seams, mocking, integration boundaries, or explicit coaching need its longer reference.
   - Module or interface design: use `codebase-design` and `api-and-interface-design` when installed; otherwise document the boundary, invariant, compatibility, and test seam before editing.
   - User-facing UI: use `frontend-design` when installed; otherwise follow repository design conventions and verify the real browser path.
   - Framework or library facts: consult current official primary documentation and verify the installed version before relying on an API or behavior.
   - Auth, untrusted input, secrets, storage, or external integrations: use `security-and-hardening` when installed; otherwise perform explicit threat and abuse-case review.
   - Performance work: use `performance-optimization` when installed and always measure before changing code.
3. Do not activate two overlapping skills from the same lane. Prefer the repository's declared default when aliases exist.

## Work in evidence-producing slices

For each behavior slice:

1. State the behavior and the highest practical public seam.
2. Make the smallest relevant test fail for the right reason.
3. Implement only enough to pass it.
4. Refactor while the test stays green.
5. Run the narrow check again before starting another slice.

Skip test-first only when the change has no executable behavior or a reliable test would cost more than the change. State the reason and use the closest deterministic verification.

## Finish with proof

Before reporting completion:

1. Run focused tests, then the repository's typecheck/lint/build checks that cover the change.
2. Run the broader relevant test suite once when practical.
3. Inspect the final diff for scope creep, debug artifacts, secrets, unsafe defaults, and missing error paths.
4. For substantial, high-risk, or release-bound changes, run a fresh independent review against the original requirement, final diff, and executed evidence when the environment supports it. Resolve actionable findings before claiming completion. For small or low-risk changes, perform an explicit final self-review instead.
5. Report the commands run and their outcomes, the final review method and result, and anything not run.

Do not claim success from code inspection alone when an executable check exists. A planned human check is not executed evidence. If an independent review would materially improve confidence but cannot run, disclose that limitation instead of implying it happened. Do not commit, push, deploy, or mutate external systems unless the user asked for it.
