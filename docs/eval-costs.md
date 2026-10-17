# Evaluation cost accounting

Paired `eval` runs record descriptive agent costs in `tasks[].costs` and
`overall.costs` (cost schema 1, optional additions to manifest schema 4). The
terminal summary and `report eval <manifest.json>` show the same cost tables.
Reading a report makes no model call and does not change the manifest or verdict.

Version 0.11.0 exposes the same paired spending guard through ordinary
`--spending-budget <file>` and request `spendingBudget`. The five limits and
effective primary executor deadline are visible in the shared plan and sealed
for offline replay; the source budget file is unnecessary after execution.
Limits stop between calls and can overshoot in flight. Version 0.11.0 also
applies the guard to calibration, trigger runs and both judge orders; judge
calls count against the same run-wide limits. These are operational limits, separate from relative
adoption ceilings or a provider invoice. See [shared planning](eval-planning.md).

## Two populations

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

## All executor roles (source after npm 0.10.1)

New paired manifests and JSON reports add `invocationCosts`, independently of
the unchanged primary Agent's `overall.costs`. It contains `agent`, `judge` and
`total` populations and `judgeUsage: recorded | unknown | not-requested`;
see the [schema](schemas/invocation-costs.schema.json). Each population retains
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
pair as an execution error; see [execution timing](eval-timing.md).

## Cache and coverage

Source after npm 0.11.0 reads matrix-defined JSON streams in ordinary CLI eval and
CLI judging too, independently of Skill-trigger detection. Codex inject, rules and
MCP comparisons can retain the same per-turn counters as installed/trigger mode.
Only assistant text is graded; raw stream evidence and partial failure counters
are retained separately. Ordinary parsing does not fabricate a trigger flag.
Offline `USAGE_CAPABILITY` checks block strict spending budgets when an adapter is
known to lack required counters, including an enabled judge. API and injected
executors retain unknown offline coverage; actual missing counters still stop
after an invocation, with no retry or guessed cache zeros. Historical receipts
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

## Failed API responses (source after npm 0.11.0)

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

## Spending per success

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

## Partial usage after a failed JSON CLI call

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
