# Evaluation cost accounting

Paired `eval` runs record descriptive agent costs in `tasks[].costs` and
`overall.costs` (cost schema 1, optional additions to manifest schema 4). The
terminal summary and `report eval <manifest.json>` show the same cost tables.
Reading a report makes no model call and does not change the manifest or verdict.

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

These are observed costs on the declared tasks, without a cost confidence
interval or significance verdict. They are not a billing estimate. Input,
cache-read input, output and elapsed time remain separate; there is no blended
price or guessed dollar amount. All quality verdicts, pair exclusions, McNemar
tests and paired-bootstrap confidence intervals remain governed by the
[metrics protocol](metrics.md).
