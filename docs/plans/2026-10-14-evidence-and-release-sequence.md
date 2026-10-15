# Ordered delivery: evidence, release preparation, then bounded experiments

This plan follows the user's instruction to finish work one item at a time.
The current remaining live-call budget is zero. The four-call mechanism probe
completed; the subsequently authorized independent comparison stopped after
12/80 on a correctness regression. A separately authorized two-call receiver
probe then stopped after its first failed candidate; its control was not run.
Unexecuted calls are not an automatic new budget. The acceptance policy stays unchanged.

| Order / window | Work | Completion evidence | Next gate |
| --- | --- | --- | --- |
| 1 — Completed October 14 | Publish the rejected reading pilot, RTK count correction and cost review as a new append-only report/archive | Fresh extraction regrades four deliveries and checks numeric arithmetic; older published files remain unchanged | Finish before release preparation |
| 2 — Completed October 15 | Restore npm authentication, publish the reviewed 0.9.0 package, smoke an isolated registry install and mirror documentation | 513 offline tests, exact package integrity, 2,330 installed files and registry-installed CLI pass; [public receipt](../releases/0.9.0-verification.json) retained | New model-call budget remains zero |
| 2a — Completed October 15 | Verify the first 0.9.1 CLI/OIDC publication | [Verified receipt](../releases/0.9.1-verification.json): exact archive, 2,333 installed files, CLI smoke, registry signature and source attestation; both deadline failures retained | Original workflow remains failed; one upload, independent recovery, zero model calls |
| 3 — Completed October 15, exactly four live calls | Execute the [fixed mechanism proposal](2026-10-15-native-diff-mechanism.md) under fresh authorization | [Report and offline archive](../../evidence/2026-10-15-native-diff-mechanism.md): both arms pass 2/2, helper use 4/4, five patch displays, all paired cost measures lower; no extra calls | Development signal only; inconclusive acceptance, remaining live budget zero |
| 4 — Offline preparation completed October 15; no live authorization | Review the [independent comparison proposal](2026-10-15-independent-comparison-proposal.md): eight unused source defects, unchanged original/v4, at most 80 calls | [Offline record](../../evidence/2026-10-15-independent-offline-readiness.md): all eight originals reproduce failure with the same regression, complete maintainer fixes pass 6/6; 20 budget and 13 integrity checks pass; 130-call forecast unchanged | Remaining live budget is zero; separate user decision, current environment checks and fresh frozen execution preview required; no automatic calls or upgrade |
| 4a — Executed and stopped October 15 under explicit authorization | Execute the fixed order within the original 80-call cap, keeping the one completed call after a power stop and user pause | [Regression-stop evidence](../../evidence/2026-10-15-independent-comparison-regression-stop.md): 1 retained + 11 continuation calls, all 12 offline regrades and final usages; original 6/6 versus v4 3/6 on task two, 68 unexecuted calls | Adoption rejected; no retry, replacement, expansion, automatic upgrade or resumed spending; review the retained failure before further decisions |

| 4b — Executed and stopped October 15 under separate authorization | Run the frozen receiver mechanism probe, candidate first, at most two calls | [Receiver-stop evidence](../../evidence/2026-10-15-receiver-mechanism-stop.md): one call, known wrong production repair, 4/6 functional groups and 8/18 probes; control never started; offline replay and full usage retained | Candidate failed; cohort closed, no retry or reuse of its uninvoked slot |

Windows are an order of work, not a promise of future unattended execution.
No timer, monitor or automatic live experiment is created by this plan.

## Current evidence and decisions

The [reading pilot and cost review](../../evidence/2026-10-14-debugging-reading-pilot-and-cost-review.md)
records four passing deliveries but higher cost and a rejected v5-reading
candidate. V5.1 restores batching and changes only one sentence; it remains
uninstalled and unvalidated. The common native diff tool is an environment
repair, supplied identically in both arms, not evidence that a Skill improved.

The latest cumulative ledger has 195 actual executor invocations and seven
earlier missing public final usages. New documentation, archive replay, build,
package smoke and unit tests add zero real model calls. Provider billing and
complete authoring/orchestration costs remain unknown.

The completed mechanism probe observes helper use in 4/4 runs and favorable
paired costs on one reused development task. Both versions receive the helper;
there is no stable-improvement or causal helper-savings claim. Its historical
readiness and independent-comparison decisions are recorded in the table above.

The subsequently authorized independent comparison retains one invocation from
the first segment and eleven from continuation, in separate sealed native
sessions. The second task exposes a correctness regression, so the queue stops
at 12/80. All twelve final usages and delivery grades replay offline; the
remaining 68 calls are unexecuted. This is not a completed native-component audit.

The separately authorized receiver probe then fails its functional gate after
one call. Its new tests still pass against the known wrong repair, so no
production improvement is established. Both cohorts are closed and no unused
slot can be reused. The [current product roadmap](../growth-roadmap-2026-10.md)
prioritizes task-specific case authoring and CLI usability. No further Skill
optimization or model call is scheduled.
