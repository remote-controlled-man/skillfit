# skillfit evaluation: diagnosing-bugs

- Run: transfer-v2-20261012 (2026-10-12T11:33:06.524Z)
- Target: skill; SHA-256 `2df457fa462c9d2b082a26364d53047e5612e195099c90c818e597a274eaf0ba`
- Baseline Skill: diagnosing-bugs (previous version); SHA-256 `3cf6b2fea38acbdebfbaca564f7a2f10cd7d12dfcad0442756a6842db96eccc1`
- Bench: oss-normalize-url-query-shape (1 task); SHA-256 `73ebfa8b2e00513e991df75f9bafdccdaf333dd7517e23ae74604685cca157af`
- Executor: cli / cli-configured
- Trials: 2 per condition
- Input: workspace
- Delivery: complete Skill installed in both conditions at .agents/skills
- Session: stopped; 3/4 calls started, 3 finished; ceiling 4
- Frozen plan SHA-256: `1992406921b1c3adfa3a3892ef2cb4bb0366d6b68f9ec898e31b656143b4afd9`

| Task | Baseline | Treatment | Errors B/T | Δpass | Verdict |
|---|---:|---:|---:|---:|---|
| query-shape | 1/1 (100%) | 1/1 (100%) | 1/1 | 0.0pp | inconclusive |
| Overall | 1/1 (100%) | 1/1 (100%) | 1/1 | 0.0pp | inconclusive |

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
| query-shape / baseline | 1 | 0 | 0 |
| query-shape / treatment | 1 | 0 | 0 |
| Overall / baseline | 1 | 0 | 0 |
| Overall / treatment | 1 | 0 | 0 |

Observed means a long-body read was detected. Unobserved means no body read was detected; the description may still have been in the catalog. Counts cover surviving graded pairs only. A read does not establish benefit. These are not trigger precision or recall.


## Checks and graded scores

| Task | Baseline mean check score | Treatment mean check score | Δscore |
|---|---:|---:|---:|
| query-shape | 100.0% | 100.0% | 0.0pp |

### query-shape

| Check | Baseline pass rate (graded observations) | Treatment pass rate (graded observations) |
|---|---:|---:|
| existing assets unchanged and smoke tests pass | 100.0% (n=1) | 100.0% (n=1) |
| bare path and flag query parameters retain their shape | 100.0% (n=1) | 100.0% (n=1) |
| mixed bare parameters preserve explicit empty values | 100.0% (n=1) | 100.0% (n=1) |
| similar parameter names do not interfere | 100.0% (n=1) | 100.0% (n=1) |
| default sorting and its opt-out remain supported | 100.0% (n=1) | 100.0% (n=1) |
| ordinary URL normalization and fragments remain intact | 100.0% (n=1) | 100.0% (n=1) |
| encoded backslashes and Unicode query values remain intact | 100.0% (n=1) | 100.0% (n=1) |
| retained regression has submission-pass/original-fail/reference-pass case evidence | 100.0% (n=1) | 100.0% (n=1) |

## Installation decision and next steps

- No installation decision: the frozen experiment stopped or did not complete its declared calls. Inspect \_session.json, \_calls.jsonl and the error receipts; repair the inputs/environment, then declare a fresh run. Retain this run without adding replacement samples.

| Recorded token totals (field coverage) | Baseline | Treatment |
|---|---:|---:|
| Input | 268367 (1/1 runs) | 250711 (1/1 runs) |
| Output | 10925 (1/1 runs) | 8385 (1/1 runs) |

## Cost accounting

Surviving graded pairs:
- Runs B/T: 1/1; successful tasks B/T: 1/1

| Measure | Baseline known total | Treatment known total | Total change | Per success B/T | Per-success change | Final/partial/unknown B/T |
|---|---:|---:|---:|---|---:|---|
| Input tokens | 268367 | 250711 | -6.6% | 268367.000 / 250711.000 | -6.6% | 1/0/0 / 1/0/0 |
| Cached input tokens | 221440 | 219776 | -0.8% | 221440.000 / 219776.000 | -0.8% | 1/0/0 / 1/0/0 |
| Uncached input tokens | 46927 | 30935 | -34.1% | 46927.000 / 30935.000 | -34.1% | 1/0/0 / 1/0/0 |
| Output tokens | 10925 | 8385 | -23.2% | 10925.000 / 8385.000 | -23.2% | 1/0/0 / 1/0/0 |
| Elapsed seconds | 363.937 | 274.493 | -24.6% | 363.937 / 274.493 | -24.6% | 1/0/0 / 1/0/0 |

All agent executor invocations (including failures and excluded partners):
- Runs B/T: 2/1; successful tasks B/T: 1/1

| Measure | Baseline known total | Treatment known total | Total change | Per success B/T | Per-success change | Final/partial/unknown B/T |
|---|---:|---:|---:|---|---:|---|
| Input tokens | >= 268367 | 250711 | n/a | >= 268367.000 / 250711.000 | n/a | 1/0/1 / 1/0/0 |
| Cached input tokens | >= 221440 | 219776 | n/a | >= 221440.000 / 219776.000 | n/a | 1/0/1 / 1/0/0 |
| Uncached input tokens | >= 46927 | 30935 | n/a | >= 46927.000 / 30935.000 | n/a | 1/0/1 / 1/0/0 |
| Output tokens | >= 10925 | 8385 | n/a | >= 10925.000 / 8385.000 | n/a | 1/0/1 / 1/0/0 |
| Elapsed seconds | 2542.712 | 274.493 | -89.2% | 2542.712 / 274.493 | -89.2% | 2/0/0 / 1/0/0 |

- Not invoked B/T: 0/1 (guard/setup refusals; excluded from spending totals).
- Cached input is included in input. Uncached input = input - cached input; unrecorded cache usage is unknown, never zero.
- Per success = all spending in that population / successful tasks, including graded failures. >= marks a known lower bound; incomplete usage suppresses changes.
- Descriptive agent usage and elapsed time only; no billing estimate, cost significance claim, or judge usage included.

## Warnings

- Experiment did not complete its declared calls; no installation recommendation. Inspect \_session.json and \_calls.jsonl before planning a fresh run.
- Installed Skill mode measures task outcomes with native discovery and complete resources; activation is not guaranteed. Inherited agent configuration still applies.
- Skill revision comparison measures the target against the previous version, not against no Skill. A positive delta does not establish installation benefit or guarantee non-regression on unseen tasks.
- Task "query-shape" (baseline): 1 trial(s) hit an executor, verifier, or engagement error and were excluded from the rates, together with their paired treatment trial(s) — an ungraded run is not a failure.
- Task "query-shape" (treatment): 1 trial(s) hit an executor, verifier, or engagement error and were excluded from the rates, together with their paired baseline trial(s) — an ungraded run is not a failure.
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

