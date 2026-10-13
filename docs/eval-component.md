# Agent evaluation component

Use the existing `eval` engine through a versioned JSON request to compare a
candidate Skill with its previous complete version. The component returns quality
changes, observed regressions, spending coverage and a separate adoption decision.
It never installs, publishes or upgrades a Skill. These interfaces are unreleased;
build the current checkout rather than assuming npm 0.8.0 includes them.

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
| `evidence` | Native file/receipt integrity, policy binding, replay coverage and evidence locations; `pairs` retains each pair's outcomes, named-check changes and full cost observations |
| `acceptance` | `decision`, `eligibleForUpgrade`, policy, reason codes and scope; `automaticUpgrade` is always false |

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
