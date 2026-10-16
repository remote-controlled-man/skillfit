# Read an evaluation report

Version 0.10.1 uses the same saved-evidence assessment for Markdown and JSON.
Both formats accept a manifest file, native run directory or portable replay
package directory. Neither starts an agent or changes the saved run.

Source after npm 0.10.1 also displays the saved [Agent environment preflight](eval-agent-preflight.md).
JSON exposes `agentPreflight`; human reports omit its local evidence paths.
Missing historical metadata stays null. Reading/replaying a report does not
repeat environment/authentication probes or claim the current machine is ready.

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

## Calibration and trigger reports (source after npm 0.10.1)

The current source also recognizes baseline calibration and trigger runs. Build
source to use this addition; the immutable npm 0.10.1 archive is unchanged.
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

These descriptive single-arm kinds always return `evidence.verified: false`
with scope `saved-summary-only`, and `acceptance.decision: "inconclusive"`,
`eligibleForUpgrade: false`, `automaticUpgrade: false`. Parsing a consistent
summary is not a paired native audit, independent validation or adoption decision.
They do not enter the paired efficacy protocol. The existing request-based
revision component and paired report JSON contract remain unchanged.

`--replay`, `--policy`, `--records` and `--bench` are paired-report options;
single-arm reports reject them in both formats instead of silently ignoring
them. This addition does not enable portable calibration/trigger replay exports.
Successful rendering exits 0; invalid human inputs exit 1, while invalid JSON
reports use the existing error envelope and exit 2. Saved input files are never
rewritten, and reading any of these reports makes zero model or agent CLI calls.
