# Experiment script navigation

The dated Skill revision scripts retain the procedures that produced the published
evidence. Their existing paths are pinned by declarations and frozen replay packages;
keep them stable. General repository utilities are `check-contrib-benches.mjs` and
`setup-codex.sh`. The [experiment handoff](../docs/plans/2026-10-13-skill-experiment-cleanup.md)
maps the corresponding product changes and the current conclusions.

`node scripts/check-docs.mjs` checks local links and heading anchors in maintained
entry points and guides. Its offline regression checks run as part of `npm test`;
fixed historical evidence and private lab directories are outside its scan.

After building, `node scripts/check-architecture.mjs` checks emitted runtime imports
for cycles and core-to-command dependencies. It uses the existing development
TypeScript compiler to distinguish imports from comments, strings and types; its
regressions are also part of `npm test`.

`node scripts/check-package.mjs <pack.json>` validates an npm-pack inventory
against `package-policy.json`, including runtime modules, offline inputs, retained
recipe tests, archives and size limits. `npm test` checks a real offline package;
release preparation reuses the same policy. See [package contents](../docs/package-contents.md).

## Release automation

`ci-scope.mjs` classifies only release bookkeeping for targeted checks, falls back
to full CI for unknown inputs, and records actual scope/test counts. Required job
names stay stable. `release-source.mjs` verifies exact-source full main CI,
promotes one explicit reviewed preview attempt and guards publication intent.

`release-acceptance.mjs` runs installed-package checks once, checkpoints failure
state and renders a compact summary. `release-checks.mjs` supplies registry,
Skill/examples, general installed feature, online/offline archive, frozen history,
source proof and signature checks. These repository tools use Node built-ins;
normal tests inject data/adapters and remain offline. The two general smoke
recipes ship with npm; older versioned recipes remain immutable.

`release-records.mjs <records-bundle> <repo> [--plan <path>]` previews validated
receipt/status import; `--yes` applies it with collision protection. It does not
commit or publish. See [trusted publishing](../docs/releases/trusted-publishing.md)
for source gates, bounded read-only recovery, artifact retention and one-command
watching. A failed run needs its logs; successful runs normally need only the
structured summary and generated record bundle.

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
