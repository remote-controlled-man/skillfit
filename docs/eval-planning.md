# Shared evaluation planning (source after npm 0.10.1)

Ordinary paired `eval` and version-1 Agent requests use one plan generator and
the same execution engine. Build the current source to use the ordinary JSON
preview, budget/deadline flags and explicit no-Skill request baseline; npm
0.10.1 does not include these additions. Existing revision requests remain valid.

## Settings and baselines

| Ordinary paired eval | Agent request field | Meaning |
| --- | --- | --- |
| Target path | `candidateSkill` | Candidate complete Skill in installed mode |
| `--baseline-skill <path>` | `baselineSkill: "./skill-old"` | Previous complete Skill, same frontmatter name and different content |
| Omit `--baseline-skill` with `--mode installed` | `baselineSkill: null` | No Skill installed by the harness in baseline; complete candidate only in treatment |
| `--bench <path>` / repeated `--task <id>` | `bench` / `taskIds` | Frozen bench and selected cases in bench order |
| `--trials <n>` / `--max-calls <n>` | `trials` / `maxCalls` | Fixed repetitions and call ceiling; reject undersized ceilings before calls |
| `--pair-order baseline-first\|balanced` | `pairOrder` | Default `baseline-first`; `balanced` alternates first arm by task/trial |
| `--executor-timeout-seconds <n>` | `executorTimeoutSeconds` | Integer 1–3600, primary executor deadline in both arms |
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
This setting does not change a judge's separate deadline. Historical records
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

Budget files are parsed into fixed numeric limits before planning. Those values,
rather than the source file's path/format, are bound to the hash and sealed in
the native plan. Editing the file before a new invocation changes the plan when
the limits change; editing it during a run cannot adjust the running limits.
Reports, export and offline replay need no original budget file. Request files,
including inline limits/policy, retain their before/after-call byte guards.

## Stop rules and results

All five budget fields are required when supplied. Token lines are positive safe
integers; seconds are positive finite numbers. Limits count all invoked primary
agent spending, including failures and excluded partners. Reaching any line stops
the next call; one in-flight call can overshoot. Missing/partial/invalid final
usage or an execution/guard error stops further calls and retains known/unknown
spending. There are no retries, replacements or automatic expansion. Judges and
trigger runs reject spending limits because their accounting is outside this
guard. Trigger keeps its existing human dry-run path; reviewed/JSON plans and
explicit paired deadlines/order apply only to paired eval.

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
