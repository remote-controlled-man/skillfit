# Ordered delivery: evidence, release preparation, then bounded experiments

This plan follows the user's instruction to finish work one item at a time.
The current remaining live-call budget is zero: the newly authorized four-call
mechanism probe completed and stopped at four. The acceptance policy stays unchanged.

| Order / window | Work | Completion evidence | Next gate |
| --- | --- | --- | --- |
| 1 — Completed October 14 | Publish the rejected reading pilot, RTK count correction and cost review as a new append-only report/archive | Fresh extraction regrades four deliveries and checks numeric arithmetic; older published files remain unchanged | Finish before release preparation |
| 2 — Completed October 15 | Restore npm authentication, publish the reviewed 0.9.0 package, smoke an isolated registry install and mirror documentation | 513 offline tests, exact package integrity, 2,330 installed files and registry-installed CLI pass; [public receipt](../releases/0.9.0-verification.json) retained | New model-call budget remains zero |
| 2a — Completed October 15 | Verify the first 0.9.1 CLI/OIDC publication | [Verified receipt](../releases/0.9.1-verification.json): exact archive, 2,333 installed files, CLI smoke, registry signature and source attestation; both deadline failures retained | Original workflow remains failed; one upload, independent recovery, zero model calls |
| 3 — Completed October 15, exactly four live calls | Execute the [fixed mechanism proposal](2026-10-15-native-diff-mechanism.md) under fresh authorization | [Report and offline archive](../../evidence/2026-10-15-native-diff-mechanism.md): both arms pass 2/2, helper use 4/4, five patch displays, all paired cost measures lower; no extra calls | Development signal only; inconclusive acceptance, remaining live budget zero |
| 4 — Awaiting decision after item 3 | Review whether to declare a new independent Skill revision validation, using tasks not used for candidate selection | Require a frozen candidate, unused tasks, explicit spending envelope, correctness checks and complete failure/cost retention before execution | Separate user decision and fresh budget required; insufficient evidence cannot authorize adoption; no automatic upgrade |

Windows are an order of work, not a promise of future unattended execution.
No timer, monitor or automatic live experiment is created by this plan.

## Current evidence and decisions

The [reading pilot and cost review](../../evidence/2026-10-14-debugging-reading-pilot-and-cost-review.md)
records four passing deliveries but higher cost and a rejected v5-reading
candidate. V5.1 restores batching and changes only one sentence; it remains
uninstalled and unvalidated. The common native diff tool is an environment
repair, supplied identically in both arms, not evidence that a Skill improved.

The latest cumulative ledger has 182 actual executor invocations and seven
earlier missing public final usages. New documentation, archive replay, build,
package smoke and unit tests add zero real model calls. Provider billing and
complete authoring/orchestration costs remain unknown.

Item 3 distinguishes tool delivery from actual adoption, and observed
recovery-response usage from counterfactual net savings. The
19 earlier recovery traces do not establish 19 avoidable provider requests.
Their 12 dedicated recovery responses represent about 0.84% of completed v4
uncached input in those reviewed cohorts, so this fix alone is not a basis
for predicting or claiming a stable 10% reduction. No new 80-call cohort is
scheduled merely to complete a sample count.

The completed mechanism probe observes real helper use in 4/4 runs and favorable
old/new Skill costs under the same repaired environment. It supports reviewing
an independent-comparison proposal, not automatic execution. The task is reused,
both arms receive the helper, and four common CLI startup warnings remain visible.
There is no stable-improvement or causal helper-savings claim, no candidate
promotion and no independent cohort started.
