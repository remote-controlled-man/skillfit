# Diagnosing Bugs compact v2 reproducibility package

See [the report](../../2026-10-12-diagnosing-v2.md). The known lru-cache cohort
completed four invocations; the independent normalize-url cohort stopped after
three actual invocations. Six deliveries were graded. One timeout and one
pre-call refusal remain ungraded; no replacement sample was added.

## Contents

- `replay/`: frozen compiled harness, package/license, both evaluated Skills and
  development parent, both complete benches, declarations and entry points.
- `regression-records.tar.gz`, `transfer-records.tar.gz`: source/test deliveries,
  prepared Skill resources, prompts, receipts, public transcripts and call ledgers.
- `*-export-index.json`: original and exported file hashes with path normalization.
- `*-manifest.json`, `*-report.md`, `*-regrade.json`: native provenance, quality,
  descriptive costs and verified offline outcomes.
- `analysis.json`: per-cohort/per-pair observations, cost increases and coverage.
- `oninsert-control/`: manual development repair, original/corrected generated
  assertion, red/green public regression and portable source/test repair patch.
- `historical-v1-counterexamples/`: both unchanged saved v1 failures (8/9).
- `runner-changes.patch`, `runner-source-additions/`: source changes relative to
  the declared dirty HEAD. Use frozen compiled replay for the commands below;
  this subset is not a standalone full source checkout or complete CI package.
- `environment-verification.json`, `archive-regrade.json`, `replay-index.json`,
  `artifact-index.json`: endpoint input checks and package integrity.

Source, tests, licenses and installed Skill bytes stay exact. Only metadata,
prompts and public logs replace machine-specific paths with `<runs-root>`,
`<skillfit-checkout>`, `<user-home>` and `<system-tmp>`. Native original plan and
artifact hashes describe pre-normalization bytes; export indexes describe the
portable files. Git internals are excluded. No auth/configuration bodies,
hidden reasoning rollouts or private lab files are included.

## Offline replay (no model, API, agent CLI or dependency install)

Run from this package directory with Node v24.21.0 (the lru-cache adaptation
requires built-in TypeScript transformation, Node >=22.13):

```bash
SKILLFIT_V2_RECORDS=$(mktemp -d)
tar -xzf regression-records.tar.gz -C "$SKILLFIT_V2_RECORDS"
tar -xzf transfer-records.tar.gz -C "$SKILLFIT_V2_RECORDS"
node replay/scripts/replay-diagnosing-v2.mjs "$SKILLFIT_V2_RECORDS/regression-v2-20261012"
node replay/scripts/replay-diagnosing-v2.mjs "$SKILLFIT_V2_RECORDS/transfer-v2-20261012"
node replay/scripts/analyze-diagnosing-v2.mjs "$SKILLFIT_V2_RECORDS"
node replay/dist/cli.js report eval regression-manifest.json
node replay/dist/cli.js report eval transfer-manifest.json
node replay/scripts/replay-diagnosing-v2-oninsert.mjs oninsert-control
```

Expected regrade: regression matched 4/excluded 0; transfer matched 2/excluded 2,
with `costsMatch: true` and invocation counts 4 and 3. The development control
reports original 8/9, corrected 9/9 and red/green exits 1/0. Full observed costs
are in analysis.json; the timeout has unknown final usage and an anomalous
2178.775s wall duration with a nominal 600s timer. These archives reproduce
recorded grading and aggregation, not identical future model samples or billing.

## Fresh live procedure

The original candidate, bench and runtime were frozen before calls. To inspect
the exact plan from a compatible environment:

```bash
node replay/scripts/run-diagnosing-v2.mjs --phase plan --runs-root /private/tmp/skillfit-v2-fresh
```

Live phases cost four agent invocations each and require a fresh root plus the
recorded model/effort/tier, CLI and global instruction environment:

```bash
node replay/scripts/run-diagnosing-v2.mjs --phase regression --runs-root /private/tmp/skillfit-v2-fresh
node replay/scripts/run-diagnosing-v2.mjs --phase transfer --runs-root /private/tmp/skillfit-v2-fresh
```

The entry point checks input/compiled/entry-point hashes and the extra RTK
instruction fingerprint. Native sessions pin matrix configuration per call;
configured model consistency must be reviewed in their `_plan.json`, and served
model identity remains unrecorded. Do not reuse or append to the published
stopped group. A changed environment, task, timeout or candidate requires a new
bounded declaration; live reruns preserve the procedure, not identical outputs.
