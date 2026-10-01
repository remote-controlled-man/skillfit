# Real OSS workspace evaluation smoke (2026-10-01)

**Result: the new disk-file paired CLI workflow completed. This is not a Skill
efficacy or installation recommendation.** One predeclared mcp-use task and one
adjacent pair passed in both arms, 8/8 checks each. No executor/verifier errors.

## Fixed inputs and environment

The [plan](plans/2026-10-01-oss-workspace-smoke.json), runner, bench and target were
committed as `b460ed4` before any model call. The task, target and compiled runner
were not edited or rebuilt during execution. The [implementation plan](../docs/plans/2026-10-01-oss-task-evaluation.md)
was sent to the integration session for review before implementation.

| Setting | Recorded value |
|---|---|
| Run group | `eval-20261001-141513` |
| Execution revision | `b460ed4` |
| Presentation | `workspace`; no inline repository snapshot |
| Bench | `benches/contrib/oss-mcp-use-utf8` |
| Bench SHA-256 | `f073235c583885f909ab40aa041017b11a6df20577e8bb17525001695bedc57d` |
| Skill source | Matt Pocock `diagnosing-bugs`, upstream `d81f3a183412e71a5b1e84ca21bc1a35eea03a60` |
| Injectable target SHA-256 | `f19320ddde7601ce58a82fd4cbe3e2f07038e75e7e590fcf65360d668b66d80d` |
| CLI | Codex `0.159.2` |
| Configured model / reasoning | `gpt-6.1-sol` / `xhigh`, inherited user configuration |
| Served model | Not independently verified; executor reports `cli-configured` |
| Sandbox / timeout | Matrix-defined `workspace-write`; 600 seconds per call |
| Local Node runtime | `24.21.0`; bench requires built-in stripping in Node 22.6+ |
| Sampling control | None exposed; `sampling: null` |
| Size / judge | 1 task × 1 trial × 2 conditions = 2 calls; judge disabled |

This used the product CLI, with a temporary executable alias for the app-bundled
Codex CLI. The alias changed neither global Skill installation nor configuration.
No global `diagnosing-bugs` installation was found. Both arms inherited user
rules/plugins/configuration; complete environment isolation is not claimed.
The CLI/configured model differ from earlier pilots, so results are not pooled.

## Observations

| Condition | Full task | Checks | Executor duration | Tokens |
|---|---|---|---|---|
| Baseline | 1/1 pass | 8/8 | 122.951s | unavailable |
| Skill force-injected | 1/1 pass | 8/8 | 198.008s | unavailable |

Both agents changed the actual TypeScript implementation and retained executable
regression tests. The verifier reran the tests on the original source to confirm
RED→GREEN capability. Both delivered workspaces are saved, not just final text.
The eight checks align with the request in the [bench contract](../benches/contrib/oss-mcp-use-utf8/README.md).

Δpass = 0; Δscore = 0; discordant pairs = 0 improved / 0 regressed;
McNemar exact p = 1; statistical verdict = `inconclusive`. The observed paired
bootstrap intervals are [0,0]. This collapsed interval only resamples the observed
task; it does **not** establish zero uncertainty or arbitrarily fine resolution.
One pair cannot establish a time effect, and elapsed time does not establish
token cost. Natural activation and false-trigger rate were not measured.

The task's earlier saturation was known before execution. This pair was declared
as a workflow/regression check, not selected as a difficult efficacy case. No
extra model runs were added after seeing the results.

## Inspect and replay

- [Full manifest, with local paths made relative](artifacts/2026-10-01-oss-workspace-smoke/manifest.json).
- [Baseline receipt](artifacts/2026-10-01-oss-workspace-smoke/baseline/result.json) and
  [treatment receipt](artifacts/2026-10-01-oss-workspace-smoke/treatment/result.json).
- Both arms' prompts, outputs, verifier logs and complete delivered workspaces
  live beside those receipts; [artifact notes](artifacts/2026-10-01-oss-workspace-smoke/README.md)
  explain normalization and offline regrading.
- [Rendered report](artifacts/2026-10-01-oss-workspace-smoke/report.md) includes
  per-check observations and installation evidence gaps.

```bash
node dist/cli.js bench check benches/contrib/oss-mcp-use-utf8
node dist/cli.js report eval evidence/artifacts/2026-10-01-oss-workspace-smoke/manifest.json
node dist/cli.js eval evidence/inputs/diagnosing-bugs --bench benches/contrib/oss-mcp-use-utf8 --input workspace --agent codex --trials 1 --dry-run
```

Offline checks and rendering do not call an agent. Remove `--dry-run` from the
last command to make a new two-call experiment with your current CLI configuration;
it will not reproduce the exact model sample. The raw local run remains unchanged
under `runs/eval-20261001-141513` in the execution worktree. Portable copies remove
only the checkout-path prefix. Original/portable hashes are listed in
`artifact-index.json`; numeric outcomes and original verdicts were not changed.

## Review and validation follow-up

Independent review identified and reproduced three report/planning defects after
the fixed smoke execution: workspace dry-run without a CLI did not fail early;
usage coverage/totals were not reconciled across tasks; and a score interval could
appear without supporting score observations. These were corrected with offline
regressions. Display was also tightened to call the CI half-width an observed
summary and use completed graded pairs for scale labels. Statistical calculations
and the original run remained unchanged. The original console preserves the old
misleading resolution sentence; the regenerated report uses the corrected wording.

Validation on the implementation worktree: `npm test` **349 passed, 0 failed**;
bundled code-review **27/0/0**, debugging **36/0/0**; real mcp-use gate **5/1/0**
(pass/warn/fail). Its one warning is the lack of negative-trigger tasks. Remote
three-system CI has not run for this branch: the attempted push was rejected by
automatic approval review pending explicit destination authorization. Integration
and final independent validation are owned by the review session.

## Decision

The workflow can now present this real case as files, execute both arms, grade
observable fixes and preserve a reviewable report. This run provides no basis
for recommending installation of the Skill. A personal efficacy decision still
needs representative independent tasks, fixed repeated trials, activation tests
with negatives and sufficiently complete usage records. Preparing dependencies
and reviewing the issue-to-check contract remain human responsibilities; arbitrary
GitHub issues are not automatically converted into trusted benchmarks.
