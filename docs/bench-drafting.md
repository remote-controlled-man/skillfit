# Author a verifier with one recorded drafting call

Available in skillfit 0.12.0. Drafting helps author a case; it is not evidence that a Skill
improves results. It does not run a comparison or authorize an upgrade.

## Preview, then authorize

```bash
skillfit bench add ./my-bench --freeze --source-dir ./failure --include src --include test \
  --task real-failure --prompt-file issue.md --decompose --verifier-kind command --agent codex \
  --max-calls 1 --executor-timeout-seconds 300 --verifier-timeout-seconds 600 \
  --runs-root ./runs --run-group draft-real-failure --dry-run
```

Preview validates the selected files, destination paths, record-directory layout, one-call ceiling
and deadlines. It creates no files and invokes no agent. Re-run without `--dry-run` to confirm,
or with `--yes` to authorize. Declining also makes zero calls. A record group that already exists
is never overwritten, including failed/interrupted groups. There is no retry or follow-up call.

Git imports select tracked ordinary files; an empty/broken index fails. Non-Git sources require
explicit `--include` selections. Selected links, non-files and destination-bench files are rejected.
Inputs, prompts and public outputs can contain private data: review records before sharing them.

Optional `--spending-budget budget.json` uses the existing five-field spending contract:

```json
{
  "input": 100000,
  "cachedInput": 100000,
  "uncachedInput": 100000,
  "output": 10000,
  "durationSeconds": 300
}
```

The object is optional, but all five fields are mandatory when supplied. Token limits
are positive safe integers; seconds are positive finite numbers within the parser's
safe-number bound. Known unsupported CLI counters block before
dispatch. Missing/partial final counters or executor errors stop a budgeted draft after retaining
available usage, without adding a task. These are observed stop lines, not provider-side prepaid
caps: one in-flight call can exceed a line. Reaching a line with complete final usage prevents more
calls but still permits the remaining offline gates. The executor deadline bounds model execution,
separately from the case's verifier/oracle deadline. Cancellation cannot establish that a remote
provider stopped billing. Without a budget, absent counters remain unknown, never zero. Login
remains unknown offline. Injected test executors are responsible for honoring their own deadlines.

## Retained evidence

Each authorized draft claims a fresh record directory before dispatch:

| File | Meaning |
|---|---|
| `_plan.json` | `kind: skillfit.bench-draft-plan`, input hashes, executor, package/Node versions, deadlines/budgets, unknown authentication |
| `_inputs/fixture/`, `prompt.md` | Original selected bytes and exact drafting prompt |
| `workspace/` | Agent workspace, including generated verifier/oracle scripts when supplied |
| `_calls.jsonl` | Started/finished dispatch events; at most one call |
| `_result.json`, `_output.md`, optional `_transcript.jsonl` | Available public usage, final/partial/unknown status, duration, output and raw executor response; no request credential headers |
| `_budget.jsonl` | Before/after observations when a budget is set |
| `_gates.jsonl` | Untouched-fixture, oracle and solved-fixture results reached by this attempt |
| `_summary.json` | `kind: skillfit.bench-draft-result`; completed only after adding the task, otherwise stopped; observed costs/coverage, no automatic retry or upgrade |

`Ctrl+C` / `SIGTERM` stops the subprocess tree and seals available records as stopped. Interrupted
counters stay partial when that is all the executor can establish. Gates also observe cancellation;
an interrupted draft is not added. Force termination, machine or storage failure can prevent sealing.
A missing summary is not completion evidence.

## Recheck the case offline

After adding a task, `skillfit bench check ./my-bench --json` repeats the NOP/oracle gates without
an agent. For a rejected draft that supplied both scripts, copy `_inputs/fixture/` to two fresh
scratch directories. From the saved `workspace/`, run `node verifier.mjs <untouched-copy>`, then
`node oracle.mjs <solved-copy>` and `node verifier.mjs <solved-copy>`, each with the recorded
per-command deadline. Compare output and exit codes with `_gates.jsonl`. Preserve original records.

This reproduces the case checks and accounting from retained counters, not unreported provider
usage, undisclosed settings or an identical future generation. Authoring records have their own
kind; `report eval` remains for evaluation records.


## Model identity in authoring records

This section describes current-source additions, not published npm 0.13.1 behavior.
See [capabilities and verification scope](eval-agent-preflight.md#current-source-capability-table).

New `_result.json` receipts include `modelIdentity` v1 and `_summary.json` includes
`modelIdentities` v1 under the drafter role. The call's configured/requested intent
is separate from public response model IDs; source locations resolve in the
retained `_transcript.jsonl`, while unsupported/absent identity remains unrecorded.
`_runtime.json` records the matrix-defined CLI version probe at actual preparation
time; previews do not probe a CLI. Tests inject the version result. No private
configuration or credentials are scanned for model identity.

The shared [identity](schemas/model-identity.schema.json) and
[coverage](schemas/model-identities.schema.json) parsers validate these machine
records. They preserve failed and interrupted invocation evidence without a
retry or upgrade. Authoring records keep their existing distinct kind and local
case-recheck procedure; evaluation report/export/replay commands still operate on
evaluation records, rather than claiming that a draft is a paired evaluation.
