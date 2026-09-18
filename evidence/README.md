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

## Reproduce

```bash
npx skillfit eval <skill-path> --bench benches/code-review --trials 3
```

## Submit your own

We do not accept unverifiable numbers. Submissions are experiment *configurations* (bench + skill ref + harness version) that CI re-runs. See [CONTRIBUTING.md](../CONTRIBUTING.md).
