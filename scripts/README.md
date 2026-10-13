# Experiment script navigation

The dated Skill revision scripts retain the procedures that produced the published
evidence. Their existing paths are pinned by declarations and frozen replay packages;
keep them stable. General repository utilities are `check-contrib-benches.mjs` and
`setup-codex.sh`. The [experiment handoff](../docs/plans/2026-10-13-skill-experiment-cleanup.md)
maps the corresponding product changes and the current conclusions.

## Saved experiment stages

| Script suffix | Evidence package | Purpose |
|---|---|---|
| `diagnosing-revision.mjs` | [Original and compact v1](../evidence/artifacts/2026-10-12-diagnosing-revision/README.md) | Calibration, interrupted cohort and fixed revision comparison; retains two onInsert regressions |
| `diagnosing-v2.mjs` | [Compact v2](../evidence/artifacts/2026-10-12-diagnosing-v2/README.md) | Known regression controls and the first independent repository cohort, stopped by a timing anomaly |
| `normalize-url-v2-recovery.mjs` | [Timing repair](../evidence/artifacts/2026-10-12-normalize-url-v2-recovery/README.md) | Normal timing followed by a canonical trust-path guard stop; zero graded pairs |
| `normalize-url-v2-comparison.mjs` | [Connection timeout](../evidence/artifacts/2026-10-12-normalize-url-v2-comparison/README.md) | Correct deadline enforcement during upstream connection errors; zero graded pairs |
| `normalize-url-v2-available.mjs` | [Readiness preparation error](../evidence/artifacts/2026-10-12-normalize-url-v2-available/README.md) | Retains the local Git preflight rejection; no paired comparison |
| `normalize-url-v2-validated.mjs` | [Completed comparison](../evidence/artifacts/2026-10-12-normalize-url-v2-validated/README.md) | Successful readiness check and two complete old/new pairs |

Each suffix has a `run-` entry point for its declared live procedure, a `replay-`
entry point for saved delivery verification (`regrade-` for the original revision),
and an `analyze-` entry point for saved measurements. The additional
`replay-diagnosing-v2-oninsert.mjs` checks the preserved manual red/green control.
`analyze-normalize-url-recovery-spending.mjs` accounts for all eight recovery
invocations across the retained stages without pooling their quality results.

## Offline verification

These commands use saved files and do not call an agent or a model:

```bash
npm test
node scripts/check-contrib-benches.mjs
node scripts/analyze-normalize-url-recovery-spending.mjs evidence/artifacts
node dist/cli.js report eval evidence/artifacts/2026-10-12-normalize-url-v2-validated/manifest.json
```

For a historical delivery replay, use its package README. Each package includes its
own frozen `replay/scripts` and `replay/dist`; those files are historical inputs,
not extra active implementations to refactor. Replaying saved deliveries reproduces
their grades and accounting. A fresh model run reproduces the procedure, not
identical outputs, usage or latency.

## Live execution

`run-*.mjs` may start a real agent and incur usage. Read the matching declaration
under `evidence/plans/` and preview the plan first. Create a fresh bounded cohort;
never append to a retained cohort or replace its failed observations. The stopped
stages are failure evidence, not a list of experiments to rerun automatically.
