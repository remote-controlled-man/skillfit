# Evaluation report and replay formats

This reference defines saved result fields, cost populations and portable formats.
For commands and sharing steps, follow [evaluation workflow](../guides/experiment-workflow.md#read-share-and-reproduce).
[Choose your build](../README.md#choose-your-build) before using source-only contracts.
Human and JSON reports read the same saved bytes; they never rescan the current
environment to invent historical usage, identity or claims.

## Frozen measurement scope

Unpublished source records can include optional `measurementScope` v1 in paired,
trigger and calibration reports; [bench claims](../../benches/README.md#claims-and-measurement-scope) owns its fields
and derivation. Schema 2 uses explicit task declarations; schema 1 records null
claims and legacy-unrecorded support for a non-null target. Missing historical
metadata stays absent and never acquires today's declarations. Assessment is design support, not proof
of validity, power or adoption. Null diagnostic targets are not efficacy claims.

New audits compare summary scope with the native/reviewed plan and selected
order in the original sealed bench. Malformed/unsupported versions, missing
new scope on only one side, or contradictory declarations cannot verify evidence.
A paired report policy override leaves the original target unchanged and cannot
grant an undeclared schema 2 claim. Quality numbers remain observations within
that scope. [Portable replay](#portable-replay) retains the same frozen inputs.

Paired JSON adds per-task `diagnostics`; calibration JSON has
`summary.tasks[].diagnostics`. Baseline ceiling/floor, quality headroom, efficiency
eligibility and activation coverage remain separate. A saturated task is not
discarded from efficiency; actual paired costs/variance, final coverage and
regressions still govern qualification. Calibration alone cannot establish
savings or quality equivalence. Trigger reports keep observed label/detection
coverage, including unknowns. See [diagnostics](../../benches/README.md#reading-difficulty-diagnostics).

For [self-test](../guides/bench-authoring.md#test-known-controls), read a native suite directory, not the wrapper
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
See [cost accounting](#cost-accounting), [input snapshots](../guides/experiment-workflow.md)
and [portable packages](#contents-and-machine-contract). Review project data before sharing.

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

## Calibration and trigger reports

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
without single-arm replay support; see [portable packages](#contents-and-machine-contract).
Successful rendering exits 0; invalid human inputs exit 1, while invalid JSON
reports use the existing error envelope and exit 2. Saved input files are never
rewritten, and reading any of these reports makes zero model or agent CLI calls.

### Trigger observation protocol v2

New production trigger runs freeze a [version 2 detection declaration](../schemas/trigger-detection.schema.json)
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

## Judge spending and stop reasons

Paired Markdown and JSON additionally show `invocationCosts`: separate primary,
judge and combined populations. The original Agent A/B quality and cost tables
remain unchanged. Successful, failed and interrupted judge orders have independent
receipts and final/partial/unknown usage. Missing historical judge usage stays
unknown. See [all executor roles](#all-executor-roles).

Budget stops retain `session.stopCode` and safe reason text. Single-arm reports
show the same frozen `spendingBudget` limits/latest state as paired reports.
The native audit and any upgrade eligibility are separate decisions; all
single-arm, stopped and insufficient-evidence results remain ineligible.
The [single-arm schema](../schemas/single-arm-report.schema.json) and
[calibration command schema](../schemas/calibration-result.schema.json) describe
their machine envelopes.

## Cost accounting

Paired `eval` runs record descriptive agent costs in `tasks[].costs` and
`overall.costs` (cost schema 1, optional additions to manifest schema 4). The
terminal summary and `report eval <manifest.json>` show the same cost tables.
Reading a report makes no model call and does not change the manifest or verdict.

This page owns invocation populations, denominators and final/partial/unknown
coverage. [Planning](../guides/experiment-workflow.md) owns the optional,
five-field spending-budget format and deadline settings;
[metrics](metrics.md#costs-budgets-and-stopping) owns stopping semantics across
paired, calibration, trigger and judge calls. Version 0.11.0 exposes these
shared controls; absolute stop lines are separate from relative adoption caps
and provider invoices. Current adapter readers and strict-budget limitations
belong to the [capability table](../guides/experiment-workflow.md).

Native paired condition summaries may include `tokenCoverage.input/output`: the
number of surviving graded trials with final recorded usage for each field.
Missing legacy coverage stays unrecorded. This coverage does not change existing
`tokens` totals or verdicts; incomplete coverage cannot prove complete overhead.

### Two populations

- **Surviving graded pairs:** the same paired observations used by the quality
  statistics. A failure that was graded remains in this population and consumes
  cost. An execution, engagement or verifier error removes the entire pair.
- **All agent executor invocations:** every invoked agent run, including errors,
  configuration drift after a call, and the successful partner removed from the
  quality population. Successful tasks are the invocations that passed the
  verifier without an error, including partners excluded from paired statistics.

`notInvoked` records trial receipts refused before entering the underlying
executor, such as frozen-input guards or Git setup failures. They do not enter
spending totals. An executor invocation does not prove that a provider accepted
a request or billed it. These counts do not include the optional judge, earlier
calibration cohorts or another experiment's setup spending.

### All executor roles

New paired manifests and JSON reports add `invocationCosts`, independently of
the unchanged primary Agent's `overall.costs`. It contains `agent`, `judge` and
`total` populations and `judgeUsage: recorded | unknown | not-requested`;
see the [schema](../schemas/invocation-costs.schema.json). Each population retains
the five measures and final/partial/unknown coverage below. Judge `passes`
counts successfully parsed grading calls, so the combined `passes` is not a task
success rate and must not be used as the denominator of Agent cost per success.

Every judge order saves a version-1 `skillfit.judge-call` receipt under
`<task>/judge-trial-<n>/call-1.json` or `call-2.json`. It retains the anonymous
prompt and hash, output, available raw output, executor, invocation/error state,
token coverage and monotonic elapsed interval. Invalid grading JSON still costs
an invocation and stops subsequent work. Failure/interruption retains final, partial or
unknown usage; it never becomes a free or successfully graded call. Missing
credentials for an explicitly enabled judge block before primary spending.

Reports and offline replay verify saved primary/judge receipts and their ledger.
Replay checks retained judge prompts/scores/usage; it never asks a judge to grade
again. Historical missing judge receipts keep judge/combined totals unknown and
cannot qualify for a complete native export. Legacy primary costs remain readable.
Calibration and trigger reports expose their own single-arm `usage` population;
they do not acquire a paired cost comparison.

The spending recorder checks before each invocation and after each retained
receipt. Execution errors or incomplete final usage stop even after the last
scheduled call; a reached limit prevents the next call. Stopped native sessions
preserve a controlled `stopCode` (`EXECUTION_FAILED`, `FINAL_USAGE_MISSING` or
`SPENDING_BUDGET_REACHED`) and safe reason text. No automatic retry or replacement
is added. Historical absence of `stopCode` is not reconstructed; a received
SIGINT/SIGTERM retains the interruption as the primary stop reason. Generation,
local verifier/setup work and another experiment's calls
are outside these executor token populations; input sealing has separate costs.

Each population records runs, successful tasks and five separate measures:
input tokens, cached input tokens, uncached input tokens, output tokens and
elapsed seconds. Elapsed time is measured around the agent invocation and
engagement check; it excludes fixture preparation, Git setup, verifier and judge
time. Timeout duration remains recorded even when token usage is unavailable.
New receipts measure this interval with `performance.now()` and retain wall
duration separately. Neither measure is active compute or billing time. Earlier
receipts remain unchanged. CLI timing anomalies retain spending and exclude the
pair as an execution error; see [execution timing](../guides/experiment-workflow.md).

### Cache and coverage

Version 0.12.0 reads matrix-defined JSON streams in ordinary CLI eval and
CLI judging too, independently of Skill-trigger detection. Codex inject, rules and
MCP comparisons can retain the same per-turn counters as installed/trigger mode.
Only assistant text is graded; raw stream evidence and partial failure counters
are retained separately. Ordinary parsing does not fabricate a trigger flag.
Offline `USAGE_CAPABILITY` checks block strict spending budgets when an adapter is
known to lack required counters, including an enabled judge. API and injected
executors retain unknown offline coverage; actual missing counters still stop
after an invocation, with no retry or guessed cache zeros. The
[capability table](../guides/experiment-workflow.md) distinguishes
Codex's complete reader set from Kimi's missing cache partition and Claude's
missing token reader. Historical receipts
remain unchanged; this does not recover token counts from old plain-text runs.

Cached input is the cache-read subset already included in input; adding it to
input would double-count. `uncachedInput = input - cachedInput` only when both
counts are present and `0 <= cachedInput <= input`. Uncached tokens can include
cache creation; these fields do not establish how a provider priced them.

The Codex stream parser sums per-turn `input_tokens`, `cached_input_tokens` and
`output_tokens`. It requires compatible cache counts on every completed turn to
report an input partition. A missing cache count is unknown; an explicit zero
is recorded as zero. Other executors can supply cache counts through the same
optional `TokenUsage.cachedInput` field. Existing surfaces without such counts
continue to report unknown cache coverage.

In 0.10.1, the Chat Completions API executor reads
`usage.prompt_tokens_details.cached_tokens` into `TokenUsage.cachedInput`, as
documented by the [official OpenAI API reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create).
It requires a nonnegative safe integer no greater than a valid input total.
An explicit zero is preserved; missing, malformed, fractional, negative or
incompatible cache counts remain unknown. Input already includes cached tokens;
uncached input is still computed by subtraction, with no double counting.
This fixes new receipts only; historical unknown cache usage is not backfilled.

Each measure contains `knownTotal` and coverage counts `final`, `partial` and
`unknown`, which sum to its population's run count. A successful stream with
missing input/output usage on a completed turn retains available increments as
partial usage. A CLI timeout, nonzero exit or output limit retains captured
public stdout and any usable completed-turn usage in the error receipt with
`usageStatus: partial`. It does not inspect hidden reasoning or private session
logs to recover missing timeout usage. A generic failure with no usage records
unknown coverage. Complete legacy token totals only include final receipts.

When coverage is incomplete, an available sum is displayed as `>=` (a known
lower bound), and its percentage change is suppressed. When no usage was
recorded, it is displayed as `unrecorded`, rather than an exact zero. Complete
elapsed time can still be compared when token usage is unknown. Earlier v4
manifests without cost summaries remain readable and explicitly identify this
missing information; the report does not silently enrich them from local files.

### Failed API responses

API response parsing retains the public response and any valid reported usage
before rejecting a missing/non-text answer, malformed JSON or non-2xx status.
A complete response's supplied counters remain final for those fields even when
its answer cannot be graded. Missing fields stay unknown; malformed JSON cannot
establish usage. Neither a format failure nor an HTTP error proves the call was
free. Connection failures without a readable response still have unknown usage.

These errors remain ungraded execution failures and stop subsequent calls. Agent
responses are retained in `_transcript.jsonl`; failed API judge responses are in
their independent judge receipts. Request authorization headers/keys are not
added to the evidence. Reports/export/replay preserve the original counters,
with no API retry or new observation. Earlier unknown costs are not backfilled.

### Spending per success

For each measure and population:

```text
cost per success = sum of all spending in the population / successful tasks
change = treatment cost / baseline cost - 1
```

This includes unsuccessful runs' spending. For example, baseline uses 20 input
tokens and succeeds twice, while treatment uses 16 and succeeds once. Total
input falls 20%, but input per success increases 60% (10 to 16). Reporting only
successful runs' costs would hide this regression. With no successes the result
is `n/a`; a zero baseline or incomplete coverage also prevents a percentage
comparison. A partial total divided by a known positive success count remains a
lower bound.

These manifest summaries are observed costs on the declared tasks, without a cost confidence
interval or significance verdict. They are not a billing estimate. Input,
cache-read input, output and elapsed time remain separate; there is no blended
price or guessed dollar amount. All quality verdicts, pair exclusions, McNemar
tests and paired-bootstrap confidence intervals remain governed by the
[metrics protocol](metrics.md).

An explicitly predeclared version-2 `efficiency` component policy adds a separate
task-block interval for uncached input per success in `costs.efficiency`. Its
[fixed protocol](metrics.md#explicit-efficiency-acceptance-policy-version-2-unreleased)
and coverage gates do not change manifest accounting or the quality verdict.
It can support scoped savings with no observed correctness regression, not
equivalence, dollar savings or a general latency effect.

### Partial usage after a failed JSON CLI call

The matrix's `headless.partialUsageFromSessionLog` capability enables best-effort
recovery for failed Codex JSON invocations. Normal successes retain the public
`turn.completed.usage` authority documented in [non-interactive mode](https://developers.openai.com/codex/noninteractive/).
For a failure, the reader matches the public thread ID, canonical workspace and
invocation time window to one local session file at the matrix-defined location,
respecting the configured [CODEX_HOME state root](https://developers.openai.com/codex/config-advanced/).
It reads only cumulative numeric `token_count` values into the result; private
messages, reasoning text, auth/configuration bodies and unrelated sessions are
never emitted or copied. The internal rollout format is experimental: absent,
ambiguous, stale, malformed or decreasing counters stay unknown. It never guesses
an identity from file modification time or replaces a larger public counter.

`usageEvidence` in `_result.json` retains the thread ID, last counter timestamp,
original counter-record SHA-256, selected numeric tokens and partial scope. The
counter is cumulative, so successive snapshots are not summed. Reasoning output
is already included in output and is not added again. Recovery stays `partial`;
unrecorded pending work/retries and final billing remain unknown. Every execution
error remains excluded from quality and prevents adoption. Previously frozen
receipts are never rewritten; later metadata corrections belong in a separately
dated supplement. The implementation was calibrated against eight completed
0.162.0-alpha.17.2 calls and recovered lower bounds for three failed calls.


## Portable replay

skillfit 0.10.0 introduced paired native exports without a judge. Source after
npm 0.10.1 also exports native calibration, trigger and paired runs with a judge
to a fresh directory.
The package contains unchanged receipts, original pinned inputs, the compiled
implementation used by the experiment and a dependency-free replay entry point.
Export and replay make zero model calls. Replay executes trusted local verifiers.
Current-source model-identity additions retain per-call public IDs, source locations
and unknown coverage after relocation. They do not backfill legacy data or prove
the backend's identity; see [model identity contract](metrics.md#public-model-identity-per-invocation). These additions
are not yet published in npm 0.13.1. Frozen historical packages keep their own
runtime and detection/identity interpretation.

Current-source [measurementScope 1](../../benches/README.md#frozen-scope-and-evidence)
is retained across paired, trigger and calibration exports. New scope is checked
against the original sealed bench, selected task order and native/reviewed plans.
Today's external bench cannot fill or broaden it; new scope without its required
sealed declarations fails rather than taking the historical recovery route.
Legacy missing metadata stays unrecorded. Current-reader audit and the package's
pinned `reproduce.mjs` each interpret saved evidence with their own runtime.

For [self-test controls](../guides/bench-authoring.md#test-known-controls), export a native
suite directory, not its wrapper. It retains a null requested claim, mock identity,
unknown provider usage and ineligibility; replay executes saved verifiers, not
control actions or an executor. These source contracts are not npm 0.13.1 features.

### Preview, export and move

Follow [read, export and reproduce](../guides/experiment-workflow.md#read-share-and-reproduce)
for the command sequence. The operation contract is:

| Operation | Behavior |
| --- | --- |
| Export preview | No `--yes`, or explicit `--dry-run`: validate inputs and return the plan without writing. |
| Export apply | `--yes` stages/verifies files, claims a fresh destination outside the source run and all pinned input roots, and verifies it. Existing destinations, even empty ones, fail. |
| Failed transfer | An incomplete claimed destination is not success; preserve it for inspection and choose a fresh destination. |
| `reproduce.mjs --verify-only` | Check inventory, hashes and source-plan binding; execute no verifier. |
| `reproduce.mjs` | Use the pinned compiled CLI to regrade temporary delivery copies; start no model. Node >=22 and the verifier's external toolchains remain necessary. |
| Current CLI `report eval --replay` | Interpret packaged evidence with the current installed CLI; this is distinct from the pinned reproducer. |

SIGINT/SIGTERM is forwarded through the pinned cancellation context; the launcher
waits for managed processes and exits 130/143. Saved evidence stays read-only.
The package does not install the verifier's external toolchains.
Runtimes predating that cancellation support cannot be exported by this build.

The source must have sealed native evidence. A completed manifest must pass the
native evidence audit. Missing, changed or linked native artifacts reject export.
Version 0.10.1 [seals inputs before dispatch](../guides/experiment-workflow.md)
and exports those copies even after original bench/Skill/request directories change
or disappear. A declared but damaged snapshot is an error, never a silent fallback.
Older runs without snapshots still need matching original or recovered bench,
complete candidate/baseline resources, compiled implementation and original request.

Recover original files elsewhere and provide matching paths when necessary:

```bash
skillfit report eval ./runs/my-run --export ./exports/my-run --input-root bench=./recovered/bench --input-root target=./recovered/new-skill --input-root baseline-skill=./recovered/old-skill --input-root implementation=./recovered/dist --input-root request=./recovered/request.json --json
```

Only labels present in that run may be supplied; fingerprints must match exactly.
`request` names a file, all other labels name directories. `--bench <path>` is a
shortcut for the export's bench root; do not combine it with `--input-root bench`.
This recovers paths, not missing evidence or permission to change a cohort. Explicit
overrides do not bypass validation of a new run's declared input archive.

### Contents and machine contract

- `run/`: original native receipts, indices, plan, session and optional manifest
  or `_calibration.json`; judge runs also retain both review-call receipts.
- `inputs/bench`, `inputs/target`, optional `inputs/baseline-skill` and
  `inputs/request.json`: matching frozen inputs.
- `runtime/dist/`: unchanged compiled implementation. Minimal ESM package metadata
  is reconstructed from the native recorded version in `runtime/package.json`.
- `reproduce.mjs`, `README.md`, `replay-package.json`: replay and integrity index.

The descriptor uses `schemaVersion: 1`, `kind: "skillfit.replay-package"`,
`sourcePlanSha256`, `nativeStatus`, `hasManifest` and a relative-path-to-SHA-256
`files` map. It inventories every payload file except itself and Git internals.
New exports add `evaluationType: "paired" | "calibration" | "trigger"`, checked
against the frozen native plan. Older v1 descriptors without that field remain
readable.
Extra, changed, missing and unsafe paths fail verification. Checksums establish
consistency with this index, not publisher identity; retain a trusted external
copy of the descriptor or its hash for provenance.

Export JSON uses `kind: "skillfit.eval-export"`, status `planned` or `exported`,
source/destination, native plan/status, inputs, payload-file count, source-byte
count (excluding generated metadata), `modelCalls: 0` and
`sharingReviewRequired: true`. `--json` stdout is one document; errors use the
evaluation error envelope and exit 2. Export cannot be mixed with `--replay`,
`--records` or `--policy`.

Current source also returns `inputSource: "sealed-snapshot"` for archived inputs
or `"original-or-recovered"` for historical runs. Native archives remain unchanged
inside `run/`; portable layout inputs/runtime are extra copies counted by the
export preview. Per-run snapshot copy time and storage are recorded separately
in the native plan and JSON assessment's `inputSnapshot.cost`.

### Evidence and sharing boundaries

Stopped or incomplete native runs can be exported with their partial/unknown
spending and remain stopped/incomplete and ineligible. An offline replay reproduces
saved outcomes and accounting; it creates no new observations, independent holdout
or upgrade authorization. Statistical and acceptance policies are unchanged.

Calibration and trigger exports verify the single-arm plan, session, ledger,
receipts, task summaries and available usage. Replay regrades saved deliveries in
temporary directories with the pinned local verifier. Trigger observations remain
the recorded `triggered` values: replay starts no Agent and does not attempt new
discovery detection. The report uses `evidence.scope: "single-arm-native"`;
`verified` establishes consistency of retained observations, never a paired
improvement or adoption decision. Standalone historical summaries without a
sealed native run cannot be replayed or promoted into native exports.
An older single-arm run whose pinned implementation predates replay support
cannot produce an executable replay package; export explains that limitation
instead of replacing the original implementation with newer code.

Paired judge exports require separately sealed review-call receipts and full
invocation accounting. Replay audits retained judge outputs, scores and costs;
it does not call the judge again. Primary Agent costs and additional judge costs
remain separate, with a combined invocation population. Historical judge runs
without those receipts retain unknown judge/combined costs in reports and cannot
claim a complete portable export.

Missing invocation receipts in stopped single-arm runs remain unknown usage;
available final and partial counters are retained as recorded. Replay cannot
turn partial usage into a complete total or invent unfinished task metrics.
Legacy/redacted public archives retain their dated replay recipes and cannot be
relabeled as complete native exports.

Export only writes locally. It includes project files, prompts, outputs and paths;
review those contents before sharing. Global configuration/Skill trees are not
copied automatically, but paths and fingerprints already recorded in native plans
remain visible. Redaction changes the indexed package; keep the original evidence
and publish any reviewed redacted derivative with its own explicit recipe.



Earlier source documentation: [fixed snapshot](https://github.com/remote-controlled-man/skillfit/blob/4ec83672b69799bc62613c381f6b12ba8f3f3068/docs/reference/evaluation-reports.md).
