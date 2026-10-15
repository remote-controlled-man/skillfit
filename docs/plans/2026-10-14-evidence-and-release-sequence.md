# Ordered delivery: evidence, release preparation, then bounded experiments

This plan follows the user's instruction to finish work one item at a time.
The current live-call budget is zero: the previously authorized four-call
development pilot is exhausted. The acceptance policy stays unchanged.

| Order / window | Work | Completion evidence | Next gate |
| --- | --- | --- | --- |
| 1 — Completed October 14 | Publish the rejected reading pilot, RTK count correction and cost review as a new append-only report/archive | Fresh extraction regrades four deliveries and checks numeric arithmetic; older published files remain unchanged | Finish before release preparation |
| 2 — Completed October 15 | Restore npm authentication, publish the reviewed 0.9.0 package, smoke an isolated registry install and mirror documentation | 513 offline tests, exact package integrity, 2,330 installed files and registry-installed CLI pass; [public receipt](../releases/0.9.0-verification.json) retained | New model-call budget remains zero |
| 2a — Completed October 15 | Verify the first 0.9.1 CLI/OIDC publication | [Verified receipt](../releases/0.9.1-verification.json): exact archive, 2,333 installed files, CLI smoke, registry signature and source attestation; both deadline failures retained | Original workflow remains failed; one upload, independent recovery, zero model calls |
| 3 — Prepared October 15, no live execution | [Fixed four-call mechanism proposal](2026-10-15-native-diff-mechanism.md) and offline input preparer | Identical helper/environment in both arms, complete existing Skills, one reused development task, full cost coverage and explicit stop rules; no automatic expansion | Live budget remains zero; a fresh user-approved budget is required before any call |
| 4 — Only after a useful mechanism survives item 3 | Declare a new independent Skill revision validation, using tasks not used for candidate selection | Correctness regressions, failures and all invocation costs retained; frozen conservative efficiency criterion met | Insufficient evidence cannot authorize adoption; no automatic upgrade |

Windows are an order of work, not a promise of future unattended execution.
No timer, monitor or automatic live experiment is created by this plan.

## Current evidence and decisions

The [reading pilot and cost review](../../evidence/2026-10-14-debugging-reading-pilot-and-cost-review.md)
records four passing deliveries but higher cost and a rejected v5-reading
candidate. V5.1 restores batching and changes only one sentence; it remains
uninstalled and unvalidated. The common native diff tool is an environment
repair, supplied identically in both arms, not evidence that a Skill improved.

The latest cumulative ledger has 178 actual executor invocations and seven
earlier missing public final usages. New documentation, archive replay, build,
package smoke and unit tests add zero real model calls. Provider billing and
complete authoring/orchestration costs remain unknown.

Before item 3, the design must distinguish tool delivery from actual adoption,
and observed recovery-response usage from counterfactual net savings. The
19 earlier recovery traces do not establish 19 avoidable provider requests.
Their 12 dedicated recovery responses represent about 0.84% of completed v4
uncached input in those reviewed cohorts, so this fix alone is not a basis
for predicting or claiming a stable 10% reduction. No new 80-call cohort is
scheduled merely to complete a sample count.
