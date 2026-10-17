# Shared evaluation planning (source after npm 0.10.1)

Ordinary paired/trigger `eval` and version-1 paired Agent requests share reviewed
planning. Baseline calibration has a separate typed plan with the same budget,
deadline and output controls in 0.11.0. npm 0.10.1 does not include these
additions. Existing revision requests remain valid.

## Settings and baselines

| Ordinary paired eval | Agent request field | Meaning |
| --- | --- | --- |
| Target path | `candidateSkill` | Candidate complete Skill in installed mode |
| `--baseline-skill <path>` | `baselineSkill: "./skill-old"` | Previous complete Skill, same frontmatter name and different content |
| Omit `--baseline-skill` with `--mode installed` | `baselineSkill: null` | No Skill installed by the harness in baseline; complete candidate only in treatment |
| `--bench <path>` / repeated `--task <id>` | `bench` / `taskIds` | Frozen bench and selected cases in bench order |
| `--trials <n>` / `--max-calls <n>` | `trials` / `maxCalls` | Fixed repetitions and call ceiling; reject undersized ceilings before calls |
| `--pair-order baseline-first\|balanced` | `pairOrder` | Default `baseline-first`; `balanced` alternates first arm by task/trial |
| `--executor-timeout-seconds <n>` | `executorTimeoutSeconds` | Integer 1–3600, deadline per executor invocation |
| `--spending-budget <file>` | `spendingBudget` | Optional five absolute batch stop lines |
| `--runs-root <dir>` / `--run-group <fresh-name>` | `runsRoot` / `runGroup` | Output parent and fresh group; existing groups cannot be overwritten |

Requests always use installed workspace delivery without judges. `baselineSkill`
is **required**: explicit null selects no-Skill; a missing, empty or invalid value
is an error. Existing string paths still select revision comparison. The two arms
receive identical natural task prompts. “No Skill” describes harness delivery;
inherited global Skills, rules and plugins still apply. Check the agent profile
before interpreting installation benefit. Ordinary inject, rules and MCP plans
retain their existing delivery semantics.

CLI agents and requests default to 600 seconds; API execution preserves its
120-second default. New paired plans and native records state the effective
deadline, including defaults. An explicit deadline is applied to the API too.
The effective deadline also applies to an enabled ordinary-eval judge; each
invocation has its own timer. Historical records
without deadline metadata remain unrecorded. Changed timeouts need a fresh
preview/batch; earlier timeouts and partial usage remain evidence.

## Preview and confirm

Save this illustrative `budget.json`; choose actual limits for your authorized
task before running. These numbers are stop lines, not estimated usage or prices:

```json
{
  "input": 100000,
  "cachedInput": 100000,
  "uncachedInput": 100000,
  "output": 10000,
  "durationSeconds": 1200
}
```

Preview a two-call no-Skill comparison without verifiers, model calls or writes:

```bash
node dist/cli.js eval ./skill-new --mode installed --bench ./my-bench --task my-task --agent codex --trials 1 --max-calls 2 --pair-order balanced --executor-timeout-seconds 300 --spending-budget ./budget.json --runs-root ./runs --run-group no-skill-001 --json --dry-run
```

Read `plan.sha256`, then execute the same command with `--dry-run` removed and
`--plan-sha <plan.sha256>` added **only with spending authorization**. Ordinary
JSON execution requires the hash and explicit `--run-group`. Human previews
print the same hash and support the same confirmation, while existing human
execution without `--json` may still run without a hash. Dry run never executes.
Agent requests retain their required preview-hash confirmation.

`plan.evaluation.agentPreflight` reports the [offline Agent environment checks](eval-agent-preflight.md).
Preview can return `planned` with a `blocked` environment; live execution rejects
known failures before case probes or calls. CLI resolution and check results are
bound into the plan hash and rechecked after case probes. Login remains unknown.

`plan.evaluation` has the same effective settings for equivalent installed
comparisons through either entry point. Request plans additionally bind request
bytes, purpose and acceptance policy, so their hashes differ from ordinary plans.
Use the hash from the same entry point; changes to settings, input fingerprints,
executor identity or compiled implementation invalidate confirmation. Preview
declares offline case preflight and input snapshots pending; execution performs
both before dispatch.

Version 0.12.0 checks output layout during preview and again at session
setup. Keep `--runs-root` outside the bench, candidate/baseline Skill or config
experiment, compiled runtime and `.git` metadata. A directory alias cannot bypass
this check. Use sibling input/output directories; invalid layouts fail before
verifiers, model calls or run creation. Git-root benches are supported: bench
hashing and sealed snapshots both exclude Git metadata while retaining task bytes.

Budget files are parsed into fixed numeric limits before planning. Those values,
rather than the source file's path/format, are bound to the hash and sealed in
the native plan. Editing the file before a new invocation changes the plan when
the limits change; editing it during a run cannot adjust the running limits.
Reports, export and offline replay need no original budget file. Request files,
including inline limits/policy, retain their before/after-call byte guards.

## Baseline calibration and trigger plans

These source commands also support repeated `--task`, `--max-calls`,
`--spending-budget`, `--executor-timeout-seconds`, `--runs-root`, `--run-group`,
`--json --dry-run` and exact `--plan-sha` confirmation:

```bash
node dist/cli.js bench check ./my-bench --calibrate --agent codex --task my-task --input workspace --trials 1 --max-calls 1 --spending-budget ./budget.json --executor-timeout-seconds 300 --runs-root ./runs --run-group calibration-001 --json --dry-run
node dist/cli.js eval ./my-skill --mode trigger --bench ./my-bench --agent codex --task positive-task --task negative-task --trials 1 --max-calls 2 --spending-budget ./budget.json --executor-timeout-seconds 300 --runs-root ./runs --run-group trigger-001 --json --dry-run
```

Use actual registered IDs. Calibration defaults to two trials per task and runs
one no-Skill baseline arm. Trigger defaults to five trials, presents on-disk
files without `--input`, and runs only selected tasks with a `shouldTrigger`
label. Unlabeled tasks are skipped; a plan with no eligible calls fails.
Include negative controls to measure false-trigger rate. Neither mode accepts
`--pair-order`; trigger does not use a judge or a revision baseline.

Calibration preview returns `kind: "skillfit.calibration-result"`, `status:
"planned"`, with a `skillfit.calibration-plan` in `plan`. Confirm its
`plan.planSha256`. Trigger uses the ordinary `skillfit.eval-result` preview and
`plan.sha256`; `plan.evaluation.mode` is `trigger`. Both JSON execution paths
require an explicit `--run-group` from the preview. Keep every effective setting
the same, remove `--dry-run` and add the correct `--plan-sha`. A generated plan
does not authorize spending or prove a ready environment.

Calibration preview executes no verifier/oracle. Live calibration performs the
offline case gates before native setup or calls; any hard failure blocks it.
Missing oracle/coverage evidence is `UNKNOWN`, separate from nonblocking `WARN`
items such as large fixtures. Its Agent environment is checked before and after
the probes, just as in eval. Checks and the reviewed plan are sealed; stopped
calibration keeps every declared task, including tasks not reached.

Read either mode through `report eval <run-dir> [--json]`. Calibration reports
baseline difficulty; trigger reports recall, false-trigger rate and detection
coverage. New sealed native runs support `--replay` and
`report eval <run-dir> --export <fresh-dir>` without another model call. Replay
regrades saved deliveries; it does not obtain new trigger observations or prove
independent validation. Single-arm reports reject paired `--policy`/`--records`
overrides and never authorize adoption. See [report types](evaluation-reports.md)
and [portable packages](replay-packages.md) for historical/runtime limits.

## Stop rules and results

All five budget fields are required when supplied. Token lines are positive safe
integers; seconds are positive finite numbers. Limits count all invoked primary
agent and enabled judge spending, including failures and excluded partners. Reaching any line stops
the next call; one in-flight call can overshoot. Missing/partial/invalid final
usage or an execution/guard error stops further calls and retains known/unknown
spending. There are no retries, replacements or automatic expansion. The same
guard covers calibration and trigger invocations. New judge receipts preserve
both scoring orders and their usage; reports separate primary Agent, judge and
combined `invocationCosts`. Historical missing judge costs remain unknown, never
zero. An enabled API judge without credentials is an error before spending;
login validity still cannot be confirmed offline. See [cost accounting](eval-costs.md).

Version 0.12.0 adds a preflight `USAGE_CAPABILITY` check: a CLI adapter
known to lack one of the required token counters cannot start a budgeted batch,
whether it is the primary executor, a judge or baseline calibration. Normal Codex
eval/judge commands use the existing matrix JSON surface to retain these counters.
API/injected coverage remains unknown until a response; the runtime guards remain
necessary and never replace missing cache evidence with zero.

Ordinary `--json` returns the same `skillfit.eval-result` envelope and English
error reasons as requests, with diagnostics on stderr. Ordinary native runs seal
the reviewed plan and audit it against actual parameters; both entries retain
receipts, complete cost coverage and [portable replay](evaluation-input-snapshots.md).
JSON validation errors exit 2; stopped runs exit 2, or 130/143 for SIGINT/SIGTERM.
Plans and stopped prefixes cannot authorize adoption.

No-Skill results report improvements, regressions and costs, but retain
`REVISION_COMPARISON_REQUIRED` and `eligibleForUpgrade: false` under the existing
revision adoption policy. Ordinary runs also lack predeclared component policy
binding. Neither entry upgrades a Skill. The [acceptance contract](eval-component.md)
and [statistical protocol](metrics.md) are unchanged.
