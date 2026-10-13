# skillfit evaluation: diagnosing-bugs

- Run: normalize-url-v2-validated-20261012 (2026-10-12T15:47:14.807Z)
- Target: skill; SHA-256 `2df457fa462c9d2b082a26364d53047e5612e195099c90c818e597a274eaf0ba`
- Baseline Skill: diagnosing-bugs (previous version); SHA-256 `3cf6b2fea38acbdebfbaca564f7a2f10cd7d12dfcad0442756a6842db96eccc1`
- Bench: oss-normalize-url-query-shape (1 task); SHA-256 `73ebfa8b2e00513e991df75f9bafdccdaf333dd7517e23ae74604685cca157af`
- Executor: cli / cli-configured
- Trials: 2 per condition
- Input: workspace
- Delivery: complete Skill installed in both conditions at .agents/skills
- Session: completed; 4/4 calls started, 4 finished; ceiling 4
- Frozen plan SHA-256: `9c9cf3c84b138ec81d7f8bc052550de596f89b01d9ea1adc1f11eba798b57dac`

| Task | Baseline | Treatment | Errors B/T | Δpass | Verdict |
|---|---:|---:|---:|---:|---|
| query-shape | 2/2 (100%) | 2/2 (100%) | 0/0 | 0.0pp | inconclusive |
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
| query-shape / baseline | 2 | 0 | 0 |
| query-shape / treatment | 2 | 0 | 0 |
| Overall / baseline | 2 | 0 | 0 |
| Overall / treatment | 2 | 0 | 0 |

Observed means a long-body read was detected. Unobserved means no body read was detected; the description may still have been in the catalog. Counts cover surviving graded pairs only. A read does not establish benefit. These are not trigger precision or recall.


## Checks and graded scores

| Task | Baseline mean check score | Treatment mean check score | Δscore |
|---|---:|---:|---:|
| query-shape | 100.0% | 100.0% | 0.0pp |

### query-shape

| Check | Baseline pass rate (graded observations) | Treatment pass rate (graded observations) |
|---|---:|---:|
| existing assets unchanged and smoke tests pass | 100.0% (n=2) | 100.0% (n=2) |
| bare path and flag query parameters retain their shape | 100.0% (n=2) | 100.0% (n=2) |
| mixed bare parameters preserve explicit empty values | 100.0% (n=2) | 100.0% (n=2) |
| similar parameter names do not interfere | 100.0% (n=2) | 100.0% (n=2) |
| default sorting and its opt-out remain supported | 100.0% (n=2) | 100.0% (n=2) |
| ordinary URL normalization and fragments remain intact | 100.0% (n=2) | 100.0% (n=2) |
| encoded backslashes and Unicode query values remain intact | 100.0% (n=2) | 100.0% (n=2) |
| retained regression has submission-pass/original-fail/reference-pass case evidence | 100.0% (n=2) | 100.0% (n=2) |

## Installation decision and next steps

- No installation recommendation from this run. Inconclusive means insufficient evidence to distinguish benefit from variation; it does not mean ineffective.
- Scope: 1 evaluated task(s), this target hash and executor configuration. A single task does not establish general OSS contribution quality.
- No installation recommendation: this run is below 8 tasks × 5 graded pairs and is indicative. Freeze a varied task set and trial count before a separate validation run; do not keep adding trials until significance appears.
- Observed baseline saturation: query-shape. Retain these as regression controls; add independent real failures to measure lift.
- Skill revision comparison: baseline contains the previous complete Skill and treatment contains the target version. Results describe revision effects, not installation benefit over no Skill. A positive delta does not guarantee non-regression on unseen tasks. Inspect per-run read observations and separate positive/negative trigger tests.
- Recorded token usage is shown below; it is not a billing estimate or a statistically established cost effect.

| Recorded token totals (field coverage) | Baseline | Treatment |
|---|---:|---:|
| Input | 714164 (2/2 runs) | 507671 (2/2 runs) |
| Output | 18302 (2/2 runs) | 16180 (2/2 runs) |

## Cost accounting

Surviving graded pairs:
- Runs B/T: 2/2; successful tasks B/T: 2/2

| Measure | Baseline known total | Treatment known total | Total change | Per success B/T | Per-success change | Final/partial/unknown B/T |
|---|---:|---:|---:|---|---:|---|
| Input tokens | 714164 | 507671 | -28.9% | 357082.000 / 253835.500 | -28.9% | 2/0/0 / 2/0/0 |
| Cached input tokens | 644352 | 417408 | -35.2% | 322176.000 / 208704.000 | -35.2% | 2/0/0 / 2/0/0 |
| Uncached input tokens | 69812 | 90263 | +29.3% | 34906.000 / 45131.500 | +29.3% | 2/0/0 / 2/0/0 |
| Output tokens | 18302 | 16180 | -11.6% | 9151.000 / 8090.000 | -11.6% | 2/0/0 / 2/0/0 |
| Elapsed seconds | 640.441 | 617.471 | -3.6% | 320.221 / 308.736 | -3.6% | 2/0/0 / 2/0/0 |

All agent executor invocations (including failures and excluded partners):
- Runs B/T: 2/2; successful tasks B/T: 2/2

| Measure | Baseline known total | Treatment known total | Total change | Per success B/T | Per-success change | Final/partial/unknown B/T |
|---|---:|---:|---:|---|---:|---|
| Input tokens | 714164 | 507671 | -28.9% | 357082.000 / 253835.500 | -28.9% | 2/0/0 / 2/0/0 |
| Cached input tokens | 644352 | 417408 | -35.2% | 322176.000 / 208704.000 | -35.2% | 2/0/0 / 2/0/0 |
| Uncached input tokens | 69812 | 90263 | +29.3% | 34906.000 / 45131.500 | +29.3% | 2/0/0 / 2/0/0 |
| Output tokens | 18302 | 16180 | -11.6% | 9151.000 / 8090.000 | -11.6% | 2/0/0 / 2/0/0 |
| Elapsed seconds | 640.441 | 617.471 | -3.6% | 320.221 / 308.736 | -3.6% | 2/0/0 / 2/0/0 |

- Not invoked B/T: 0/0 (guard/setup refusals; excluded from spending totals).
- Cached input is included in input. Uncached input = input - cached input; unrecorded cache usage is unknown, never zero.
- Per success = all spending in that population / successful tasks, including graded failures. >= marks a known lower bound; incomplete usage suppresses changes.
- Descriptive agent usage and elapsed time only; no billing estimate, cost significance claim, or judge usage included.

## Warnings

- Installed Skill mode measures task outcomes with native discovery and complete resources; activation is not guaranteed. Inherited agent configuration still applies.
- Skill revision comparison measures the target against the previous version, not against no Skill. A positive delta does not establish installation benefit or guarantee non-regression on unseen tasks.
- Task "query-shape": baseline pass rate is 100% (&gt;= 90%) — this bench task may be too easy and the experiment may lack discriminative power.
- Task "query-shape" facet "existing assets unchanged and smoke tests pass": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "query-shape" facet "bare path and flag query parameters retain their shape": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "query-shape" facet "mixed bare parameters preserve explicit empty values": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "query-shape" facet "similar parameter names do not interfere": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "query-shape" facet "default sorting and its opt-out remain supported": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "query-shape" facet "ordinary URL normalization and fragments remain intact": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "query-shape" facet "encoded backslashes and Unicode query values remain intact": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "query-shape" facet "retained regression has submission-pass/original-fail/reference-pass case evidence": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Only 0 discordant pair(s) between conditions — a run this size can only certify very large effects; treat any delta as indicative.

The verdict follows [the skillfit metrics protocol](https://github.com/remote-controlled-man/skillfit/blob/main/docs/metrics.md). Review the pinned manifest before comparing runs.
