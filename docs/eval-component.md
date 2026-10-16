# Agent evaluation component

Use the existing `eval` engine through a versioned JSON request to compare a
candidate Skill with its previous complete version. The component returns quality
changes, observed regressions, spending coverage and a separate adoption decision.
It never installs, publishes or upgrades a Skill. These interfaces are included
in [0.9.0](releases/0.9.0.md). Use npm 0.9.0 or newer, or build the current
checkout; npm 0.8.0 does not include them.

Build the bench around the task being evaluated, with deterministic acceptance
checks and an independent reference repair. Bundled and contributed benches are
examples, not a universal test of every Skill. See the [authoring guide](bench-authoring.md).

In 0.10.1, execution requires an automatic offline
[case preflight](eval-case-preflight.md) after preview-hash confirmation and before
any agent/judge call. `plan.evaluation.casePreflight.status` is `pending`; preview
executes no verifier/oracle. Hard failures return `CASE_PREFLIGHT_FAILED` and a
structured `casePreflight` report with zero calls and no native run directory.
Warnings and unknowns remain separate and nonblocking. Successful probes are
frozen in the native plan and included in JSON assessment/replay; they do not
authorize adoption or alter statistical/cost requirements.

The same source build [seals original inputs](evaluation-input-snapshots.md)
before dispatch. Preview declares `plan.evaluation.inputSnapshot.status: "pending"`;
completed/stopped JSON assessment includes `inputSnapshot` with the plan-bound
index hash and local copy/storage cost. Native replay/export use sealed inputs
after originals change or disappear; a damaged archive cannot be overridden.
Historical runs return null and retain matching-root recovery. Snapshot copies
make zero model calls and do not change acceptance or incomplete-cost semantics.

The [maintained evidence index](skill-evaluation-evidence.md) links all development
and independent cohorts, their exact costs and offline replay packages. As of
October 15, the debugging study totals 195 actual calls with seven historical
final usages unknown. No candidate qualifies for adoption: favorable point
estimates, incomplete costs and observed regressions remain distinct outcomes.

The latest [receiver mechanism probe](../evidence/2026-10-15-receiver-mechanism-stop.md)
stops after one failed v4.1 call; its control never runs. The preceding
[independent comparison](../evidence/2026-10-15-independent-comparison-regression-stop.md)
stops at 12/80 after an observed correctness regression. Both are closed; unused
slots authorize no retry, replacement or expansion. The eight-task offline
readiness record establishes task integrity, not Skill efficacy.

The [concrete request example](examples/eval-request.diagnosing-v2.json) compares
the two complete public debugging Skill versions on eight pinned real defects.
Preview it without writing files or making an agent call:

```bash
node dist/cli.js eval --request docs/examples/eval-request.diagnosing-v2.json --dry-run
```

The example declares 80 calls and 25% per-success cost increase ceilings; these
are explicit example settings, not the component defaults or proof that either
version is better. A live reproduction requires spending authorization and a
fresh run group. Public task outcomes can inform later development and should
not be treated as a new blinded holdout for repeated candidate selection.

## Input and execution

Save `request.json` outside the evaluated Skill directories. All paths resolve
relative to that file, regardless of the caller's working directory:

```json
{
  "schemaVersion": 1,
  "baselineSkill": "./skill-old",
  "candidateSkill": "./skill-new",
  "bench": "./validation-bench",
  "agent": "codex",
  "purpose": "validation",
  "pairOrder": "balanced",
  "executorTimeoutSeconds": 600,
  "trials": 5,
  "maxCalls": 80,
  "runsRoot": "./runs",
  "runGroup": "revision-validation-001",
  "policy": {
    "schemaVersion": 1,
    "minTasks": 8,
    "minTrialsPerTask": 5,
    "minDeltaPassRate": 0,
    "maxCostIncreaseFraction": {
      "uncachedInput": 0,
      "output": 0,
      "durationSeconds": 0
    }
  }
}
```

The [request schema](schemas/eval-request.schema.json) and
[policy schema](schemas/eval-policy.schema.json) document request version 1 and
the versioned quality/efficiency policies. The runtime
parser rejects unknown fields and invalid ranges. `policy` is optional and defaults
to the conservative values above. The two complete Skills must have the same
frontmatter name and different fingerprints. The caller must supply a fresh run
group and an explicit call ceiling; eight tasks at five trials need 80 calls.

`pairOrder` is optional and defaults to `baseline-first` for compatibility.
Use `balanced` for a new comparison when cache warming and elapsed time matter:
the first arm alternates by task position and trial number, while both arms of
every pair remain adjacent. Eight tasks with five trials have 20 pairs starting
with each arm; each task has two or three starts per arm. The preview and native
plan freeze this choice, the manifest records it, and offline assessment verifies
the actual invocation ledger against the declared order. Older records without
order metadata retain their original interpretation. Balancing order does not
isolate provider cache state, pin sampling or guarantee a latency effect.

Requests may declare `executorTimeoutSeconds` (integer 1–3600, default 600) for
the real agent deadline in **both** arms. The preview and native plan bind it;
offline audit checks each real invocation's recorded deadline. Older plans without
the field report it as unrecorded. A changed deadline requires a new preview and
fresh batch, and must not replace timed-out observations in an earlier batch.
Timeouts retain their measured duration and available partial usage. A larger
deadline increases the maximum elapsed budget without changing the call ceiling;
it neither guarantees completion nor repairs provider availability.

Available in 0.10.0: optional `spendingBudget` freezes five whole-batch
stop lines in the request, preview and native plan. All five fields are required
when supplied: `input`, `cachedInput`, `uncachedInput`, `output` (positive safe
integer token counts), and `durationSeconds` (positive finite seconds). For
example, the independent proposal uses 40000000, 36000000, 5000000, 1250000 and
43200 respectively. These absolute spending lines are separate from the
adoption policy's relative cost ceilings and the `maxCalls` ceiling. Old requests
that omit the field retain their previous interpretation.

Before every call, the engine checks accumulated spending from **all actual
agent invocations**, including functional failures and excluded partners. Reaching
any line prevents the next invocation. A currently running call may overshoot;
this is a between-call guard, not a provider token cap. Missing, partial or invalid
final usage, an execution error, or a configuration guard error stops further
calls immediately. There is no retry, replacement or automatic expansion. If the
last predeclared call reaches a line with complete evidence, the completed cohort
is retained; exceeding a line is never hidden or clamped. A stopped prefix cannot
authorize adoption. Judges and trigger evaluations reject this option because
their separate spending is outside this paired-agent accounting.

The native `_budget.jsonl` records before/after snapshots. Completed receipt audit
recomputes every snapshot in declared execution order and checks its sealed
bytes; resealing a fabricated lower total does not pass. Stopped reports retain
available receipts and expose invalid receipt paths as unknown usage while leaving
the original files untouched. `spendingBudget` in results includes frozen limits,
event count, latest recorded state and read errors. Its stopped-run summary is
informational, not evidence of a complete verified comparison.

Optional `taskIds` (0.10.0+) selects a nonempty set of unique task IDs. Unknown or
unsafe IDs fail before calls. The bench's manifest order is preserved, and only
selected cases contribute to planned calls, costs and outcomes. The complete bench
hash and selected IDs/order are frozen into the plan. CLI positional eval uses
repeatable `--task <id>` instead. Selection never lowers the adoption scale or
creates independent validation; see [case management](case-management.md).

```bash
node dist/cli.js eval --request ./request.json --dry-run
node dist/cli.js eval --request ./request.json --plan-sha <plan.sha256>
```

The first command writes nothing and calls no agent. Read its JSON `plan.sha256`,
review the inputs, cost ceiling and policy, then pass that exact hash to the second
command. Execution requires the caller's existing authorization to spend; possession
of a hash is not user consent. Request-based eval cannot be mixed with positional
eval settings. It always uses installed workspace delivery and disables judges.

The preview pins normalized request settings, request bytes, both Skills, the bench,
executor description and compiled implementation. A changed preview fails before
calls or run-directory creation. The native session separately freezes recorded
configuration at execution time; the preview does not isolate global configuration
or pin server-side model sampling. CLI model/settings continue to come from the
existing agent configuration. Served model identity remains unrecorded where the
executor cannot attest it.

The request file is guarded before and after each call, including its inline policy.
The native `_plan.json` and manifest retain the policy and its SHA-256. Changing
the request during a run stops further calls and preserves settled receipts.

## Output contract

Stdout contains one JSON document. Execution diagnostics go to stderr. Success
responses use `schemaVersion: 1`, `kind: "skillfit.eval-result"`:

The [response schema](schemas/eval-result.schema.json) defines the envelope and
decision invariants. Different statuses omit fields whose evidence is unavailable;
callers should retain unknown/new fields for forward-compatible reporting.

| Field | Meaning |
|---|---|
| `status` | `planned`, `completed`, `stopped`, `incomplete`, or `reported` for an unmanaged historical manifest |
| `plan` | Request, fingerprints, executor, task IDs, trials, call ceiling, output directory and preview SHA; present for request execution |
| `manifest` | Saved v4 manifest path and byte SHA-256; null when a stopped run produced no final manifest |
| `identity` | Candidate, baseline, bench and configured executor identities; present with a final manifest |
| `environment` | Verified native Node/CLI versions, configured settings, recorded `pairOrder`, served-model limitation and executor injection provenance; null for unverified evidence; unrecorded order stays null |
| `quality` | Existing statistical verdict, uncertainty, improved/regressed pairs and per-task outcomes, scores and named-check changes |
| `costs.populations` | Surviving paired costs and all agent invocations, including graded failures, errored calls and excluded successful partners |
| `costs.changes` | Descriptive total and per-success changes; null when coverage or the baseline denominator cannot support the comparison |
| `costs.efficiency` | Explicit policy version 2 only: all-invocation uncached-input point, task-block interval, per-task changes and fixed protocol |
| `spendingBudget` | Optional frozen absolute stop lines and retained event state; completed native audit verifies snapshots against receipts |
| `evidence` | Native file/receipt integrity, policy binding, replay coverage and evidence locations; `pairs` retains each pair's outcomes, named-check changes and full cost observations |
| `acceptance` | `decision`, `eligibleForUpgrade`, policy, reason codes and scope; `automaticUpgrade` is always false |

New installed-eval previews include `evaluation.nativeDiffTool` (ID, version,
workspace path and SHA-256). `environment.nativeDiffTool` reports the verified
native plan's descriptor; older runs return null. Both arms receive the same
`node _skillfit/native-diff.cjs <file>` helper and common usage guidance before
the fixture Git commit. It displays untracked-file patches through native Git,
avoiding filtered empty `git diff --no-index` output. A displayed patch may return
exit 1; command errors retain stderr and their exit status. The helper source is
sealed as `_native-diff.cjs`, guarded before/after calls and checked in native
audits. Fixture collisions fail before execution; altered helpers stop subsequent
calls and retain spending. This corrects the common environment for new runs,
not a Skill or adoption policy. Delivery does not prove agent use; inspect the
command trace. Old receipts remain unchanged and replayable.

Planned responses carry no observed quality or spending. Stopped or unfinished
runs without a manifest carry the available session and receipt-based spending, with missing invocation
receipts counted as unknown usage rather than zero. They never imply a paired
quality result. Legacy manifests retain their recorded scope: missing cost fields
stay null; the component does not infer cache partitions from prompt size.

When a failed JSON CLI has a matching local numeric counter, the receipt may
retain partial tokens plus `usageEvidence` (identity, timestamp, source record
hash and numeric snapshot). [The partial-usage contract](eval-costs.md#partial-usage-after-a-failed-json-cli-call)
keeps private bodies out of exports and never promotes partial coverage to final.
Errors, missing final usage and stopped batches remain ineligible under both policies.

Invalid inputs or execution setup failures return `kind: "skillfit.eval-error"`,
`status: "error"`, an error code/message and ineligible acceptance. Exit status 2
signals invalid/failed request execution or a stopped request run. Exit status 0
means a JSON assessment was produced, including a read-only stopped-run report;
it does **not** mean adoption was accepted. Callers must inspect acceptance fields.

## Adoption policy

This policy is separate from the frozen [statistical verdict](metrics.md). It does
not introduce an equivalence or non-inferiority test. It returns:

- `reject` when observed pass, score or named-check regressions exist, the overall
  verdict is negative, or measured per-success costs exceed a declared limit.
  Paired named-check/score regressions remain rejection reasons even when task
  averages improve or cancel them.
- `inconclusive` when adoption requirements remain unmet and no rejection applies.
  This status cannot authorize an upgrade.
- `accept` only when all requirements below pass. This is advisory eligibility on
  the recorded tasks and environment, with `automaticUpgrade: false`.

The default version-1 quality policy requires a positive `effective` verdict meeting the declared minimum
gain, at least eight tasks with at least five graded pairs **for every task**,
a completed native revision experiment without excluded errors, no observed
regressions, a predeclared validation purpose and policy, verified native receipts,
and final coverage of input, cached/uncached input, output and elapsed time for
every invocation. Both arms need successes for the per-success cost comparison.
Policies can raise the scale/gain requirements and set explicit permitted cost
increases; they cannot lower the eight-task/five-pair floor or waive missing evidence.
Injected executors always record `synthetic: true` and cannot authorize adoption,
even when their descriptor claims to be a CLI.

`maxCostIncreaseFraction` checks **all spending per successful task**, including
failures, for uncached input, output and elapsed time. A value of `0.2` allows a
descriptive increase of 20%; the default allows none. Total and paired changes
remain visible. Cache-read tokens are already included in input. Partial/missing
usage is a lower bound and suppresses relative cost claims. These fields measure
agent usage and elapsed time, not dollars, active compute or a stable latency effect.
This first interface runs no judge or candidate generator. Their costs, provider
internal retries with unavailable usage, orchestration and offline verification
must not be presented as a known complete optimization bill.

### An explicit efficiency objective

Use policy `schemaVersion: 2, objective: "efficiency"` **before execution** when
the goal is reduced agent usage with no observed correctness regression.
Version 1 and its hashes retain their original meaning. Version 2 retains the
same scale, receipt, independent-validation, coverage and non-regression gates,
and additionally requires `pairOrder: "balanced"`. It can accept an all-pass tie
only when the separate cost criteria pass; `quality.statisticalVerdict` still
reports `inconclusive`. It never asserts equivalence or a correctness increase.

`minUncachedInputReductionFraction` defaults to `0.1` (minimum `0.01`), and
`minImprovedTaskFraction` defaults to `0.75` (minimum `0.75`). The upper 95%
task-block bootstrap bound must support the declared minimum reduction in all
invocation uncached input per success, and the declared fraction of tasks must
individually improve. `costs.efficiency` records the point, interval, per-task
changes, fixed seed `20261013`, 10,000 resamples and unavailable-evidence reason.
Every task needs final primary usage and successes in both arms; no tasks are
discarded. The [exact protocol and its scope](metrics.md#explicit-efficiency-acceptance-policy-version-2-unreleased)
are frozen separately from the quality test.

Version 2 extends `maxCostIncreaseFraction` with `input` and `cachedInput`;
all five defaults permit no per-success increase. Declare any allowed tradeoffs
explicitly. The [cost example](examples/eval-request.diagnosing-v2-efficiency.json)
permits at most 25% more elapsed time, while permitting no token-partition or
output increase. Previewing either example makes zero model calls. Cost savings
remain scoped to recorded token usage, not a complete dollar bill. Missing
usage, synthetic runs, visible regressions and post-hoc policy changes cannot
authorize adoption under either objective. `automaticUpgrade` always stays false.

`purpose: "validation"` is a caller declaration, not proof of independence. Bench
authors must keep outcomes independent of the Skill and hold validation tasks
apart from development. Repeated candidate selection against the same validation
set can overfit it. Native hashes detect changes against the saved index; they are
not signatures or independent provider attestations. Use trusted bench definitions
and retain/share an external copy of evidence hashes for provenance.

## Offline assessment and replay

Version 0.10.1 seals Ctrl+C/SIGTERM interruptions with available trial
receipts, `_interruption.json`, stopped `_session.json` and `_artifacts.json`.
Request execution preserves exit 130/143 and returns a stopped assessment after
sealing. Partial/unknown costs stay incomplete and ineligible; no automatic retry
or replacement occurs. See [the interruption contract](evaluation-interruption.md).
The npm 0.10.0 archive predates this fix.

Markdown and JSON accept the same manifest/run/package inputs and assessment
options in 0.10.1. Markdown also displays stopped/incomplete spending and the
separate acceptance decision. See [report inputs and states](evaluation-reports.md).

```bash
node dist/cli.js report eval ./runs/revision-validation-001 --json
node dist/cli.js report eval ./runs/revision-validation-001 --json --replay
```

The first command verifies the native `_artifacts.json` inventory and byte hashes,
plan/session binding, per-trial results, paired outcomes, installed resources and
recomputed cost totals. The second also reruns verifiers on temporary copies of
deliveries. It compares exit codes, scores and named checks without modifying the
retained evidence or calling a model. Verifiers are executable bench code; use
trusted benches. Full recipe/fixtures remain necessary for replay.

For relocated native evidence, use `--records <run-dir>` with a manifest copy and
`--bench <matching-bench>` with `--replay`. The manifest must match the saved native
manifest, and the replay bench content hash must match. Redacted historical exports
may differ from native indices; use their dated frozen replay recipes rather than
treating them as verified native evidence. Historical assessments still retain
their reported improvements, regressions and available costs, with ineligible
acceptance when required evidence is absent.

`--policy <policy.json>` supports read-only policy review. A policy different from
the predeclared policy hash cannot authorize adoption. Store rendered assessments
outside the sealed run directory; adding files inside it changes the evidence
inventory. A new request cannot overwrite an existing group or replace failed
samples. A model upgrade or changed inputs requires a fresh bounded declaration.

## Verify the component offline

Use `report eval <run-dir> --export <new-dir> --json` for a read-only export plan,
then `--yes` to build a portable directory with unchanged receipts, matching
inputs, pinned runtime and a checksum/replay entry point. Native paired runs
without a judge are supported, including stopped runs. Missing inputs prevent
export; partial/unknown costs and ineligible acceptance remain visible. See
[portable offline packages](replay-packages.md) for relocated inputs and privacy
review. This does not rerun an agent or produce new efficacy observations.

```bash
npm test
node --test dist/harness/eval-component.test.js
node dist/cli.js report eval evidence/artifacts/2026-10-12-normalize-url-v2-validated/manifest.json --json
```

The component tests inject offline executors and synthetic policy fixtures. They
exercise plan refusal, policy drift, observed improvements and regressions,
per-pair check regressions, full failed-call spending, unknown receipts, native
integrity, balanced adjacent execution and cloned replay. They also check the unchanged dated real evidence.
These are implementation checks, not new model efficacy measurements. The last
command reproduces the available historical totals and remains ineligible for an
upgrade; use that package's own replay recipe for its redacted archive.
