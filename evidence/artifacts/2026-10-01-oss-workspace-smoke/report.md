# skillfit evaluation: diagnosing-bugs

- Run: eval-20261001-141513 (2026-10-01T06:20:35.009Z)
- Target: skill; SHA-256 `f19320ddde7601ce58a82fd4cbe3e2f07038e75e7e590fcf65360d668b66d80d`
- Bench: oss-mcp-use-view-utf8 (1 task); SHA-256 `f073235c583885f909ab40aa041017b11a6df20577e8bb17525001695bedc57d`
- Executor: cli / cli-configured
- Trials: 1 per condition
- Input: workspace

| Task | Baseline | Treatment | Errors B/T | Δpass | Verdict |
|---|---:|---:|---:|---:|---|
| view-utf8 | 1/1 (100%) | 1/1 (100%) | 0/0 | 0.0pp | inconclusive |
| Overall | 1/1 (100%) | 1/1 (100%) | 0/0 | 0.0pp | inconclusive |

## Statistical readout

- Overall verdict: **inconclusive** — only 0 discordant pair(s) (Δpass 0pp); significance needs at least 6
- Discordant pairs: 0 improved, 0 regressed; McNemar exact p=1.0000
- Δpass 95% paired-bootstrap CI (2000 resamples): [0.0pp, 0.0pp]
- Observed Δpass CI half-width: ±0.0pp; not a validated minimum detectable effect.
- Δscore 95% paired-bootstrap CI (2000 resamples): [0.0pp, 0.0pp]
- The bootstrap interval collapsed on the observed tasks; this does not establish zero uncertainty or validated effect resolution.
- Scale: 1 task × 1 trial per condition; below the conclusive bar (8 tasks × 5 trials). Treat broader claims as indicative even if the within-bench verdict is statistically significant.
- Completed scale: 0 task(s) have at least 5 graded pairs after exclusions.

## Checks and graded scores

| Task | Baseline mean check score | Treatment mean check score | Δscore |
|---|---:|---:|---:|
| view-utf8 | 100.0% | 100.0% | 0.0pp |

### view-utf8

| Check | Baseline pass rate (graded observations) | Treatment pass rate (graded observations) |
|---|---:|---:|
| Unicode blob round-trip | 100.0% (n=1) | 100.0% (n=1) |
| ASCII blob unchanged | 100.0% (n=1) | 100.0% (n=1) |
| text content takes precedence | 100.0% (n=1) | 100.0% (n=1) |
| content-level metadata merges over listing | 100.0% (n=1) | 100.0% (n=1) |
| permissive CSP stays unenforced | 100.0% (n=1) | 100.0% (n=1) |
| MIME validation and missing-content behavior | 100.0% (n=1) | 100.0% (n=1) |
| final test suite passes | 100.0% (n=1) | 100.0% (n=1) |
| regression test is red on original source | 100.0% (n=1) | 100.0% (n=1) |

## Installation decision and next steps

- No installation recommendation from this run. Inconclusive means insufficient evidence to distinguish benefit from variation; it does not mean ineffective.
- Scope: 1 evaluated task(s), this target hash and executor configuration. A single task does not establish general OSS contribution quality.
- The run is indicative. Freeze a varied task set and trial count before a separate validation run; do not keep adding trials until significance appears.
- Observed baseline saturation: view-utf8. Retain these as regression controls; add independent real failures to measure lift.
- Activation is unmeasured by this paired run: Skill content was force-injected. Run separate trigger tests with relevant requests and negative controls before an installation decision.
- Token overhead is unavailable. Elapsed time or prompt-size estimates do not establish token cost.

## Warnings

- Task "view-utf8": baseline pass rate is 100% (&gt;= 90%) — this bench task may be too easy and the experiment may lack discriminative power.
- Task "view-utf8" facet "Unicode blob round-trip": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "view-utf8" facet "ASCII blob unchanged": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "view-utf8" facet "text content takes precedence": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "view-utf8" facet "content-level metadata merges over listing": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "view-utf8" facet "permissive CSP stays unenforced": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "view-utf8" facet "MIME validation and missing-content behavior": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "view-utf8" facet "final test suite passes": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Task "view-utf8" facet "regression test is red on original source": baseline check pass rate is 100% (&gt;= 90%) — this facet is saturated and measures no lift.
- Only 0 discordant pair(s) between conditions — a run this size can only certify very large effects; treat any delta as indicative.

The verdict follows [the skillfit metrics protocol](https://github.com/remote-controlled-man/skillfit/blob/main/docs/metrics.md). Review the pinned manifest before comparing runs.
