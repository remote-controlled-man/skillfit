# Sealed evaluation inputs

This feature is included in 0.10.1; see its [release record](releases/0.10.1.md)
for publication status. Existing npm archives and historical evidence are unchanged.

New evaluation sessions copy and verify their inputs **before the first agent
or judge dispatch**. Editing, moving or deleting the original Skill or bench
afterward no longer prevents export or offline replay. This is a local evidence
archive; it makes zero model calls and does not rerun an evaluation.

## When sealing happens

Live `eval` validates its declaration and runs [offline case gates](eval-case-preflight.md)
first. Its native session then exclusively claims a fresh output directory,
copies inputs, verifies their fingerprints and writes the frozen plan last.
A failed copy, changed source or inconsistent bench stops before dispatch and
removes only that session's newly claimed output. Existing outputs and sibling
runs are preserved. No partial snapshot is advertised as a completed run.

Preview remains read-only. In request JSON,
`plan.evaluation.inputSnapshot` is `{schemaVersion: 1, required: true,
status: "pending"}`; no input archive exists yet. Its policy is part of the
approved plan, while actual copy time is recorded only after execution starts.

Sealing also applies to sessions used by trigger mode and baseline calibration.
Their existing paired-export restrictions are unchanged. A separate global
configuration installation is never performed by this feature.

## What is saved

| Native path | Contents |
| --- | --- |
| `_inputs/bench/` | Full pinned bench, including prompts, fixtures, verifiers, reference repairs and unselected tasks |
| `_inputs/target/` | Complete pinned target Skill or configuration experiment directory |
| `_inputs/baseline-skill/` | Previous complete Skill revision, when present |
| `_inputs/implementation/` | Compiled implementation used by the run |
| `_inputs/request.json` | Exact component request bytes, when present |
| `_inputs.json` | Version 1 snapshot inventory, fingerprints and directory/executable-file metadata |

The manifest identifies selected tasks as before; archiving the full bench keeps
its original content hash and all referenced files available. Empty directories
are retained. Executable permission bits are preserved on systems that support
them and checked on POSIX. Git metadata and the current run output are excluded;
symbolic links and unsupported file types are rejected. The archived bench must
load with the declared content hash before calls start. Keep Git metadata and
run outputs out of the task's input tree rather than relying on unrecorded files.

Only the listed project inputs are copied. Global configuration and globally
installed Skills keep their existing fingerprints/guards; their private contents
are not archived. External tools, installed dependencies outside these inputs,
credentials, operating-system state and server-side model identities are not
captured. Replay still needs Node.js 22+ and the verifier's external toolchains.

## Integrity and runtime behavior

`_plan.json.inputSnapshot` binds `_inputs.json` by SHA-256. Every indexed copy is
checked against the pre-copy fingerprint and exact file/directory inventory.
The final `_artifacts.json` also covers snapshot files. The normal session checks
both original input drift and archive integrity between calls. Editing the
originals during a live evaluation still stops further dispatches; this feature
does not make a changing cohort valid. The saved snapshots retain the initially
declared inputs for inspecting or exporting that stopped run.

A missing, changed, linked or incomplete declared snapshot fails closed. Neither
matching current originals nor `--input-root` overrides bypass a damaged archive.
An updated outer artifact index cannot hide a change that disagrees with the
plan-bound snapshot inventory. Hashes establish byte consistency, not independent
publisher authentication; retain a trusted copy of evidence hashes for provenance.

JSON assessment returns `inputSnapshot` with its descriptor and cost. Historical
runs return `null`, not a fabricated archive. Stopped/incomplete reports retain
their existing `evidence.verified: false` semantics; a snapshot alone never makes
them completed, improves their cost coverage or authorizes adoption.

## Export and replay after the originals change

```bash
skillfit report eval ./runs/my-run --json --replay
skillfit report eval ./runs/my-run --export ./exports/my-run --json
skillfit report eval ./runs/my-run --export ./exports/my-run --yes --json
node ./exports/my-run/reproduce.mjs
```

Native replay defaults to the sealed bench. Portable export defaults to sealed
inputs and the sealed implementation/request, so it works after original files
change or disappear. The native run directory itself can also be moved before
export. Explicit recovery roots still require exactly matching fingerprints;
the snapshot is validated first. Existing/nested export destinations remain
forbidden, and previews still write nothing.

Runs without `inputSnapshot` use the original matching-root recovery contract
described in [replay packages](replay-packages.md). New software does not rewrite
old plans, synthesize missing historical inputs or repair damaged evidence by
substituting newer files. Historical published evidence remains append-only.

## Local overhead and privacy

`inputSnapshot.cost` records `modelCalls: 0`, observed `durationMs`, `files` and
`bytes`. Counts include the input payload and `_inputs.json`; bytes are apparent
file sizes, not filesystem allocation. Elapsed time covers snapshot copying and
verification, not later per-call guards or an external toolchain bill. Sealing
and integrity checks add local I/O and storage without changing primary-agent
token totals, call budgets, duration populations or statistical/adoption rules.
Per-call archive checks run within the existing trial timer where applicable;
`inputSnapshot.cost.durationMs` is only the one-time sealing interval.

Portable export preserves the unchanged native archive and also supplies the
portable input/runtime layout; it therefore contains additional copies. Its
existing byte/file preview includes those source copies. No automatic pruning
or redaction removes evidence. Snapshots can include repository data, reference
answers and private target resources: review the run/package before sharing.

## Offline regression checks

```bash
npm test
node --test dist/commands/eval-export.test.js dist/harness/experiment-session.test.js dist/harness/eval-component.test.js
```

Tests use mock executors and local files. They cover archive presence before
dispatch, zero-call failure cleanup, source/archive drift, complete Skill/request
retention, changed/deleted originals, moved runs, stopped costs, portable replay,
legacy recovery, empty fixtures, executable files and corrupted/linked snapshots.
No real model API or agent CLI is called.
