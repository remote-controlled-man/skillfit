# Read an evaluation report

Version 0.10.1 uses the same saved-evidence assessment for Markdown and JSON.
Both formats accept a manifest file, native run directory or portable replay
package directory. Neither starts an agent or changes the saved run.

Version 0.11.0 also displays the saved [Agent environment preflight](eval-agent-preflight.md).
JSON exposes `agentPreflight`; human reports omit its local evidence paths.
Missing historical metadata stays null. Reading/replaying a report does not
repeat environment/authentication probes or claim the current machine is ready.

Current-source additions (not yet published in npm 0.13.1): new native records
also expose `modelIdentities` v1 in JSON and a public-model
identity section in Markdown. Coverage is split by primary/judge/drafter roles;
evaluation records use primary/judge; drafter coverage belongs to the separate
[authoring record](bench-drafting.md#model-identity-in-authoring-records), not `report eval`.
Relative call-receipt paths retain configured/requested intent separately from
public response IDs and their exact source locations. Unknown models do not
become known from executor labels or CLI versions. Historical records without
these fields remain readable and explicitly unrecorded.

Identity declarations are checked against retained API bodies or matrix-declared
public CLI events, with hashes and the dispatch ledger audited by the native
reader. Invalid identity/coverage claims cannot authorize export or adoption.
Stopped runs retain valid reported IDs and unknown missing receipts. Portable
exports retain the same identities after relocation; both the current reader and
the exported `reproduce.mjs` use saved evidence, without calling a model or
reading current agent configuration. CLI/model declarations do not attest to the
provider's backend or enumerate every undisclosed internal model. See the
[identity contract](metrics.md#public-model-identity-per-invocation),
[identity schema](schemas/model-identity.schema.json) and
[coverage schema](schemas/model-identities.schema.json).

```bash
skillfit report eval ./runs/my-run
skillfit report eval ./runs/my-run --json
skillfit report eval ./runs/my-run/manifest.json
skillfit report eval ./exports/my-run --replay
```

For paired runs, `--json` changes the format, not which evidence is checked. `--replay`,
`--records <run-dir>` and `--policy <policy.json>` work with either format.
Replay grades disposable delivery copies using trusted local verifiers; it
does not call a model. An overridden policy is post-hoc and cannot authorize
adoption unless it matches the policy frozen before execution. Portable packages
already pin their run/bench and reject external records/bench overrides.

## Frozen measurement scope (current source)

Unpublished source records can include optional `measurementScope` v1 in paired,
trigger and calibration reports; [bench claims](bench-claims.md) owns its fields
and derivation. Schema 2 uses explicit task declarations; schema 1 records null
claims and legacy-unrecorded support for a non-null target. Missing historical
metadata stays absent
and never acquires today's declarations. Assessment is design support, not proof
of validity, power or adoption. Null diagnostic targets are not efficacy claims.

New audits compare summary scope with the native/reviewed plan and selected
order in the original sealed bench. Malformed/unsupported versions, missing
new scope on only one side, or contradictory declarations cannot verify evidence.
A paired report policy override leaves the original target unchanged and cannot
grant an undeclared schema 2 claim. Quality numbers remain observations within
that scope. [Portable replay](replay-packages.md) retains the same frozen inputs.

Paired JSON adds per-task `diagnostics`; calibration JSON has
`summary.tasks[].diagnostics`. Baseline ceiling/floor, quality headroom, efficiency
eligibility and activation coverage remain separate. A saturated task is not
discarded from efficiency; actual paired costs/variance, final coverage and
regressions still govern qualification. Calibration alone cannot establish
savings or quality equivalence. Trigger reports keep observed label/detection
coverage, including unknowns. See [diagnostics](bench-claims.md#reading-difficulty-diagnostics).

For [self-test](bench-self-test.md), read a native suite directory, not the wrapper
parent. Its scope is diagnostic-only and its executor remains synthetic; matching
controls never permits adoption, even after export or replay.

## Completed, stopped and incomplete inputs

- A completed manifest retains the existing quality/facet/cost tables. Markdown
  also shows the native audit status, separate acceptance decision, upgrade
  eligibility and reasons. A statistical quality verdict is not an adoption
  decision. `automaticUpgrade` remains false.
- A paired native directory without a final manifest shows retained stopped/
  incomplete spending; the single-arm dispatch below handles calibration and
  trigger sessions separately. It displays the stop reason when
  available, retained costs, missing/invalid receipt counts and unknown coverage.
  It does not fabricate a paired quality verdict or overwrite the run.
- A standalone historical manifest stays readable. Missing native evidence
  remains `unverified`; rendering it cannot authenticate the source or qualify
  it for adoption. Available current preflight and input-snapshot metadata are
  displayed separately; their presence alone does not validate a stopped run.
- Corrupt native evidence is reported as unverified with audit/acceptance
  reasons. A changed portable package fails its inventory/hash verification
  before rendering. An empty directory, missing path or malformed/unsupported
  manifest is an input error.

Successful rendering keeps exit 0 even if acceptance is `reject` or
`inconclusive`; callers must inspect `acceptance` and `evidence` rather than
interpret the exit code as approval to upgrade. Invalid inputs fail nonzero.
JSON keeps its version 1 contract. Human reports abbreviate the local run root
as `[run]` in diagnostic text; JSON retains precise paths for investigation.

Saved costs stay in their original final/partial/unknown populations. Reports do
not replace missing cache counts with zero or estimate unrecorded billing.
See [cost accounting](eval-costs.md), [input snapshots](evaluation-input-snapshots.md)
and [portable packages](replay-packages.md). Review project data before sharing.

## Numerical integrity errors

The 2026-10-21 [McNemar numerical correction](metrics.md#numerical-integrity-correction-2026-10-21)
keeps the test formula and thresholds. A saved paired manifest with at least
1075 discordant pairs, recorded p=0 and the verdict the old zero-mass calculation
would produce fails with `RECORDED_STATISTICS_NUMERIC_ERROR` if stable
recomputation gives a nonzero p-value or a different verdict. A genuinely tiny
tail that still rounds to zero is accepted when the other integrity checks pass.
Other inconsistent statistics retain their ordinary validation errors.

Markdown reports fail with that diagnostic; JSON fails with exit 2 using the
existing `schemaVersion: 1`, `kind: "skillfit.eval-error"`, `status: "error"`
envelope. `error.details.discordant` contains `improved` and `regressed`;
`error.details.recorded` and `error.details.computed` each contain `mcnemarP`
and `verdict`. Acceptance stays `inconclusive`, `eligibleForUpgrade: false`,
`automaticUpgrade: false`. The error does not return a quality or cost report.

No saved file is rewritten. This pattern does not authenticate who produced a
record. Preserve the original and its frozen runtime; save a corrected dated
report separately and link the original. Portable packages retain their pinned
runtime for reproducing the original interpretation; reading a manifest with
the current CLI applies the current integrity checks.

## Calibration and trigger reports (source after npm 0.10.1)

Version 0.11.0 recognizes baseline calibration and trigger runs; the immutable
npm 0.10.1 archive is unchanged.
Markdown and JSON use the same read-only dispatcher:

```bash
node dist/cli.js report eval ./runs/calibrate-my-bench
node dist/cli.js report eval ./runs/calibrate-my-bench/_calibration.json --json
node dist/cli.js report eval ./runs/trigger-my-skill
node dist/cli.js report eval ./runs/trigger-my-skill/manifest.json --json
```

| Saved result | JSON kind (schemaVersion 1) | Output |
| --- | --- | --- |
| Paired v4 manifest | `skillfit.eval-result` (unchanged) | Paired quality/cost observations, native audit and separate acceptance policy |
| Calibration `_calibration.json` | `skillfit.calibration-report` | `evaluationType: "calibration"`, baseline pass rate, task difficulty bands and available baseline receipt usage |
| Trigger v1 manifest (`mode: "trigger"`) | `skillfit.trigger-report` | `evaluationType: "trigger"`, recall, false-trigger rate, precision, F1, class breakdowns and detection coverage |

Calibration directories resolve `_calibration.json`, rather than requiring a
paired `manifest.json`. Both directories and explicit summary files work;
renamed standalone calibration summaries are recognized by their v1 shape.
Ambiguous directories containing both final summary types fail. An unrelated
schema-v1 file is never accepted as a paired experiment.

`status` follows consistent saved experiment/session metadata: `completed`,
`stopped` or `incomplete`. A summary without recorded session metadata is
`reported`, with unverified provenance. Missing final summaries are `stopped`
only when a saved session says stopped; otherwise they are `incomplete`, even
if a sidecar claims completion. Their `summary` is null: no final metrics are
invented. Present summaries must have valid counts and trial coverage; conflicts
with the saved session or native plan fail rather than being silently reclassified.

Calibration `summary.tasks` includes `passes`, `completed`, ungraded `errors`,
`passRate` and `difficulty`. Completed runs exclude execution errors. Bands match
the existing calibration protocol: pass rate >=90% is `saturated`, <=10% is
`floor`, otherwise `discriminative`; zero completed runs are `unmeasured` with
null pass rate. `summary.metrics` retains totals and measured/discriminative task
counts. Native `usage` shows available baseline receipt totals with
final/partial/unknown coverage, including unknown missing receipts; it is null
when no native invocation ledger is available. No per-success A/B change or bill
is inferred. Difficulty is not a measure of Skill benefit.

Trigger metrics are recomputed from retained task counts using the existing
formulas; provided aggregate fields must agree. Unknown detections and execution
errors stay separate and outside rate denominators. Zero denominators remain
null (`n/a`); recall, false-trigger rate and precision use Wilson 95% intervals.
F1 has no invented interval. Available `triggerClass` breakdowns, competition
mode, source warnings and the distinction between a `SKILL.md` read and a Skill
invocation stay visible. Historical input/output token aggregates are not a
complete cost population; absent cache/final-usage evidence remains unknown.

Standalone historical single-arm summaries return `evidence.verified: false`
with scope `saved-summary-only`. Version 0.11.0 can audit sealed native single-arm
receipts with scope `single-arm-native`; `evidence.verified` reports the actual
inventory/ledger/input/receipt check result. Both return `acceptance.decision: "inconclusive"`,
`eligibleForUpgrade: false`, `automaticUpgrade: false`. Parsing a consistent
summary is not a paired native audit, independent validation or adoption decision.
Verifying single-arm evidence does not establish an A/B effect. They do not enter the paired efficacy protocol. The existing request-based
revision component and paired report JSON contract remain unchanged.

`--policy` and external `--records` remain paired-report options. Sealed native
single-arm reports now accept `--replay` and an optional matching `--bench` only
with replay. Regrading uses disposable saved deliveries. Trigger metrics are
recomputed from retained observations; saved detection booleans are reused, not
redetected by a new parser. Changed
deliveries, fingerprints and verdicts fail verification. Calibration/trigger
exports retain the original compiled implementation and reject older runtimes
without single-arm replay support; see [portable packages](replay-packages.md).
Successful rendering exits 0; invalid human inputs exit 1, while invalid JSON
reports use the existing error envelope and exit 2. Saved input files are never
rewritten, and reading any of these reports makes zero model or agent CLI calls.

### Trigger observation protocol v2

New production trigger runs freeze a [version 2 detection declaration](schemas/trigger-detection.schema.json)
in their reviewed/native plan, executor, trial receipts and manifest. It contains
wireShape, method, identityMatch, complete allowed identities and registered Skill
paths. `summary.triggerDetection` exposes the declaration. The native audit checks
agreement across these records; inconsistent or unsupported protocols cannot
be verified or exported. Missing historical declarations stay null and display
`legacy/unversioned detection`; saved counts are not migrated or redetected.

Each versioned trial also retains `triggerEvidence`: status, complete,
matchedIdentity or null and one-based eventLines into `_transcript.jsonl` for
positive observations. No positive observation means an empty eventLines list.
`not-observed` requires a normal complete stream; unknown formats, malformed
identity arguments, truncation and ambiguous commands stay unknown. Explicit
positives can survive an incomplete stream, but executor errors still exclude
those trials from rates. Native auditing checks evidence/boolean consistency and
that referenced lines exist in the sealed transcript; it reuses the saved
observations rather than running the current detection parser on historical data.

Claude Code is reachable through its matrix `-p --output-format stream-json --verbose`
template. Node-only fake subprocesses exercise that adapter and the CLI dry-run;
no real model, CLI compatibility or authentication was tested. The adapter does
not currently read Claude token/cache counters. See [the detection contract](metrics.md#l1--trigger-quality-activation).

## Judge spending and stop reasons (source after npm 0.10.1)

Paired Markdown and JSON additionally show `invocationCosts`: separate primary,
judge and combined populations. The original Agent A/B quality and cost tables
remain unchanged. Successful, failed and interrupted judge orders have independent
receipts and final/partial/unknown usage. Missing historical judge usage stays
unknown. See [all executor roles](eval-costs.md#all-executor-roles-0110-and-newer).

Budget stops retain `session.stopCode` and safe reason text. Single-arm reports
show the same frozen `spendingBudget` limits/latest state as paired reports.
The native audit and any upgrade eligibility are separate decisions; all
single-arm, stopped and insufficient-evidence results remain ineligible.
The [single-arm schema](schemas/single-arm-report.schema.json) and
[calibration command schema](schemas/calibration-result.schema.json) describe
their machine envelopes.

## Sharing a result

For a complete portable directory of a paired native run without a judge, use
`report eval <run-dir> --export <new-dir> --json` to preview, then add `--yes`.
The [portable package guide](replay-packages.md) covers checksums, matching source
recovery, offline replay, stopped costs and review of private project contents.
The Markdown report below is a shorter summary, without the full replay inputs.
Version 0.11.0 also reads calibration and trigger summaries with separate
states/metrics and JSON kinds; see [report types](evaluation-reports.md#calibration-and-trigger-reports-source-after-npm-0101).
They are descriptive single-arm reports and do not enable paired portable exports.

Try a clearly synthetic schema-v4 example first:

```bash
node dist/cli.js report eval docs/examples/eval-manifest.synthetic.json
```

After a paired `skillfit eval` run, replace the example path with its native run
directory or the printed `Manifest:` path. Since 0.10.1, Markdown and JSON accept
the same manifest/run/package inputs and show audit and acceptance reasons.
Stopped/incomplete runs show retained costs without inventing a completed quality
comparison. See [report inputs and states](evaluation-reports.md). This command is read-only: it does not call an agent,
rerun a verifier, change the manifest, or alter the verdict. Paste its output into a pull request or
issue. The JSON manifest remains the canonical record; attach it when you want someone else to audit
the task-level outcomes and provenance. The Markdown includes target and bench hashes, the executor,
trial counts, error counts, McNemar p-value, paired-bootstrap interval, and all warnings. It omits local
source directories so the short report is easier to share; review the raw manifest and report before
posting either, since names, warnings, and run data can still describe private work.

An example of the output shape from a **synthetic mock run**:

```markdown
# skillfit evaluation: example-skill

> **Synthetic harness run.** These numbers do not measure an agent or Skill effect.

| Task | Baseline | Treatment | Errors B/T | Δpass | Verdict |
|---|---:|---:|---:|---:|---|
| sample-task | 0/2 (0%) | 2/2 (100%) | 0/0 | +100.0pp | inconclusive |

## Statistical readout

- Overall verdict: **inconclusive** — only 2 discordant pairs
- Discordant pairs: 2 improved, 0 regressed; McNemar exact p=0.5000
```

The impressive-looking delta in this synthetic example is **not evidence of benefit**: two discordant
pairs are too few for significance, and the executor is a mock. For a dated real paired-outcome result
with its limitations stated, see the [Kimi debugging experiment](../evidence/2026-09-debugging-bench-exploratory.md).
Its historical manifest is local to that run; `report eval` renders schema-v4 manifests produced by
current paired experiments.

The renderer rejects older manifest schemas and missing or inconsistent fields used by the report
rather than guessing what a field used to mean. It does not compare runs from different model
versions or bench hashes. Use the [metrics protocol](metrics.md) when interpreting a verdict and the
[evidence submission template](../.github/ISSUE_TEMPLATE/evidence_submission.yml) when proposing a
published claim.

New manifests also include [cost accounting](eval-costs.md): separate input,
cache-read input, uncached input, output and elapsed time, each with coverage and
spending per successful task. All invoked agent runs retain failures and partners
excluded from quality pairs. Unknown or partial timeout usage suppresses cost
changes; available totals are labeled as lower bounds. Older manifests explicitly
mark these additions unrecorded. No report estimates a bill or changes a verdict.

### Offline CI recipe

[`examples/bench-check.yml`](examples/bench-check.yml) is an opt-in GitHub Actions workflow you can
copy into a skillfit fork's `.github/workflows/` directory. It checks the bundled benches on
macOS, Linux, and Windows and writes a small workflow summary. Replace the bench paths with your own
before enabling it. It makes no agent or model call, so passing it validates bench integrity, not
Skill efficacy. The repository's normal CI already runs these checks on all three operating systems.
