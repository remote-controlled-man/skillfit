# Skill revision experiment handoff

The Skill revision campaign is complete. The current implementation compares
complete old/new Skills, retains all-invocation costs and guards timing and frozen
inputs. The original diagnosing-bugs Skill remains the profile default. Compact
v2 is an experimental candidate: the completed independent repository comparison
does not establish a quality gain, equivalence or a monetary saving.

## Review groups

| Group | Active files | Purpose |
|---|---|---|
| Historical repository bench | `benches/contrib/oss-normalize-url/`, `src/harness/oss-normalize-url.test.ts` | Pinned upstream failure, reference repair, independent outcome checks and offline grader regression tests |
| Experiment evidence | `evidence/`, dated `scripts/*.mjs`, `scripts/README.md` | Original and candidate inputs, declarations, deliveries, failures, accounting and frozen replay packages |
| Evaluator changes | `src/cli.ts`, `src/commands/eval*.ts`, `src/harness/`, corresponding tests and evaluation docs | Installed Skill revision comparison, cost coverage, monotonic timing, deadline enforcement and canonical workspace guards |

The [script navigation](../../scripts/README.md) identifies live and offline entry
points. The [revision guide](../skill-revisions.md), [cost contract](../eval-costs.md)
and [timing contract](../eval-timing.md) describe current behavior. Statistical
verdict semantics remain unchanged; there is no automatic adoption gate.

## Evidence and current conclusions

| Study | Observed result | Interpretation |
|---|---|---|
| [Original versus compact v1](../../evidence/2026-10-12-diagnosing-revision.md) | Original 14/14 paired passes, v1 12/14; two onInsert regressions and a separate ungraded timeout | Shorter instructions reduced total input but did not preserve all observed behavior |
| [Compact v2 controls and first independent cohort](../../evidence/2026-10-12-diagnosing-v2.md) | Fresh known-regression controls passed; the independent cohort stopped after one completed pair | Preserve the controls and the failed procedure separately; do not pool partial cohorts |
| [Completed normalize-url comparison](../../evidence/2026-10-13-normalize-url-v2-validation.md) | Two fresh pairs; all four deliveries 8/8; total input -28.9%, uncached input +29.3%, output -11.6%, elapsed -3.6% | Quality is inconclusive; cost observations are descriptive and do not establish a dollar saving or stable speedup |

All earlier timing anomalies, trust-path guard stops, connection errors and the
readiness preparation error remain in their original packages. The latest report
and package include accounting for all eight recovery invocations, including
missing usage. New model calls must use a new bounded declaration; never append
to or replace observations in these cohorts.

## Cleanup and verification

- Backed up 1,583 working files before cleanup, with per-file hashes, the original
  diff and status under ignored `runs/maintenance/2026-10-13-cleanup/`.
- Retained every dated report, input, declaration, experiment script, raw local
  run and frozen package at its existing path. Checked all 1,438 indexed files
  across six packages against their SHA-256 hashes, without changing their bytes.
- Added narrow ignore exceptions for required frozen replay files. Previously
  ignored evidence comprises 467 compiled files and four indexed `.DS_Store`
  files. The four indexed metadata files remain part of their historical packages;
  four unindexed system cache files were backed up and removed.
- Disabled Git text normalization inside `evidence/artifacts/` so frozen hashes
  continue to describe exact file bytes. Active `dist/`, `runs/` and the private
  lab remain ignored.
- Full offline project tests passed **460/460**. The restricted sandbox attempt
  passed 459 and could not start the existing loopback HTTP test; the full rerun
  with local loopback listening permitted passed all 460.
- All four contributed benches passed their offline gates with zero failures.
  Existing calibration and negative-control warnings remain visible.
- Fresh archive extraction reproduced all four final deliveries, with zero
  exclusions, exact saved analysis and exact eight-invocation recovery accounting.
- A clean Git index export without ignored build files or dependencies retained
  all 1,438 indexed bytes and independently reproduced the four final delivery
  grades and recovery accounting using its own frozen compiled replay.
- Active-change whitespace checks passed. Immutable evidence snapshots and the
  pinned normalize-url bench retain their original formatting and hashes.

The cleanup uses no real model or agent execution and does not publish, release
or change the installed Skill. Local review checkpoints are on
`codex/chore-organize-skill-experiments`.

## Next work awaits user direction

The discussed product direction is a reusable evaluation and acceptance component
for external Skill evolution workflows. Stable caller-facing results, separate
adoption policies and independent validation evidence are candidate next steps.
This cleanup does not implement them or assert that self-evolution has a proven
net benefit. Resume product work only after the next instruction.
