# Timing repaired, normalize-url Skill revision comparison completed

The new independent-repository batch completed **two fresh pairs**: original
Skill 2/2 and unchanged compact v2 2/2, all four deliveries **8/8**. No named
check improved or regressed. Quality remains **inconclusive** (McNemar exact
p=1), without an equivalence, non-inferiority, broad improvement or installation
claim. Trials ran on October 12 UTC; this report is dated October 13 in the
author's Asia/Shanghai timezone.

V2 reduced observed total input **28.9%**, output **11.6%** and aggregate elapsed
time **3.6%**, while **uncached input increased 29.3%**, in both pairs. The first
pair also increased output and elapsed time. These are descriptive observations,
not dollar prices or stable latency effects. The previous stopped batches remain
unchanged and are not pooled into this comparison.

## What was diagnosed and repaired

1. **Host suspension:** relevant power logs show clamshell sleep during the old
   600-second deadline, followed by sleep-service wakes; its 2178.775-second
   wall receipt coincides with a later wake. The [diagnosis](2026-10-12-normalize-url-v2-recovery.md)
   preserves the exact earlier timeout receipt and filtered power events.
2. **Timing/termination:** new trial elapsed cost uses `performance.now()` and
   retains wall duration. CLI deadlines are checked at a one-second heartbeat,
   output arrival and process close; large observation gaps/clock discrepancies
   become environment errors. Process-tree termination and two-second pipe
   draining preserve captured public output/partial usage. The subsequent real
   connection timeout fired at 600001.623ms and terminated 11.403ms later,
   for a 600.019-second recorded trial, without a timing anomaly.
3. **Trust-path alias:** the CLI registered a canonical temporary path while the
   old guard declared its logical alias. Excluding only corresponding pure trust
   registrations exactly restored the frozen configuration hash. Plans now pin
   both names and their relationship; alias retargeting, unrelated directories
   and extra configuration settings remain errors. No general config exclusion
   was added.
4. **Upstream connection errors:** the [next stopped batch](2026-10-12-normalize-url-v2-comparison.md)
   received public 503/TLS reconnect errors before any task commands. Its token
   usage stays unknown. A ten-minute connection cooldown and one bounded
   readiness check were declared before further comparisons. An initial local
   readiness attempt lacked Git initialization and was retained as a preparation
   error; the corrected entry uses the existing Git/reflog routine. The new
   check returned READY in 24.618s with 16687 input/5 output tokens.

Temporary `caffeinate` assertions were verified, alive at finish and released;
the final batch recorded AC power. JavaScript cannot enforce deadlines while its
host is suspended, and these assertions do not guarantee execution across forced
sleep or lid closure. Neither monotonic nor wall duration establishes active
compute or billing time. See [the timing contract](../docs/eval-timing.md).

## Fixed comparison inputs

The [new declaration](plans/2026-10-12-normalize-url-v2-validated.json) specifies
one readiness invocation plus four native benchmark invocations, with no
retries/replacements inside the batch, no live calibration and no judge.
Baseline/treatment pairs run adjacently, baseline first. The readiness check is
never a graded task or a member of comparative cost populations.

| Input | Pin |
|---|---|
| Original complete diagnosing-bugs Skill | Matt Pocock commit `d81f3a183412e71a5b1e84ca21bc1a35eea03a60`; SHA-256 `3cf6b2fea38acbdebfbaca564f7a2f10cd7d12dfcad0442756a6842db96eccc1` |
| Unchanged compact v2 | SHA-256 `2df457fa462c9d2b082a26364d53047e5612e195099c90c818e597a274eaf0ba` |
| normalize-url bench | SHA-256 `73ebfa8b2e00513e991df75f9bafdccdaf333dd7517e23ae74604685cca157af` |
| Compiled timing/alias runner | SHA-256 `8cad13dd92a9a9095ec51b66bac7328c288e4d91919583016940c6c72eedac44` |
| Native plan | SHA-256 `9c9cf3c84b138ec81d7f8bc052550de596f89b01d9ea1adc1f11eba798b57dac` |

The same configured `gpt-6.1-sol / xhigh / default`, Codex CLI
`0.162.0-alpha.17.2`, Node `v24.21.0`, installed complete resources, workspace
delivery and **600-second** task timeout were retained. Served model identity
is unrecorded; sampling controls are unexposed. All four observed Skill-body
reads and installed resource hashes match their recorded arm.

The real repository is [sindresorhus/normalize-url's issue #193 fix](https://github.com/sindresorhus/normalize-url/commit/92eb7034f4c01c2075926a53261080a7fb2a93a7),
with pre-fix parent `0d866eb2fd3f96fba7dfbc2687cefe001cdc96ad`. Source/types,
metadata, README, upstream tests and MIT license retain their pinned blobs. The
task/grader were unchanged throughout recovery. This repository is independent
of the lru-cache development control; this repeatedly observed task is not a new
blinded holdout. V2 remains frozen from before its original repository selection.

## Observed quality and costs

Each arm passed both trials and all eight checks: protected assets/smoke, bare
path/flags, mixed/explicit-empty values, similar parameter names, sort/opt-out,
ordinary URL/fragment behavior, encoded backslashes/Unicode and a retained
submission-pass/original-fail/reference-pass regression case.

| Measure | Original total | V2 total | V2 change |
|---|---:|---:|---:|
| Input tokens | 714164 | 507671 | -28.9% |
| Cached input tokens, already included in input | 644352 | 417408 | -35.2% |
| Uncached input tokens | 69812 | 90263 | **+29.3%** |
| Output tokens | 18302 | 16180 | -11.6% |
| Monotonic elapsed seconds | 640.441 | 617.471 | -3.6% |

All comparative fields have final coverage 2/2 per arm. Paired and all-invocation
comparison populations are identical here because there are no errors. Per-success
ratios equal total ratios because each arm has two successes; failures' spending
would remain included under the frozen cost protocol.

| Pair | Original / V2 checks | Input | Uncached input | Output | Elapsed |
|---|---|---:|---:|---:|---:|
| 1 | 8/8 / 8/8 | -26.2% | **+28.5%** | **+15.9%** | **+36.5%** |
| 2 | 8/8 / 8/8 | -30.8% | **+29.9%** | -31.7% | -29.0% |

The uncached-input cost increase is visible in both pairs; aggregate output/time
reductions do not erase the first-pair increases. Cache-read tokens are a subset
of input, and uncached input may include cache creation. These fields do not
establish provider pricing or a blended monetary saving.

Baseline saturation, one historical bug, two pairs and baseline-first ordering
limit interpretation. Cache warming, host/provider latency and unisolated state
can affect costs. Quality bootstrap intervals collapse to [0,0] on these observed
samples, not zero future uncertainty. Mechanical reads do not prove instruction
use or causation. The original Skill remains the profile default.

## Extra recovery spending and preserved failures

There were **8 CLI executor invocations** during this recovery request: four
completed comparison runs, one successful readiness check, one trust-alias stop,
one connection timeout and one local readiness rejection. A CLI invocation does
not certify provider acceptance or billing; native CLI reconnects are not counted
as new harness invocations.

| Population | Invocations | Known input | Known output | Observed monotonic seconds |
|---|---:|---:|---:|---:|
| Completed comparison | 4 | 1221835 | 34482 | 1257.912 |
| Recovery/readiness outside comparison | 4 | >=341775 | >=10757 | 1025.294 |
| This entire recovery request | 8 | **>=1563610** | **>=45239** | 2283.206 |

Two outside-comparison receipts lack token usage; no exact full bill or usage
total is claimed. The accounting excludes earlier experiments, orchestration
chat, research/offline work, cooldown and Git preparation. It never pools stopped
quality samples or old wall-duration receipts with new monotonic speed ratios.

All earlier packages remain unchanged: original v1 revision evidence, original
v2 failures, the timing-only trust stop, provider timeout and local readiness
rejection. Their separate archives/receipts remain executable evidence of the
failed procedure, not discarded preparation.

## Reproduction and verification

The [complete package and commands](artifacts/2026-10-12-normalize-url-v2-validated/README.md)
include frozen source/compiled code, complete inputs, every delivered workspace,
receipts/public transcripts, ledgers, timing/power records, export hashes and
read-only analysis. Fresh extraction matches **all four** graded deliveries,
native cost aggregation and full analysis. Readiness message/usage also match
the public stream. The extra eight-invocation accounting independently replays
from retained archives and the readiness-rejection receipt.

Validation: **460 full offline project tests passed**, contributed bench checks
had **zero failures**, and **54 frozen timing/CLI/guard tests passed** from the
package. All final input, installed-copy and normalized configuration hashes
match. The remaining bench warning is missing negative trigger controls; this
study makes no trigger precision/recall claim. Fresh model execution reproduces
the procedure, not identical stochastic outputs, tokens or elapsed times. No
commit, PR, upstream write or global Skill replacement is included.
