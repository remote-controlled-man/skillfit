# Independent original/v4 comparison: stopped on a correctness regression

The fixed comparison stopped after **12 of at most 80 executor invocations**.
On `timeout-custom-timers`, original passed **6/6** checks while compact v4
passed **3/6**. This violates the predeclared no-observed-regression gate, so
adoption is **rejected**. No retry, replacement, extra trial, task substitution
or automatic expansion occurred. The remaining 68 calls were not executed.
Neither Skill was changed or installed globally.

All twelve deliveries and their final usage counters reproduce offline from the
[archive and verification receipt](artifacts/2026-10-15-independent-comparison-regression-stop/README.md).
This is an early-stopped, interrupted comparison, not a completed independent
validation or proof of a general statistically significant quality decline.
The original eight-task selection and [acceptance proposal](../docs/plans/2026-10-15-independent-comparison-proposal.md)
remain unchanged; the [offline original/maintainer gates](2026-10-15-independent-offline-readiness.md)
preceded these model outcomes.

## Observed quality and stopping

| Declared task | Completed pairs | Original successful calls | v4 successful calls | Outcome |
| --- | ---: | ---: | ---: | --- |
| limit-async-context | 5 | 5/5 | 5/5 | Every delivery passes 6/6; observed quality tie |
| timeout-custom-timers | 1 | 1/1 | 0/1 | Original 6/6, v4 3/6; stop before call 13 |
| throttle-sync-throw | 0 | Not run | Not run | No outcome or cost observation |
| commander-output-isolation | 0 | Not run | Not run | No outcome or cost observation |
| limit-map-iteration-rejection | 0 | Not run | Not run | No outcome or cost observation |
| timeout-rejection-listener | 0 | Not run | Not run | No outcome or cost observation |
| timeout-infinity-abort | 0 | Not run | Not run | No outcome or cost observation |
| commander-async-listener-order | 0 | Not run | Not run | No outcome or cost observation |

The failed v4 delivery retains ordinary smoke behavior, timeout/fallback behavior
and ordinary settlement identity. It fails scheduling and clearing with unbound
custom timer functions, and its submitted regression does not distinguish the
original and complete maintainer repair as required. The corresponding original
Skill delivery passes all three of those checks. The failed v4 invocation has
complete final usage and no executor error; it remains a graded failure and its
spending is included.

The code difference explains the failure: v4 uses
`customTimers.setTimeout.call(globalThis, ...)` and the same binding for
`clearTimeout`. The original Skill delivery uses `.call(undefined, ...)`, which
preserves the unbound-call behavior of the full maintainer repair. The fixed
verifiers were not changed or weakened after observing either delivery.

An additional **offline explanation**, outside the scored task set, exercises
ordinary timer functions defined in another JavaScript global environment using
Node's built-in `vm`. The original source and v4 delivery reject; the maintainer
repair and original Skill delivery fulfill and clear their handles. This shows
an observable compatibility difference beyond matching a source-code spelling.
Its script and exact outcomes are included in the archive and its replay.
It adds zero model calls, zero scored tasks and no extra statistical sample.

## All invocation spending

There are six actual calls per arm. Original succeeds six times, v4 five times.
All twelve have final total input, cache partition, output and monotonic elapsed
coverage; no current-batch usage is missing, partial or replaced with zero.

| Cost | Original total | v4 total | v4 total change | Change per successful execution |
| --- | ---: | ---: | ---: | ---: |
| Input tokens | 1,507,061 | 1,106,379 | −26.59% | −11.90% |
| Cached input tokens | 1,337,216 | 946,304 | −29.23% | −15.08% |
| Uncached input tokens | 169,845 | 160,075 | −5.75% | **+13.10%** |
| Output tokens | 47,904 | 37,206 | −22.33% | −6.80% |
| Agent duration, seconds | 1,379.036 | 1,046.047 | −24.15% | −8.98% |

The primary metric includes the failed call's spending. Original uncached input
per success is 28,307.5 tokens; v4 is 32,015 tokens. Lower raw token totals do
not establish a lower cost of successfully completing work.

On `limit-async-context` alone, v4 input falls 29.90%, output 23.80% and duration
26.65%, while **uncached input rises 8.01%** (125,775 → 135,854 tokens). It is
not a demonstrated primary-cost improvement. The single failed v4 call on
`timeout-custom-timers` costs 197,021 input tokens, including 172,800 cached and
24,221 uncached, 5,912 output tokens and 184.285 seconds. That task has no v4
success, so its v4 cost-per-success comparison is undefined, not a saving.

The eight-task task-block efficiency interval is unavailable: six tasks never
started, one has only one pair and no v4 success. No old quality observations
are pooled into this prefix, and no confidence claim is manufactured from it.
The archive lists every call, task, check, cost population and paired gap.

## Pause, continuation and accounting boundaries

The first segment started on AC with the lid open. The operating system later
reported battery power; the owned guard latched that condition and blocked a
second dispatch after the first original delivery finished. The user then asked
to pause. The initial session, source bytes, power records and its one complete
receipt remain unchanged.

After the user returned on AC with the lid open and explicitly asked to continue
within the original 80-call cap, the continuation executed only original queue
positions 2 onward. It did **not** replay position 1 or reset its spending. Its
11 offline queue checks covered exact suffix order, all five carried budget
lines, no duplicated prefix, partial usage, paired regression and pre-call errors.
The continuation reuses the **unchanged frozen `runTrial`, built-in CLI executor
and native `ExperimentSession`**, with an explicit 79-new-call maximum.

The existing request component cannot overwrite a stopped group or skip a saved
call. Consequently these remain **two separately sealed native sessions** with
an explicit private continuation schedule; no completed native component
manifest is fabricated. Both segment seals, recorded configuration/global-Skill
fingerprints, all delivery outcomes, order and cumulative budgets were audited.
The first pair crosses an 86-minute user pause (5,183.925 seconds between its
calls), so cache/time differences in that pair are particularly confounded.
The composite does not pass a complete native component audit and cannot
authorize adoption; the observed paired regression independently rejects it.

Configuration remains `gpt-6.1-sol` / `xhigh` / `default`, CLI
`0.162.0-alpha.17.2`, Node `v24.21.0`. The configured model name is not served-model
attestation. Unlisted inherited plugins, provider state and sampling remain
unisolated under the original limitations. Complete Skill, bench and runtime
hashes remain the ones pinned before the first call.

The five original stop lines were never reached. Final combined spending is
2,613,440 input tokens (2,283,520 cached + 329,920 uncached), 85,110 output
tokens and 2,425.083 seconds of agent time. The stop reason is paired correctness
regression, not a token line, timeout or execution failure. No continuation power
anomaly was observed. Both segments released their owned sleep assertions.

Agent duration totals about 40.42 minutes. Segment wall times are 258.834 and
2,175.409 seconds; wall time from initial launch to final stop is 7,616.902
seconds and includes the user pause. Those clocks include agent time and must
not be added to it as extra latency.

The study ledger rises from 182 to **194 actual executor invocations**. The
seven earlier missing public final usages remain unknown; no new missing final
usage is added. The native historical lower bound is now 50,254,565 input,
43,946,752 cached, 6,307,813 uncached, 1,485,062 output tokens and 51,944.802
seconds. The earlier qualified, unattested readiness supplement remains separate.
Provider billing, hidden retries and complete authoring/orchestration costs are
unknown; this report does not invent a dollar bill.

## Offline reproduction

The archive is a privacy-normalized derivative, with an exported file index and
source/export SHA-256 provenance. It retains both native ledgers, original seal
metadata, all twelve deliveries/tests and final usage traces, the complete bench,
both Skills, frozen implementation, source, plans, guards and power evidence.
Private path prefixes are replaced by equal-byte placeholders, private global
inventory names are omitted, and reasoning items are filtered when present.
The exported index verifies derivative bytes; it does not claim that normalization
preserves the unchanged original native seal or proves provider billing.

Extract the [archive](artifacts/2026-10-15-independent-comparison-regression-stop/package.tar.gz)
into a new directory and run `node replay.mjs`. No dependency installation,
network, model or agent CLI is needed. Replay verifies all 12 final usage traces,
regrades all 12 deliveries, reconstructs six pairs and all cost changes, carries
the initial call into every budget snapshot, checks the 80-call order/cap and
cumulative ledger, and repeats the receiver diagnostic. Expected result includes
`totalCalls: 12`, `newCalls: 11`, `regraded: 12`, `decision: "reject"`,
`automaticUpgrade: false`, `modelCalls: 0`.

The project-required offline test run passes **556 tests, zero failures or
skips**; the continuation's eleven offline queue guards also pass. No product
runtime change or dependency was introduced for this execution. All 1,582
previously published evidence files match their prelaunch fingerprints.

Eight offline original/maintainer gates, source hashes and the acceptance policy
are unchanged. This stop is evidence that the evaluator rejects a real candidate
regression while retaining its spending, not evidence that skill evolution always
improves results. No new experiment or automatic upgrade follows this record.
