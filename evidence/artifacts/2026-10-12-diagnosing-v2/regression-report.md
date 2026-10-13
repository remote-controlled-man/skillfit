# skillfit evaluation: diagnosing-bugs

- Run: regression-v2-20261012 (2026-10-12T10:43:01.389Z)
- Target: skill; SHA-256 `2df457fa462c9d2b082a26364d53047e5612e195099c90c818e597a274eaf0ba`
- Baseline Skill: diagnosing-bugs (previous version); SHA-256 `3cf6b2fea38acbdebfbaca564f7a2f10cd7d12dfcad0442756a6842db96eccc1`
- Bench: oss-lru-cache-lifecycle-v2-regression (1 task); SHA-256 `e2fea611458e794a0a4d8b423e850fd400f1df0616e1b3ab83284f7cad78639d`
- Executor: cli / cli-configured
- Trials: 2 per condition
- Input: workspace
- Delivery: complete Skill installed in both conditions at .agents/skills
- Session: completed; 4/4 calls started, 4 finished; ceiling 4
- Frozen plan SHA-256: `f077d55f33650414e5b28b7fbf2b20abbb4722492a0f30b819546585f77726c5`

| Task | Baseline | Treatment | Errors B/T | Δpass | Verdict |
|---|---:|---:|---:|---:|---|
| fetch-lifecycle | 2/2 (100%) | 2/2 (100%) | 0/0 | 0.0pp | inconclusive |
| Overall | 2/2 (100%) | 2/2 (100%) | 0/0 | 0.0pp | inconclusive |

## Statistical readout

- Overall verdict: **inconclusive** — only 0 discordant pair(s) (Δpass 0pp); significance needs at least 6
- Discordant pairs: 0 improved, 0 regressed; McNemar exact p=1.0000
- Δpass 95% paired-bootstrap CI (2000 resamples): [0.0pp, 0.0pp]
- Observed Δpass CI half-width: ±0.0pp; not a validated minimum detectable effect.
- Δscore 95% paired-bootstrap CI (2000 resamples): [0.0pp, 0.0pp]
- The bootstrap interval collapsed on the observed tasks; this does not establish zero uncertainty or validated effect resolution.
- Scale: 1 task × 2 trials per condition; below the conclusive bar (8 tasks × 5 trials). Treat broader claims as indicative even if the within-bench verdict is statistically significant.
- Completed scale: 0 task(s) have at least 5 graded pairs after exclusions.

## Native Skill-read observations

| Task / arm | Read observed | Read unobserved | Unknown |
|---|---:|---:|---:|
| fetch-lifecycle / baseline | 2 | 0 | 0 |
| fetch-lifecycle / treatment | 2 | 0 | 0 |
| Overall / baseline | 2 | 0 | 0 |
| Overall / treatment | 2 | 0 | 0 |

Observed means a long-body read was detected. Unobserved means no body read was detected; the description may still have been in the catalog. Counts cover surviving graded pairs only. A read does not establish benefit. These are not trigger precision or recall.


## Checks and graded scores

| Task | Baseline mean check score | Treatment mean check score | Δscore |
|---|---:|---:|---:|
| fetch-lifecycle | 100.0% | 100.0% | 0.0pp |

### fetch-lifecycle

| Check | Baseline pass rate (graded observations) | Treatment pass rate (graded observations) |
|---|---:|---:|
| existing assets unchanged and smoke tests pass | 100.0% (n=2) | 100.0% (n=2) |
| ordinary LRU and successful async fetch | 100.0% (n=2) | 100.0% (n=2) |
| concurrent fetches deduplicate provider work | 100.0% (n=2) | 100.0% (n=2) |
| onInsert hides placeholder and classifies resolved application values | 100.0% (n=2) | 100.0% (n=2) |
| refresh eviction disposes stale value once in both callbacks | 100.0% (n=2) | 100.0% (n=2) |
| synchronous fetch result settles and is cached | 100.0% (n=2) | 100.0% (n=2) |
| own refresh completion does not abort the provider | 100.0% (n=2) | 100.0% (n=2) |
| explicit replacement still aborts refresh and retains replacement | 100.0% (n=2) | 100.0% (n=2) |
| new regression has submission-pass/original-fail/reference-pass test-case evidence | 100.0% (n=2) | 100.0% (n=2) |

## Installation decision and next steps

- No installation recommendation from this run. Inconclusive means insufficient evidence to distinguish benefit from variation; it does not mean ineffective.
- Scope: 1 evaluated task(s), this target hash and executor configuration. A single task does not establish general OSS contribution quality.
- No installation recommendation: this run is below 8 tasks × 5 graded pairs and is indicative. Freeze a varied task set and trial count before a separate validation run; do not keep adding trials until significance appears.
- Observed baseline saturation: fetch-lifecycle. Retain these as regression controls; add independent real failures to measure lift.
- Skill revision comparison: baseline contains the previous complete Skill and treatment contains the target version. Results describe revision effects, not installation benefit over no Skill. A positive delta does not guarantee non-regression on unseen tasks. Inspect per-run read observations and separate positive/negative trigger tests.
- Recorded token usage is shown below; it is not a billing estimate or a statistically established cost effect.

| Recorded token totals (field coverage) | Baseline | Treatment |
|---|---:|---:|
| Input | 1144946 (2/2 runs) | 889061 (2/2 runs) |
| Output | 22153 (2/2 runs) | 23437 (2/2 runs) |

## Cost accounting

Surviving graded pairs:
- Runs B/T: 2/2; successful tasks B/T: 2/2

| Measure | Baseline known total | Treatment known total | Total change | Per success B/T | Per-success change | Final/partial/unknown B/T |
|---|---:|---:|---:|---|---:|---|
| Input tokens | 1144946 | 889061 | -22.3% | 572473.000 / 444530.500 | -22.3% | 2/0/0 / 2/0/0 |
| Cached input tokens | 1047808 | 787200 | -24.9% | 523904.000 / 393600.000 | -24.9% | 2/0/0 / 2/0/0 |
| Uncached input tokens | 97138 | 101861 | +4.9% | 48569.000 / 50930.500 | +4.9% | 2/0/0 / 2/0/0 |
| Output tokens | 22153 | 23437 | +5.8% | 11076.500 / 11718.500 | +5.8% | 2/0/0 / 2/0/0 |
| Elapsed seconds | 953.985 | 812.588 | -14.8% | 476.993 / 406.294 | -14.8% | 2/0/0 / 2/0/0 |

All agent executor invocations (including failures and excluded partners):
- Runs B/T: 2/2; successful tasks B/T: 2/2

| Measure | Baseline known total | Treatment known total | Total change | Per success B/T | Per-success change | Final/partial/unknown B/T |
|---|---:|---:|---:|---|---:|---|
| Input tokens | 1144946 | 889061 | -22.3% | 572473.000 / 444530.500 | -22.3% | 2/0/0 / 2/0/0 |
| Cached input tokens | 1047808 | 787200 | -24.9% | 523904.000 / 393600.000 | -24.9% | 2/0/0 / 2/0/0 |
| Uncached input tokens | 97138 | 101861 | +4.9% | 48569.000 / 50930.500 | +4.9% | 2/0/0 / 2/0/0 |
| Output tokens | 22153 | 23437 | +5.8% | 11076.500 / 11718.500 | +5.8% | 2/0/0 / 2/0/0 |
| Elapsed seconds | 953.985 | 812.588 | -14.8% | 476.993 / 406.294 | -14.8% | 2/0/0 / 2/0/0 |

- Not invoked B/T: 0/0 (guard/setup refusals; excluded from spending totals).
- Cached input is included in input. Uncached input = input - cached input; unrecorded cache usage is unknown, never zero.
- Per success = all spending in that population / successful tasks, including graded failures. >= marks a known lower bound; incomplete usage suppresses changes.
- Descriptive agent usage and elapsed time only; no billing estimate, cost significance claim, or judge usage included.

## Warnings

- Installed Skill mode measures task outcomes with native discovery and complete resources; activation is not guaranteed. Inherited agent configuration still applies.
- Skill revision comparison measures the target against the previous version, not against no Skill. A positive delta does not establish installation benefit or guarantee non-regression on unseen tasks.
- Task "fetch-lifecycle": baseline pass rate is 100% (&gt;= 90%) — this bench task may be too easy and the experiment may lack discriminative power.
- Task "fetch-lifecycle" facet "existing assets unchanged and smoke tests pass": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "fetch-lifecycle" facet "ordinary LRU and successful async fetch": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "fetch-lifecycle" facet "concurrent fetches deduplicate provider work": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "fetch-lifecycle" facet "onInsert hides placeholder and classifies resolved application values": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "fetch-lifecycle" facet "refresh eviction disposes stale value once in both callbacks": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "fetch-lifecycle" facet "synchronous fetch result settles and is cached": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "fetch-lifecycle" facet "own refresh completion does not abort the provider": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "fetch-lifecycle" facet "explicit replacement still aborts refresh and retains replacement": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "fetch-lifecycle" facet "new regression has submission-pass/original-fail/reference-pass test-case evidence": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Only 0 discordant pair(s) between conditions — a run this size can only certify very large effects; treat any delta as indicative.

The verdict follows [the skillfit metrics protocol](https://github.com/remote-controlled-man/skillfit/blob/main/docs/metrics.md). Review the pinned manifest before comparing runs.

