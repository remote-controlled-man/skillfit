# Diagnosing bugs revision experiment records

This package preserves a real comparison of the previous Matt Pocock
`diagnosing-bugs` Skill and a local compact candidate. Thirty agent invocations
were attempted in `validation-20261012-rtk`; the final candidate invocation
timed out after 600 seconds. Fourteen pairs remain: previous 14/14, candidate
12/14, with two `onInsert` failures. The [dated report](../../2026-10-12-diagnosing-revision.md)
contains the interpretation and costs.

## Contents and integrity

- `replay/`: the frozen compiled harness, package metadata and license, full
  benchmark, both four-file Skills, declarations and live/offline entry points.
- `runner-changes.patch` and `runner-source-additions/`: source changes relative
  to `d09ac7aaf5dfb990b4251d8c3758ed3f9cb8f809`. The original build was dirty.
  Use the preserved compiled runner for the direct replay below; this subset
  is not a complete source checkout for `npm test`.
- `validation-records.tar.gz`: all 30 receipts/workspaces, including the
  ungraded timeout. `manifest.json` is its path-relative manifest copy.
- `calibration-records.tar.gz` and `interrupted-records.tar.gz`: separate earlier
  phases. The interrupted phase started only three real invocations; later
  error receipts represent guard refusals without model calls.
- Export indexes map original and portable hashes. Only local path prefixes
  in harness metadata/public transcripts were replaced. `.git` was excluded.
  Delivered source, tests, licenses and Skill resources retain their bytes.
  Native `_artifacts.json` and plan hashes refer to the original byte streams;
  use the export indexes for portable streams.
- `report.md`, `cost-analysis.json`, `analysis-summary.json`, regrade summaries,
  environment verification and the concrete callback counterexample.
  `timeout-partial-usage.json` contains only selected cumulative usage fields,
  not private session contents. Its counts are lower bounds, not final billing.

`artifact-index.json` hashes this package, excluding itself. `replay-index.json`
hashes the executable replay subtree. No credentials or private global
configuration bodies are included. Public CLI event streams do not include the
private reasoning rollouts.

## Offline score and cost replay

Use the recorded Node `v24.21.0` for the closest runtime match; the benchmark
requires Node >=22.13. No dependencies, agent login, model calls or network
are needed for these commands. From this artifact directory:

```bash
SKILLFIT_REVISION_RECORDS="$(mktemp -d)"
tar -xzf validation-records.tar.gz -C "$SKILLFIT_REVISION_RECORDS"
node replay/scripts/regrade-diagnosing-revision.mjs "$SKILLFIT_REVISION_RECORDS/validation-20261012-rtk"
node replay/scripts/analyze-diagnosing-revision.mjs "$SKILLFIT_REVISION_RECORDS/validation-20261012-rtk/manifest.json" --allow-stopped
node replay/dist/cli.js report eval manifest.json
```

Expect 29 matching graded receipts and one excluded timeout. Exactly lifecycle
candidate trials 3 and 4 fail, each at 8/9. The regrader itself exits 0 when those
saved failures reproduce; it does not require all submitted fixes to pass.
The cost analyzer requires `--allow-stopped` to review this retained stopped
session explicitly. It includes graded failures, drops the timeout pair in
both arms and leaves final timeout usage unknown.

Reproduce the failing delivery directly:

```bash
node replay/benches/contrib/oss-lru-cache/verifiers/fetch-lifecycle.mjs "$SKILLFIT_REVISION_RECORDS/validation-20261012-rtk/fetch-lifecycle/treatment/trial-3"
```

That command should exit 1 with the `onInsert` check false. Its previous-version
counterpart should exit 0. The check's complete expected/actual arguments are
saved in `onInsert-counterexample.json`.

Earlier phases are independently replayable after extracting their respective
archives. Calibration should match six graded receipts; the interrupted phase
should match two and skip 28 guarded/error receipts. They are not pooled with
validation.

To check package hashes using Node built-ins, still from this directory:

```bash
node --input-type=module - <<'JS'
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const rows = JSON.parse(readFileSync('artifact-index.json', 'utf8'));
for (const row of rows) {
  const actual = createHash('sha256').update(readFileSync(row.path)).digest('hex');
  if (actual !== row.sha256) throw new Error(`Hash mismatch: ${row.path}`);
}
console.log(`${rows.length} files verified`);
JS
```

## Fresh live procedure

This makes 30 new paid/limited agent invocations using your current Codex login
and configuration. To approximate the recorded setting, use the recorded CLI,
`gpt-6.1-sol`, `xhigh`, `default` tier and corresponding RTK/global instructions.
Private configurations are fingerprinted rather than published, and served
model/sampling are not attested. Different outputs and scores are possible.

```bash
SKILLFIT_REVISION_LIVE="$(mktemp -d)"
node replay/scripts/run-diagnosing-revision.mjs --phase plan --run-group validation-20261012-rtk --runs-root "$SKILLFIT_REVISION_LIVE"
node replay/scripts/run-diagnosing-revision.mjs --phase validation --run-group validation-20261012-rtk --runs-root "$SKILLFIT_REVISION_LIVE"
```

The plan also checks the separate calibration component without starting a
model. The validation command starts only the 30 old/new invocations. Inputs
must match the original declaration. The fresh RTK declaration inherits those
same fixed inputs and trial protocol while naming the new environment/cohort.
Do not pool fresh samples with these records or replace errors inside a study.
