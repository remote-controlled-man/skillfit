# Evidence

Every recommendation skillfit ships is backed by a dated, reproducible experiment. This directory holds the human-readable reports; raw manifests keep model version, skill content hash, bench version, and per-trial results.

Two rules:

1. **Evidence expires.** Results are pinned to a model, a harness version, and a bench. A model upgrade can invalidate yesterday's conclusion — re-run before re-recommending.
2. **Negative results are results.** "No measurable gain" is a publishable answer. It is what keeps configs lean.

## Index

| Date | Experiment | Agents | Headline |
|---|---|---|---|
| 2026-07 | [Skill baseline: 8 popular workflow skills](2026-07-skill-baseline.md) | Codex CLI | 1 of 8 skills showed repeatable benefit; all 8 added input tokens |
| 2026-09 | [OCR delegate vs. code-review skill](2026-09-ocr-vs-code-review.md) | Kimi Code | Tie on small diffs; OCR slightly better on large changesets via false-positive discipline |
| 2026-09 | [Code-review bench calibration](2026-09-bench-calibration.md) | Kimi Code | Baseline saturates all 3 difficulty tiers; small-PR spec review has no skill headroom for this model |
| 2026-09 | [Correction: trigger-mode inline-snapshot artifact](2026-09-trigger-snapshot-correction.md) | Kimi Code | Inlining the repo snapshot suppresses skill triggering (0/9 recall artifact); on disk, the skill fires — but only ~11% of the time |
| 2026-09 | [Debugging bench: diagnosing-bugs (exploratory)](2026-09-debugging-bench-exploratory.md) | Kimi Code | Quality saturation replicates July on 2/3 tasks; the July test-asset differential does not; prompt beats skill |
| 2026-09 | [Bench hardening follow-up](2026-09-debugging-hardening.md) | Kimi Code | Even hand-designed race/boundary bugs saturate; discriminative material must come from real failures |

## Reproduce

```bash
npx skillfit eval <skill-path> --bench benches/code-review --trials 3
```

## Submit your own

We do not accept unverifiable numbers. Submissions are experiment *configurations* (bench + skill ref + harness version) that CI re-runs. See [CONTRIBUTING.md](../CONTRIBUTING.md).
