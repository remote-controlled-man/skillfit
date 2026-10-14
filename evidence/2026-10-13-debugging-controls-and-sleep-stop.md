# Debugging v4 controls: mixed costs and an interrupted validation batch

**Known lru-cache and normalize-url controls show no observed correctness
regression, but costs improve in one cohort and regress in the other. The first
independent validation batch stops after forced sleep, with no graded result.
This record does not establish stable improvement or authorize promotion.**

## Frozen comparison and known controls

All three cohorts compare the complete original `diagnosing-bugs` Skill with
compact v4. These are instruction revisions, not model versions. The original
fingerprint is `3cf6b2fea38acbdebfbaca564f7a2f10cd7d12dfcad0442756a6842db96eccc1`;
v4 is `db5e96d06d52f3c1fbfe4a10b12c999c6191dc6a42f889e074931730ff6eafa9`.
The candidate was chosen using the separate
[development evidence](2026-10-13-debugging-completed-development.md).

Each cohort declares balanced adjacent pairs, a 1200-second deadline in both
arms and the same explicit efficiency policy. The recorded configuration is
`gpt-6.1-sol`, `xhigh`, `default`, `codex-cli 0.162.0-alpha.17.2`, Node
`v24.21.0`. Server-side model identity remains unattested and sampling unpinned.
The frozen compiled runner SHA-256 is
`78e6a65d7b165067baa4c05bbd737a25d191c4b3c1a663caa6bf86f4181bcd91`.
Its partial-counter recovery adds evidence without converting failed executions
to successful or final-usage samples.

| Cohort | Tasks / pairs per task | Planned / invoked / settled | Successful original / v4 deliveries |
|---|---:|---:|---:|
| Known lru-cache controls | 3 / 2 | 12 / 12 / 12 | 6/6 / 6/6 |
| Known normalize-url control | 1 / 2 | 4 / 4 / 4 | 2/2 / 2/2 |
| Independent p-map/quick-lru validation 1 | 8 / 5 | 80 / 1 / 1 | No graded deliveries |

The known controls were used previously, so they are development evidence,
not fresh holdouts. Every completed delivery passes all named checks. Both v4
lifecycle deliveries preserve the `onInsert` application-value behavior. There
are zero improved or regressed pass pairs, scores or named checks in either
control cohort. Both statistical quality verdicts remain `inconclusive`, with
McNemar p = 1; saturated results do not establish equivalence.

## Costs: retain the normalize-url regression

All 16 control invocations have final recorded usage. Each arm has the same
number of successes within its cohort, so total and per-success changes agree.

| Metric | LRU original / v4 total | v4 change | normalize-url original / v4 total | v4 change |
|---|---:|---:|---:|---:|
| Input | 2,480,612 / 1,955,737 | −21.2% | 571,174 / 556,685 | −2.5% |
| Cached input | 2,224,640 / 1,728,256 | −22.3% | 493,696 / 478,464 | −3.1% |
| Uncached input | 255,972 / 227,481 | **−11.1%** | 77,478 / 78,221 | **+1.0%** |
| Output | 61,431 / 59,568 | −3.0% | 19,697 / 22,701 | **+15.3%** |
| Executor seconds | 2244.510 / 2097.976 | −6.5% | 689.316 / 751.960 | **+9.1%** |

The LRU efficiency decision is `inconclusive`: point savings do not satisfy the
declared independent eight-task, five-pair scale and confidence requirements.
The normalize-url decision is **`reject`**, including increased per-success
uncached input and output. No thresholds are relaxed. A future result on the
new mapping/cache task mix cannot erase this known exception or support a
general cost-saving claim. The predeclared control gate concerns observed
correctness regression; it allowed independent validation to start while
preserving these cost increases.

## Validation 1: diagnosed environment interruption

The first original-arm `mapper-index` invocation starts at
`2026-10-13T10:58:38.935Z`. The candidate makes zero calls. At `11:03:46Z`, macOS
records `Clamshell Sleep` while using battery, despite still-active temporary
idle/system sleep assertions. At `11:19:12Z`, a dark wake permits the observer
to detect a 924,882 ms gap. The execution stops with a timing-anomaly error;
the deadline callback has not fired. The retained interval is 1233.430 seconds,
including the sleep gap, and is unsuitable as normal model latency.

This is an environment interruption, not a model-capacity error or a normal
1200-second timeout. The five-second anomaly tolerance stays unchanged. Temporary
assertions are released afterward; no global sleep setting is changed.

Only one of 80 calls is invoked; 79 remain explicitly not invoked. Native audit
passes. Offline replay grades zero deliveries and keeps the stopped status.
The last matched cumulative counter at `11:02:06.101Z` records **102,392 input,
78,720 cached input, 23,672 uncached input and 1,886 output**. Its thread/time
match and record hash are retained in the receipt. Usage is **partial**, not
final billing; private session bodies are not distributed. No paired comparison
or successful-task denominator exists.

The eight validation defects, candidate, verifiers, policy, order and deadline
stay unchanged. No incomplete delivery is graded or used to optimize the Skill.
After the user confirms continuous AC power and an open lid, a new fixed 80-call
batch is declared with a fresh run group. It requires AC power before its first
model call and verified temporary idle/system assertions. Its preview SHA-256 is
`4e22bddb4c6dba079c1c6db140ffde0dc7c8a0e9df0b3c97ed9570cbb3431502`.
The failed invocation is retained separately, never resumed, discarded or pooled
into that new batch. This page does not assert the new batch's result.

## Additional spending and reproduction

These controls and the interrupted invocation add **17 CLI executions** and
known lower bounds of 5,666,600 input, 5,003,776 cached input, 662,824 uncached
input, 165,283 output and **7017.192 recorded executor seconds**. Sixteen usages
are final and one is partial. Summing study spending only with the previously
published development/readiness ledger yields 45 executions, 12,939,815 input,
11,509,632 cached input, 1,430,183 uncached input, 364,807 output and 16394.615
seconds. Four final usages are missing. These are lower bounds, not pooled
quality evidence or complete dollar, authoring or orchestration costs.

The fresh batch adds at most 80 executions: the new planned study total is 125,
within the original ceiling of 128. There are no extra readiness checks,
within-batch retries, replacement samples or outcome-driven optional trials.

The [compressed offline package](artifacts/2026-10-13-debugging-controls-and-sleep-stop/README.md)
contains complete control deliveries and Skills, stopped receipts and uninvoked
placeholders, public transcripts, plans, ledgers, exact benches and licenses,
full frozen source/compiled runners and selected sleep events. Paths are
normalized, reasoning items and unrelated personal power-event details excluded.
Each phase distinguishes original/export hashes; the derived export does not
claim an unchanged native seal or upgrade eligibility.

Fresh extraction verifies 2,211 package hashes, identically regrades all 16
completed deliveries, preserves zero grades for the interrupted invocation,
and recomputes each cohort's quality statistics and paired/all-invocation costs.
It also reproduces the separate additional/study-spending arithmetic with zero
new model calls. Frozen statistical, efficiency and timing checks pass 23/23;
the full current component suite passes 497/497. Earlier published evidence
remains byte-for-byte unchanged. Fresh model executions reproduce the method,
not identical stochastic outcomes or costs. Automatic upgrades remain disabled.
