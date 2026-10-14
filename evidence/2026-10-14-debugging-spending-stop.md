# Debugging evaluation stopped for a spending review

The separately declared recovery cohort is interrupted at the user's request
after **one executor invocation**. Its 79 remaining entries are never invoked,
there are no completed deliveries or graded pairs, and the decision remains
**inconclusive and ineligible**. No Skill is upgraded. The stop is an explicit
spending decision, not evidence of a Skill correctness regression.

The [routing-interrupted cohort](2026-10-14-debugging-followup-routing-stop.md),
its failed invocation and original 205-call ceiling remain unchanged. A subsequent
one-call readiness check returned `READY`, bringing cumulative spending to 173.
The [separate recovery declaration](../docs/plans/2026-10-14-skill-followup-restart.md)
prospectively allowed a fresh 80-call cohort and a 253-call ceiling; it did not
resume, replace or pool the earlier samples. The user's later stop overrides
further execution. Actual cumulative spending is **174 calls**, not 253.

## Retained execution and costs

Only the original arm of `promise-falsy-rejection`, trial 1, is invoked. The
owned CLI receives `SIGTERM`; the harness records an execution error and stops.
It runs for 148.981 seconds, with partial input 105,055, cached input 86,528,
uncached input 18,527 and output 1,802 tokens. These are lower bounds, not final
usage or a completed outcome. AC power stays active and the owned temporary
sleep assertions are released. No additional executor call is launched by the
stop, offline replay or documentation work.

The preceding readiness call lasted 28.971 seconds. Its ordinary CLI receipt
returned `READY` but has unknown final token usage. A unique local rollout was
matched by workspace, time interval and exact readiness prompt and yielded a
numeric supplement: input 16,477, cached input 13,184, uncached input 3,293 and
output 5. There is no public thread identity attestation, so this supplement
does not change the unknown native receipt or authorize adoption. Private
rollout bodies are not exported; their original matching cannot be independently
attested from the public numeric supplement alone.

| Measure | Cumulative native known lower bound | Separate unattested readiness supplement | Lower bound with that supplement |
| --- | ---: | ---: | ---: |
| Input tokens | 45,621,511 | 16,477 | 45,637,988 |
| Cached input tokens | 39,880,960 | 13,184 | 39,894,144 |
| Uncached input tokens | 5,740,551 | 3,293 | 5,743,844 |
| Output tokens | 1,357,212 | 5 | 1,357,217 |
| Executor seconds | 48,307.701 | Already counted in native elapsed time | 48,307.701 |

Seven public final usages remain missing. Unknown usage is never assigned a
zero cost. Previous cohorts supply cost arithmetic only; their quality samples
are not pooled. A separate platform task-counter snapshot is retained with
unknown input/cache/output partitions and unknown overlap with CLI counters.
It is not added to CLI tokens. Provider billing, internal requests and the
complete authoring/orchestration bill remain unmeasured.

## Scope and reproducibility

The complete original/v4 resources, eight task inputs, graders and frozen 10%
policy are unchanged. The compiled runtime hash is
`da640a88b07b7daa6621c0e17007b4c929927e7c10801d6fc3dfdb40b7f27509`;
the original terminal manifest hash is
`0617ea0b50b2aa693a4941e4fc3a764567cd81966d6e77f1021268001b637ec5`.
Recorded Node/CLI versions and requested model settings remain those in the
recovery declaration; the served model is unattested. The exported package is
a normalized derivative of audited native records, not an unchanged native seal.

The [offline archive](artifacts/2026-10-14-debugging-spending-stop/README.md)
pins 1,506 files and reproduces the retained receipt audit, zero complete grades,
paired/all-invocation populations, unavailable efficiency interval, unchanged
adoption decision and both cumulative cost presentations. Fresh extraction and
the frozen 23 statistical, efficiency and timing checks pass without model calls.
All 1,570 previously published evidence files remain byte-identical.

Existing trajectory review shows task-dependent process savings, not a proven
universal mechanism. A local complete reading-scope candidate has only structural
validation; its performance is unproven and it is not installed or promoted.
A four-call development proposal is previewed but unexecuted pending the user's
spending choice. It cannot establish stable independent improvement and does
not permit automatic expansion. The [completed independent result](2026-10-14-debugging-independent-validation.md)
still supports measured savings on its task mix while remaining ineligible at
the unchanged conservative 10% bound. The full original delivery goal remains
incomplete; this spending stop is not a completion claim.
