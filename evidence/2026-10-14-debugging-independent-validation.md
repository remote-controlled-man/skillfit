# Independent debugging Skill validation

The original debugging Skill and compact v4 both pass **40/40 executions** on
eight previously frozen p-map and quick-lru defects. No paired pass, score or
named-check regression is observed. V4 uses 16.82% less uncached input per
successful execution, but the predeclared adoption decision is **inconclusive**:
the 95% task-bootstrap interval does not establish the required reduction of
at least 10%. `eligibleForUpgrade` and `automaticUpgrade` remain false.

This is a completed independent revision comparison, separate from development,
known regression controls and the interrupted first validation invocation. It
supports lower measured spending on this task mix, without meeting the frozen
adoption threshold or demonstrating better correctness.

## Frozen comparison

Five adjacent pairs per task use balanced order, with 20 pairs starting in each
arm. All 80 planned CLI invocations finish, with final public usage and complete
receipts; there are no replacements, extra trials, execution errors, timeout or
timing anomalies. AC power and temporary idle/system sleep assertions remain
active through execution and are released afterward. The run lasts from
2026-10-13 14:33 UTC to 20:57 UTC; this report is dated 2026-10-14 in Shanghai.

| Input | SHA-256 |
| --- | --- |
| Complete original Skill | `3cf6b2fea38acbdebfbaca564f7a2f10cd7d12dfcad0442756a6842db96eccc1` |
| Complete compact v4 Skill | `db5e96d06d52f3c1fbfe4a10b12c999c6191dc6a42f889e074931730ff6eafa9` |
| Eight-task outcome bench | `dd774e3b789892104ce50ddf9577cdddb981f80187c6d57cd14981e032df5cfd` |
| Frozen compiled evaluator | `78e6a65d7b165067baa4c05bbd737a25d191c4b3c1a663caa6bf86f4181bcd91` |
| Version-2 efficiency policy | `e6c0610daccd82f4fa326fb2660ae9f6dc722e1544f1caa006b4143de3da4a5e` |
| Native plan | `4e22bddb4c6dba079c1c6db140ffde0dc7c8a0e9df0b3c97ed9570cbb3431502` |
| Native manifest | `ed49864396147a0f818eb9fd6fa6142a02f5a75ee1771d03689f1e280651ee97` |

The [study declaration](../docs/plans/2026-10-13-skill-evolution.md) preserves both
the original quality objective and the efficiency objective accepted before
validation. The candidate, bench, graders, five trials and symmetric
1200-second deadlines remain unchanged after the diagnosed first interruption.
The final candidate is v4 of the compact revision family; earlier v2/v3 results
remain separate.

## Correctness and spending

Each task passes 5/5 executions in both arms, with all six checks passing on
every delivery. Scores remain 1.0. There are zero discordant pairs, McNemar
`p=1`, and zero pass/score differences. The unchanged quality verdict remains
`inconclusive`. Saturated baseline success does not establish equivalence or
a correctness improvement.

All-invocation and paired spending coincide in this completed cohort. Both
arms have 40 successful executions, so total and per-success relative changes
are identical. All five cost dimensions have 40 final observations per arm.

| Measure | Original total | V4 total | Change |
| --- | ---: | ---: | ---: |
| Input tokens | 12,396,403 | 9,141,803 | −26.25% |
| Cached input tokens | 10,834,432 | 7,842,560 | −27.61% |
| Uncached input tokens | 1,561,971 | 1,299,243 | −16.82% |
| Output tokens | 367,775 | 306,579 | −16.64% |
| Executor seconds | 12,560.034 | 10,364.976 | −17.48% |

The primary measure is all-invocation uncached input per successful execution:
39,049.275 tokens for the original and 32,481.075 for v4. The frozen
10,000-resample bootstrap retains both arms and all trials within each whole
task block, with seed 20261013. Its relative-change interval is
**[−26.2564%, −7.6886%]**. The upper bound exceeds the frozen −10% threshold;
the recorded reason is `EFFICIENCY_REDUCTION_UNPROVEN`. Seven of eight tasks
reduce the primary measure, satisfying the separate 75% breadth gate. Other
cost caps and all evidence/non-regression gates pass. The threshold stays fixed.

| Task | Uncached input change | Output change | Executor time change |
| --- | ---: | ---: | ---: |
| mapper-index | −21.70% | −10.86% | −10.88% |
| async-concurrency | −33.50% | −34.13% | −35.93% |
| consumer-stop | −20.84% | −32.26% | −30.57% |
| source-close | −5.35% | −0.96% | −6.27% |
| source-error | −14.22% | −28.78% | −28.99% |
| cold-thenable | −2.34% | −7.19% | −3.95% |
| ttl-refresh | −36.48% | **+0.78%** | −1.05% |
| ttl-duration | **+1.53%** | −15.30% | −16.73% |

These exceptions remain visible even though aggregate spending falls. The
[known controls](2026-10-13-debugging-controls-and-sleep-stop.md) also retain
normalize-url increases of 0.96% uncached input and 15.25% output, which reject
its cost policy. LRU's aggregate uncached input falls 11.13%, while its
fetch-lifecycle task increases 6.29% and its task interval crosses zero. The
onInsert checks pass, but these controls cannot support a general cost claim.

## Additional study costs

The initial study finishes at **125 actual CLI invocations**, within its
128-call ceiling: 26 development, 16 known controls, two readiness, one
interrupted validation invocation and these 80 completed validation calls.
Counts cover task/readiness executor calls. CLI version queries and offline
checks make no model call and remain separate orchestration overhead. Quality
observations from these different cohorts are never pooled.

| Measure | Previous 45 calls, known lower bound | New 80 calls, final usage | Study known lower bound |
| --- | ---: | ---: | ---: |
| Input tokens | 12,939,815 | 21,538,206 | 34,478,021 |
| Cached input tokens | 11,509,632 | 18,676,992 | 30,186,624 |
| Uncached input tokens | 1,430,183 | 2,861,214 | 4,291,397 |
| Output tokens | 364,807 | 674,354 | 1,039,161 |
| Executor seconds | 16,394.615 | 22,925.010 | 39,319.625 |

Four earlier final usages remain missing; their retained partial counters are
lower bounds. Preparation, evidence replay and package checks make zero model
calls. This accounts for all declared CLI spending, including unsuccessful and
readiness calls, without assigning zero to missing usage. CLI counters do not
provide dollar billing, provider-internal retries or a complete candidate
authoring/orchestration bill. Separate platform task-budget snapshots are
included with unknown input/cache/output partitions and unknown overlap with
CLI counters; they must not be added to CLI tokens or converted into dollars.

## Environment and scope

Recorded configuration is Node v24.21.0, codex-cli 0.162.0-alpha.17.2,
`gpt-6.1-sol`, `xhigh`, default service tier and workspace-write sandbox. The
served model is not independently attested. Inherited agent configuration is
not isolated. All 80 public traces contain the same inherited
`local_thread_store_compression` startup warning; it is a CLI experimental
feature warning, not an execution failure. Global configuration is unchanged.
The public events contain no collaboration events or detected additional model
CLI/API commands; that observation does not attest provider billing.

The task mix covers eight JavaScript mapping/cache defects in two repositories.
It measures installed Skill revision effects, without a no-Skill baseline or
negative routing cases. Related defects and repositories limit generalization.
Fresh executions reproduce the procedure, not identical stochastic outcomes.
Any candidate changed using these now-public validation results needs a fresh
independent task set and a new bounded declaration. This cohort receives no
extra samples or relaxed policy, and v4 remains ineligible under its declaration.

## Offline and live reproduction

The [offline archive and instructions](artifacts/2026-10-14-debugging-independent-validation/README.md)
pin 1,620 packaged files and reproduce all 80 delivery grades, paired/all-call
spending, quality statistics and the efficiency interval without a model call.
Frozen statistical, efficiency and timing checks pass 23/23. Earlier spending
arithmetic comes from the linked [development stops](2026-10-13-debugging-development-stops.md),
[completed development](2026-10-13-debugging-completed-development.md) and
[controls/interruption](2026-10-13-debugging-controls-and-sleep-stop.md) archives.
Their 1,564 published files remain byte-for-byte unchanged.

The current source checkout passes all 497 offline tests. All six contributed
bench gates and the driver/v3/v4 Skill validators pass; the dedicated existing
Python environment supplies PyYAML without changing global environments or
adding a project runtime dependency. English/Chinese README code blocks match.

For a fresh procedural reproduction from the source checkout, build it and
preview the [exact v4 request example](../docs/examples/eval-request.diagnosing-v4-efficiency.json):

```bash
npm ci
npm run build
node dist/cli.js bench check benches/contrib/oss-skill-validation
node dist/cli.js eval --request docs/examples/eval-request.diagnosing-v4-efficiency.json --dry-run
node dist/cli.js eval --request docs/examples/eval-request.diagnosing-v4-efficiency.json --plan-sha <SHA_FROM_PREVIEW>
```

The final command spends 80 model calls and requires a working agent environment.
Use an unused run group; an existing group is rejected even during preview. Keep
AC power and the lid open. The component binds the preview before execution and
returns the original statistical verdict and separate adoption decision. The
example is a procedural reproduction of public tasks, not fresh independent
validation for a later candidate. Interfaces are available in the source
checkout; no npm registry release is asserted.
