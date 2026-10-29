# Evaluation component contract

This reference owns JSON requests/results, execution binding and adoption-policy
fields. Follow [evaluation workflow](../guides/experiment-workflow.md) for the
sequence of operations; [report reference](evaluation-reports.md) owns saved
formats and costs, and [metrics](metrics.md) owns statistical meaning.
Use the [build/version entry](../README.md#choose-your-build) for availability.
The component never installs or adopts a Skill automatically.

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

The [request schema](../schemas/eval-request.schema.json) and
[policy schema](../schemas/eval-policy.schema.json) document request version 1 and
the versioned quality/efficiency policies. The runtime
parser rejects unknown fields and invalid ranges. `policy` is optional and defaults
to the conservative values above. `baselineSkill` is required: a string selects
the previous complete Skill; explicit null selects no harness-installed Skill in
baseline. Omitted/empty/invalid values are rejected.
When comparing revisions, the two complete Skills must have the same
frontmatter name and different fingerprints. Inherited global configuration
still applies in both arms. No-Skill comparisons retain measurements but cannot
authorize revision adoption (`REVISION_COMPARISON_REQUIRED`).
The caller must supply a fresh run
group and an explicit call ceiling; eight tasks at five trials need 80 calls.

`pairOrder` is optional, default `baseline-first`; `balanced` alternates the
first arm while keeping each pair adjacent. [Shared planning](../guides/experiment-workflow.md)
defines the settings; [analysis units and sampling](metrics.md#unit-of-analysis)
define their interpretation. Plans freeze the choice and native audit checks
the ledger; historical absence stays unrecorded.

`executorTimeoutSeconds` is optional (integer 1–3600, request default 600), bound
into the preview/native plan for both arms and checked against receipts. Current
source additionally accepts explicit null with Token-only spending limits on a
supported adapter, disabling this deadline without changing elapsed diagnostics.
The published 0.14.0 package does not support this source addition.
See [planning](../guides/experiment-workflow.md) for defaults and fresh-batch
requirements, and [timing](../guides/experiment-workflow.md) for retained timeout evidence.

Optional `spendingBudget` freezes whole-batch stop lines
in the request, preview and native plan. When present, **all five fields are
required**; use the [complete format and example](../guides/experiment-workflow.md).
The [stop contract](metrics.md#costs-budgets-and-stopping) covers accumulated
spending, overshoot, incomplete usage and errors without retries/replacements.
The request component has no judge. Absolute stop lines, `maxCalls` and relative
policy cost caps remain distinct; omitting the budget retains old behavior.

The native `_budget.jsonl` records before/after snapshots. Completed receipt audit
recomputes every snapshot in declared execution order and checks its sealed
bytes; resealing a fabricated lower total does not pass. Stopped reports retain
available receipts and expose invalid receipt paths as unknown usage while leaving
the original files untouched. `spendingBudget` in results includes frozen limits,
event count, latest recorded state and read errors. Its stopped-run summary is
informational, not evidence of a complete verified comparison.

Optional `taskIds` selects a nonempty set of unique task IDs. Unknown or
unsafe IDs fail before calls. The bench's manifest order is preserved, and only
selected cases contribute to planned calls, costs and outcomes. The complete bench
hash and selected IDs/order are frozen into the plan. CLI positional eval uses
repeatable `--task <id>` instead. Selection never lowers the adoption scale or
creates independent validation; see [case management](../guides/bench-authoring.md).

```bash
node dist/cli.js eval --request ./request.json --dry-run
node dist/cli.js eval --request ./request.json --plan-sha <plan.sha256>
```

The first command writes nothing and calls no agent. Read its JSON `plan.sha256`,
review the inputs, cost ceiling and policy, then pass that exact hash to the second
command. Execution requires the caller's existing authorization to spend; possession
of a hash is not user consent. Request-based eval cannot be mixed with positional
eval settings. It always uses installed workspace delivery and disables judges.

The preview pins normalized request settings, request bytes, the candidate and
any previous Skill, the bench,
executor description and compiled implementation. A changed preview fails before
calls or run-directory creation. The native session separately freezes recorded
configuration at execution time; the preview does not isolate global configuration
or pin server-side model sampling. CLI model/settings continue to come from the
existing agent configuration. Current source retains public response model IDs
where observable, separately from configured/requested intent; absent legacy
identity remains unrecorded. These declarations are not backend attestation.
See the [model-identity contract](metrics.md#public-model-identity-per-invocation).

The request file is guarded before and after each call, including its inline policy.
The native `_plan.json` and manifest retain the policy and its SHA-256. Changing
the request during a run stops further calls and preserves settled receipts.

## Output contract

Stdout contains one JSON document. Execution diagnostics go to stderr. Success
responses use `schemaVersion: 1`, `kind: "skillfit.eval-result"`:

The [response schema](../schemas/eval-result.schema.json) defines the envelope and
decision invariants. Different statuses omit fields whose evidence is unavailable;
callers should retain unknown/new fields for forward-compatible reporting.

| Field | Meaning |
|---|---|
| `status` | `planned`, `completed`, `stopped`, `incomplete`, or `reported` for an unmanaged historical manifest |
| `plan` | Fingerprints, executor, task IDs, trials, call ceiling, output directory and preview SHA; present for execution/preview through either entry; request plans also include the request and policy hashes |
| `manifest` | Saved v4 manifest path and byte SHA-256; null when a stopped run produced no final manifest |
| `identity` | Candidate, baseline, bench and configured executor identities; present with a final manifest |
| `environment` | Verified native Node/CLI versions, configured settings, recorded `pairOrder`, served-model limitation and executor injection provenance; null for unverified evidence; unrecorded order stays null |
| `measurementScope` | Current-source optional frozen scope v1; [claims contract](../../benches/README.md#claims-and-measurement-scope) owns declarations, target derivation/refusal and legacy interpretation |
| `diagnostics` | Current-source paired task diagnostics for baseline band, quality headroom, efficiency eligibility and activation coverage; not qualification or power estimates |
| `quality` | Existing statistical verdict, uncertainty, improved/regressed pairs and per-task outcomes, scores and named-check changes; observations do not expand the declared scope |
| `costs.populations` | Surviving paired costs and all agent invocations, including graded failures, errored calls and excluded successful partners |
| `costs.changes` | Descriptive total and per-success changes; null when coverage or the baseline denominator cannot support the comparison |
| `costs.efficiency` | Explicit policy version 2 only: all-invocation uncached-input point, task-block interval, per-task changes and fixed protocol |
| `invocationCosts` | Primary, optional judge and combined invocation populations with final/partial/unknown coverage; historical absent usage remains unknown |
| `spendingBudget` | Optional frozen absolute stop lines and retained event state; completed native audit verifies snapshots against receipts |
| `evidence` | Native file/receipt integrity, policy binding, replay coverage and evidence locations; `pairs` retains each pair's outcomes, named-check changes and full cost observations |
| `acceptance` | `decision`, `eligibleForUpgrade`, policy, reason codes and scope; `automaticUpgrade` is always false |

Current-source previews expose scope in `plan.evaluation.measurementScope` and
new native summaries retain it. Request schema 1 is unchanged: policy 1 derives
quality, policy 2 efficiency. Schema 2 unsupported targets execute no probes/calls
and return `error.code: "BENCH_CLAIM_UNSUPPORTED"`. An unsupported preview can
still be `planned`; inspect scope as well as environment readiness. Old missing
scope stays absent/unrecorded. A report policy override cannot rewrite the frozen
target or grant an undeclared claim. See [frozen scope](../../benches/README.md#frozen-scope-and-evidence).

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
hash and numeric snapshot). [The partial-usage contract](evaluation-reports.md)
keeps private bodies out of exports and never promotes partial coverage to final.
Errors, missing final usage and stopped batches remain ineligible under both policies.

Invalid inputs or execution setup failures return `kind: "skillfit.eval-error"`,
`status: "error"`, an error code/message and ineligible acceptance. Exit status 2
signals invalid/failed request execution or a stopped request run. Exit status 0
means a JSON assessment was produced, including a read-only stopped-run report;
it does **not** mean adoption was accepted. Callers must inspect acceptance fields.

## Adoption policy

The [measurement protocol](metrics.md#shared-adoption-gates) owns the shared
eligibility/rejection gates and their scope. This section owns policy fields and
configuration. Adoption is separate from the statistical verdict and introduces
no equivalence or non-inferiority test. The result returns:

- `reject` when observed pass, score or named-check regressions exist, the overall
  verdict is negative, or measured per-success costs exceed a declared limit.
  Paired named-check/score regressions remain rejection reasons even when task
  averages improve or cancel them.
- `inconclusive` when adoption requirements remain unmet and no rejection applies.
  This status cannot authorize an upgrade.
- `accept` only when all requirements below pass. This is advisory eligibility on
  the recorded tasks and environment, with `automaticUpgrade: false`.

Policy version 1 defaults to `minTasks: 8`, `minTrialsPerTask: 5`,
`minDeltaPassRate: 0` and zero permitted increases for `uncachedInput`, `output`
and `durationSeconds`. Scale/gain requirements may be raised; the scale floor and
evidence gates cannot be waived. A positive `effective` verdict is still required
when the minimum gain is zero. Injected executors record `synthetic: true` and
remain ineligible even if their descriptor claims to be a CLI.

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

`minUncachedInputReductionFraction` defaults to `0.1` (range 0.01–1), and
`minImprovedTaskFraction` defaults to `0.75` (range 0.75–1). `costs.efficiency`
records the point, interval, per-task changes, fixed protocol and unavailable-evidence
reason. The [exact endpoint, bootstrap and acceptance rules](metrics.md#explicit-efficiency-acceptance-policy-version-2-since-090)
belong to the measurement contract; no task is discarded to improve the estimate.

Version 2 extends `maxCostIncreaseFraction` with `input` and `cachedInput`;
all five defaults permit no per-success increase. Declare any allowed tradeoffs
explicitly. For example, `durationSeconds: 0.25` permits at most 25% more elapsed
time; keeping the other ceilings at zero permits no token-partition or output
increase. Previewing a request makes zero model calls. Cost savings
remain scoped to recorded token usage, not a complete dollar bill. Missing
usage, synthetic runs, visible regressions and post-hoc policy changes cannot
authorize adoption under either objective. `automaticUpgrade` always stays false.

`purpose: "validation"` is a caller declaration, not proof of independence. Bench
authors must keep outcomes independent of the Skill and hold validation tasks
apart from development. Repeated candidate selection against the same validation
set can overfit it. Native hashes detect changes against the saved index; they are
not signatures or independent provider attestations. Use trusted bench definitions
and retain/share an external copy of evidence hashes for provenance.


Earlier source documentation: [fixed snapshot](https://github.com/remote-controlled-man/skillfit/blob/4ec83672b69799bc62613c381f6b12ba8f3f3068/docs/reference/eval-component.md).

## Positional CLI option summary

Generated from the CLI's help and option declarations. Request defaults remain
specified above; individual commands still validate their own combinations.
After editing CLI definitions, build and regenerate with
`node tools/verify/cli-reference.mjs --write`. Local tests reject drift.

<!-- cli-reference:start -->
| CLI option | Help description |
| --- | --- |
| `--agent <id>` | Target agent: claude-code \| codex \| kimi-code (default: all detected) |
| `--mode <mode>` | Eval mode: inject (default) \| installed (paired complete Skill) \| trigger (single arm) |
| `--baseline-skill <path>` | With --mode installed, compare a previous Skill version against the target |
| `--request <path>` | Version 1 Skill revision request (JSON output; excludes positional eval options) |
| `--plan-sha <hash>` | Confirm an eval/calibration/self-test dry-run plan (also needs --run-group) |
| `--json` | Machine output for bench check/self-test/list/show/edit/remove, report, eval and calibration |
| `--bench <path>` | Bench directory for eval (default: bundled benches) |
| `--task <id>` | With eval/calibration, select cases (repeatable, manifest order); requests use taskIds |
| `--trials <n>` | Repetitions per condition for eval (integer 1–20; default: 5) |
| `--max-calls <n>` | Call ceiling for eval / bench check --calibrate / bench add --decompose Also controls baseline calibration repetitions |
| `--pair-order <order>` | Paired eval: baseline-first (default) \| balanced |
| `--executor-timeout-seconds <n\|none>` | Eval/calibration/drafting: executor deadline (integer 1–3600; none requires Token-only budget) |
| `--spending-budget <file>` | Eval/calibration/drafting: input, cachedInput, uncachedInput, output, durationSeconds stop lines |
| `--runs-root <dir>` | Eval/calibration/drafting/self-test output parent (default: ./runs) |
| `--run-group <name>` | Fresh record group; reuse its name when confirming an eval preview |
| `--input <mode>` | Paired eval or baseline calibration: snapshot (default) \| workspace (CLI only) |
| `--replay` | With report eval, audit receipts and regrade cloned deliveries; never call a model |
| `--export <dir>` | With report eval, plan a portable package; --yes writes a fresh destination |
<!-- cli-reference:end -->
