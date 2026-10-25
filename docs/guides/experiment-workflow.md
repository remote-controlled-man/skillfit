# Evaluation workflow

Start with an offline-valid case and a specific claim. Use
[first evaluation](first-real-eval.md), [bench authoring](bench-authoring.md),
[claims](../reference/bench-claims.md) and the [component contract](../reference/eval-component.md).
Current source includes unpublished schema 2/self-test behavior beyond npm 0.13.1.

## Plan before spending

```bash
node dist/cli.js eval skills/skillfit --bench code-review --agent codex --dry-run
```

Preview is read-only: no run directory, verifier/oracle/judge/model dispatch or
new login probe. Review selected tasks, input mode, target delivery, trials,
agent/judge descriptors, timeouts, call ceilings, available counters and paths.
JSON/request execution binds the reviewed digest and run group. Text CLI keeps
its existing confirmation behavior; a supplied digest still must match. Do not
assume that all low-level calls independently enforce the CLI's authorization.

Input, environment, policy/context and implementation changes require a fresh
preview. Execution rechecks them and runs hard offline gates before spending.
Outputs must be fresh, outside inputs/configuration and non-overlapping; they
cannot overwrite earlier stopped or completed runs.

## Targets and inputs

Injection compares a prompt overlay; installed mode delivers the complete Skill
bundle into disposable per-condition workspace/configuration layouts. Revision
comparisons use distinct baseline/treatment targets. Rules and MCP overlays use
[configuration experiments](config-experiments.md). Agent paths/capabilities come
from the matrix rather than inferred directory conventions.

Workspace input gives the agent real on-disk files. Inline snapshots and trigger
observation have different capabilities. Calibration performs baseline trials
with its own planSha256 and case gates; it is not a paired Skill verdict.
Self-test executes fixed known controls with zero real model calls and explicitly
refuses adoption; see [self-test](bench-self-test.md).

## Preflight

Case preflight is offline and reports ready/blocked plus failures, warnings and
unknowns. Broken fixtures, graders, oracle, protected files or changed inputs
block before model calls. NOP must fail and the reference repair must pass;
infrastructure errors are not task failures. Difficulty/saturation warnings do
not establish live difficulty or automatically invalidate efficiency claims.

Agent preflight checks available CLI/matrix surfaces and configuration conflicts
without invoking the agent or proving login. Authentication remains unknown.
Recorded preflight is validated as saved metadata; reports do not rescan today's
machine to invent historical authentication or identity.

## Current source capability table

Reviewed 2026-10-22 against the [matrix](https://github.com/remote-controlled-man/skillfit/blob/main/src/matrix/agents.json),
[preflight counter declarations](https://github.com/remote-controlled-man/skillfit/blob/main/src/agents/preflight.ts),
[CLI reader](https://github.com/remote-controlled-man/skillfit/blob/main/src/agents/adapters/cli.ts), [API reader](https://github.com/remote-controlled-man/skillfit/blob/main/src/agents/adapters/api.ts)
and [model-identity reader](https://github.com/remote-controlled-man/skillfit/blob/main/src/agents/observation/model-identity.ts). This table describes
skillfit's adapters, not the full capabilities of vendor products. The current
checkout includes unpublished numerical, trigger, model-identity, self-test and
bench-claim changes; npm 0.13.1 and its immutable
release record do not attest these additions. Commands pinned to 0.13.1 in the
onboarding guides retain their released meaning. Build the current checkout to
exercise the source additions below.

| Executor / delivery modes | Trigger observation | Token/cache reader | Strict five-field spendingBudget | CLI version / public reported model | Verification scope |
| --- | --- | --- | --- | --- | --- |
| Codex CLI: paired inject/installed, rules/MCP overlays, calibration, trigger; optional judge/drafter | Literal read command against registered `SKILL.md` paths, not a native Skill event | Per-turn input, cached input, output; uncached input by subtraction; failed-call recovery stays partial | Adapter has the required readers; every actual call still needs complete final usage, including an enabled judge | Matrix `--version` probe during execution preparation; allowlisted configured model only, reported model unrecorded | Current factory, parser, guards and replay exercised offline; PATH presence/fixtures do not attest installed-version flags or login |
| Kimi Code CLI: same modes | Exact designated `Skill` argument in flat tool-call events | Input/output from matched local session usage; no cached-input partition | Blocked before calls: cachedInput unavailable | Matrix `--version` probe; no confirmed public model reader, reported model unrecorded | Offline factory/parser fixtures; current real CLI/authentication not verified in this remediation |
| Claude Code CLI: same modes | Exact registered directory/frontmatter Skill identity in content-block events; stream-json entrance connected | No token reader implemented | Blocked before calls: input, cachedInput and output unavailable | Matrix `--version` probe; public assistant `message.model` IDs and source lines retained | Entry point tested with Node-only fake subprocesses, including failures and portable replay; real CLI/authentication unverified |
| Chat Completions API: paired inject/snapshot; optional judge/drafter | No native trigger or installed/workspace/config-overlay delivery | Response input/output and explicit cached tokens; absent/invalid fields remain unknown | UNKNOWN offline; permitted to start, then missing/partial final counters stop further calls | No CLI version; configured/requested model and response `/model` recorded separately | Injected HTTP responses and offline replay; no provider/network validation |

Trigger is single-arm; calibration is baseline-only. Judges are optional in
ordinary paired eval, not trigger/calibration or request-component execution.
Drafting is its own authoring record, not an evaluation report kind. Installed
and workspace delivery require a CLI executor. Elapsed time is measured by the
harness for all executors and is not provider billing/compute time.
CLI version capture covers the selected primary Agent and separate drafter;
there is no separate judge CLI version probe. A missing/failed probe stays
unrecorded and never substitutes for a reported model ID.

An absent `spendingBudget` remains allowed. If present, **all five fields are
mandatory**; there is no duration-only or partially specified budget. Both the
primary and optional judge must satisfy capability checks. Codex is the only
current CLI adapter with all required token readers; this does not guarantee
final coverage in any particular invocation. Replanning without the strict
budget does not make unknown costs known or authorize spending. See
[stop rules](#stops-sealing-and-reproduction).

New `modelIdentity` v1 retains configured/requested intent separately from
reported IDs. Multiple IDs and unknown coverage remain visible per role/call.
Public response IDs are declarations, not backend attestation or a full subagent
inventory. The frozen plan's legacy `servedModel: "unrecorded"` is not backfilled;
portable replay uses saved bytes, never today's CLI/configuration. See
[model identity contract](../reference/metrics.md#public-model-identity-per-invocation) and
[report fields](../reference/evaluation-reports.md).
All adapters leave sampling unpinned; current requests send no temperature/seed.



## Budgets and timing

CLI/request executor deadlines default to 600 seconds; API execution defaults
to 120 seconds. An explicit `--executor-timeout-seconds` is an integer 1–3600
and also applies to an enabled ordinary-eval judge, with a separate timer per
invocation. `--pair-order` defaults to `baseline-first`; `balanced` alternates
first arm by task/trial. Requests require `baselineSkill` explicitly: null
means no harness-installed baseline Skill; a revision uses distinct complete
versions with the same frontmatter name. Inherited configuration still applies.

An illustrative budget file contains exactly these fields. Token limits are
positive safe integers; seconds must be positive and finite, no greater than
Number.MAX_SAFE_INTEGER. Choose actual stop lines before authorizing spending:

```json
{
  "input": 100000,
  "cachedInput": 100000,
  "uncachedInput": 100000,
  "output": 10000,
  "durationSeconds": 1200
}
```

Preview one selected task and two calls (replace paths and registered task ID):

```bash
node dist/cli.js eval ./skill-new --mode installed --bench ./my-bench --task my-task --agent codex --trials 1 --max-calls 2 --pair-order balanced --executor-timeout-seconds 300 --spending-budget ./budget.json --runs-root ./runs --run-group no-skill-001 --json --dry-run
```

With spending authorized, remove --dry-run and add --plan-sha with the returned
plan.sha256. Keep the same explicit run group and settings. Calibration instead
uses plan.planSha256. Numeric budget values bind the plan; editing their file
cannot adjust an active run. Reports/replay need no original budget file.

Five-field spendingBudget remains required when supplied: input, cachedInput,
uncachedInput, output and durationSeconds. Strict enforcement depends on the
adapter's actual counters; absent fields stay unknown and must not be filled
with zero. Call ceilings include actual attempted agent/judge/drafter calls;
pre-dispatch refusal is distinct from invoked failure. No automatic retry or
provider upgrade is hidden in the workflow.

Wall timestamps identify events; monotonic timing measures elapsed intervals.
Executor deadlines, verifier deadlines and recorded durations are distinct.
Preserve partial/failure usage and attempt costs even when grading fails.
[Metrics](../reference/metrics.md) defines populations, paired exclusions and adoption limits.

## Stops, sealing and reproduction

Inputs and runtime are fingerprinted/sealed; replay uses retained bytes, not a
replacement from today's checkout. Configuration guards preserve the original
agent setup and stop on unexpected changes. SIGINT/SIGTERM retain stopped-prefix
accounting and terminate verifier/agent descendants; an abrupt kill can still
leave incomplete evidence. Completed accounting is not an efficacy claim.

Use [reports and replay](../reference/evaluation-reports.md) to audit saved output, costs and
identity. Saved missing identity/usage/claims remain unknown. Keep interrupted,
rejected and negative results; do not pool cohorts or silently reinterpret old
schemas through current code. Historical model calls are never repeated merely
to verify archive integrity.

Previous source documentation: [fixed snapshot](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/experiment-workflow.md).
