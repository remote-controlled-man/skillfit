# skillfit evaluation: diagnosing-bugs

- Run: validation-20261012-rtk (2026-10-12T07:17:35.901Z)
- Target: skill; SHA-256 `f7bc79f291af75091fa0a7ec0abc6f384bb5a5287a63236c800904057f9528b8`
- Baseline Skill: diagnosing-bugs (previous version); SHA-256 `3cf6b2fea38acbdebfbaca564f7a2f10cd7d12dfcad0442756a6842db96eccc1`
- Bench: oss-lru-cache (3 tasks); SHA-256 `b276606b5d00bdd98a65d8fa8944ba38b73efc7429e73b5dc56d83b8937950b2`
- Executor: cli / cli-configured
- Trials: 5 per condition
- Input: workspace
- Delivery: complete Skill installed in both conditions at .agents/skills
- Session: stopped; 30/30 calls started, 30 finished; ceiling 30
- Frozen plan SHA-256: `ef4f25c22d765edc8ac90df36bc1ef99dfebdf115a51d9763aa8b9a9976eb31f`

| Task | Baseline | Treatment | Errors B/T | Δpass | Verdict |
|---|---:|---:|---:|---:|---|
| fetch-size | 5/5 (100%) | 5/5 (100%) | 0/0 | 0.0pp | inconclusive |
| fetch-abort | 5/5 (100%) | 5/5 (100%) | 0/0 | 0.0pp | inconclusive |
| fetch-lifecycle | 4/4 (100%) | 2/4 (50%) | 0/1 | -50.0pp | inconclusive |
| Overall | 14/14 (100%) | 12/14 (86%) | 0/1 | -14.3pp | inconclusive |

## Statistical readout

- Overall verdict: **inconclusive** — only 2 discordant pair(s) (Δpass -14pp); significance needs at least 6
- Discordant pairs: 0 improved, 2 regressed; McNemar exact p=0.5000
- Δpass 95% paired-bootstrap CI (2000 resamples): [-50.0pp, 0.0pp]
- Observed Δpass CI half-width: ±25.0pp; not a validated minimum detectable effect.
- Δscore 95% paired-bootstrap CI (2000 resamples): [-5.6pp, 0.0pp]
- Scale: 3 tasks × 5 trials per condition; below the conclusive bar (8 tasks × 5 trials). Treat broader claims as indicative even if the within-bench verdict is statistically significant.
- Completed scale: 2 task(s) have at least 5 graded pairs after exclusions.

## Native Skill-read observations

| Task / arm | Read observed | Read unobserved | Unknown |
|---|---:|---:|---:|
| fetch-size / baseline | 5 | 0 | 0 |
| fetch-size / treatment | 5 | 0 | 0 |
| fetch-abort / baseline | 5 | 0 | 0 |
| fetch-abort / treatment | 5 | 0 | 0 |
| fetch-lifecycle / baseline | 4 | 0 | 0 |
| fetch-lifecycle / treatment | 4 | 0 | 0 |
| Overall / baseline | 14 | 0 | 0 |
| Overall / treatment | 14 | 0 | 0 |

Observed means a long-body read was detected. Unobserved means no body read was detected; the description may still have been in the catalog. Counts cover surviving graded pairs only. A read does not establish benefit. These are not trigger precision or recall.


## Checks and graded scores

| Task | Baseline mean check score | Treatment mean check score | Δscore |
|---|---:|---:|---:|
| fetch-size | 100.0% | 100.0% | 0.0pp |
| fetch-abort | 100.0% | 100.0% | 0.0pp |
| fetch-lifecycle | 100.0% | 94.4% | -5.6pp |

### fetch-size

| Check | Baseline pass rate (graded observations) | Treatment pass rate (graded observations) |
|---|---:|---:|
| existing assets unchanged and smoke tests pass | 100.0% (n=5) | 100.0% (n=5) |
| ordinary LRU and successful async fetch | 100.0% (n=5) | 100.0% (n=5) |
| concurrent fetches deduplicate provider work | 100.0% (n=5) | 100.0% (n=5) |
| size accounting and LRU order after out-of-order resolution | 100.0% (n=5) | 100.0% (n=5) |
| size-bound ordinary updates preserve newest entry | 100.0% (n=5) | 100.0% (n=5) |
| new regression has submission-pass/original-fail/reference-pass test-case evidence | 100.0% (n=5) | 100.0% (n=5) |

### fetch-abort

| Check | Baseline pass rate (graded observations) | Treatment pass rate (graded observations) |
|---|---:|---:|
| existing assets unchanged and smoke tests pass | 100.0% (n=5) | 100.0% (n=5) |
| ordinary LRU and successful async fetch | 100.0% (n=5) | 100.0% (n=5) |
| concurrent fetches deduplicate provider work | 100.0% (n=5) | 100.0% (n=5) |
| deleted pending fetch rejects before provider completion | 100.0% (n=5) | 100.0% (n=5) |
| evicted pending fetch rejects before provider completion | 100.0% (n=5) | 100.0% (n=5) |
| replaced pending fetch rejects before provider completion | 100.0% (n=5) | 100.0% (n=5) |
| stale-on-rejection remains supported | 100.0% (n=5) | 100.0% (n=5) |
| new regression has submission-pass/original-fail/reference-pass test-case evidence | 100.0% (n=5) | 100.0% (n=5) |

### fetch-lifecycle

| Check | Baseline pass rate (graded observations) | Treatment pass rate (graded observations) |
|---|---:|---:|
| existing assets unchanged and smoke tests pass | 100.0% (n=4) | 100.0% (n=4) |
| ordinary LRU and successful async fetch | 100.0% (n=4) | 100.0% (n=4) |
| concurrent fetches deduplicate provider work | 100.0% (n=4) | 100.0% (n=4) |
| onInsert hides placeholder and classifies resolved application values | 100.0% (n=4) | 50.0% (n=4) |
| refresh eviction disposes stale value once in both callbacks | 100.0% (n=4) | 100.0% (n=4) |
| synchronous fetch result settles and is cached | 100.0% (n=4) | 100.0% (n=4) |
| own refresh completion does not abort the provider | 100.0% (n=4) | 100.0% (n=4) |
| explicit replacement still aborts refresh and retains replacement | 100.0% (n=4) | 100.0% (n=4) |
| new regression has submission-pass/original-fail/reference-pass test-case evidence | 100.0% (n=4) | 100.0% (n=4) |

## Installation decision and next steps

- No installation decision: the frozen experiment stopped or did not complete its declared calls. Inspect \_session.json, \_calls.jsonl and the error receipts; repair the inputs/environment, then declare a fresh run. Retain this run without adding replacement samples.

| Recorded token totals (field coverage) | Baseline | Treatment |
|---|---:|---:|
| Input | 5257320 (14/14 runs) | 3890644 (14/14 runs) |
| Output | 137810 (14/14 runs) | 124487 (14/14 runs) |

## Warnings

- Experiment did not complete its declared calls; no installation recommendation. Inspect \_session.json and \_calls.jsonl before planning a fresh run.
- Installed Skill mode measures task outcomes with native discovery and complete resources; activation is not guaranteed. Inherited agent configuration still applies.
- Skill revision comparison measures the target against the previous version, not against no Skill. A positive delta does not establish installation benefit or guarantee non-regression on unseen tasks.
- Task "fetch-size": baseline pass rate is 100% (&gt;= 90%) — this bench task may be too easy and the experiment may lack discriminative power.
- Task "fetch-size" facet "existing assets unchanged and smoke tests pass": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "fetch-size" facet "ordinary LRU and successful async fetch": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "fetch-size" facet "concurrent fetches deduplicate provider work": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "fetch-size" facet "size accounting and LRU order after out-of-order resolution": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "fetch-size" facet "size-bound ordinary updates preserve newest entry": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "fetch-size" facet "new regression has submission-pass/original-fail/reference-pass test-case evidence": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "fetch-abort": baseline pass rate is 100% (&gt;= 90%) — this bench task may be too easy and the experiment may lack discriminative power.
- Task "fetch-abort" facet "existing assets unchanged and smoke tests pass": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "fetch-abort" facet "ordinary LRU and successful async fetch": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "fetch-abort" facet "concurrent fetches deduplicate provider work": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "fetch-abort" facet "deleted pending fetch rejects before provider completion": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "fetch-abort" facet "evicted pending fetch rejects before provider completion": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "fetch-abort" facet "replaced pending fetch rejects before provider completion": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "fetch-abort" facet "stale-on-rejection remains supported": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "fetch-abort" facet "new regression has submission-pass/original-fail/reference-pass test-case evidence": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "fetch-lifecycle" (treatment): 1 trial(s) hit an executor, verifier, or engagement error and were excluded from the rates, together with their paired baseline trial(s) — an ungraded run is not a failure.
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
- Overall baseline pass rate is 100% (&gt;= 90%) — this bench may be too easy and the experiment may lack discriminative power.
- Only 2 discordant pair(s) between conditions — a run this size can only certify very large effects; treat any delta as indicative.

The verdict follows [the skillfit metrics protocol](https://github.com/remote-controlled-man/skillfit/blob/main/docs/metrics.md). Review the pinned manifest before comparing runs.

