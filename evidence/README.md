# Evidence

Skillfit distinguishes recommendations from untested candidates. This directory holds dated experiment reports; raw manifests keep the available model identity, skill content hash, bench version, and per-trial results. Some historical manifests remain local to their original runs and are identified by run group in the dated entry; they are not independently downloadable here. New efficacy submissions should include a reviewed, shareable manifest. The selectable Codex catalog is an inventory, not an evidence-backed recommendation.

Two rules:

1. **Evidence expires.** Results are pinned to a model, a harness version, and a bench. A model upgrade can invalidate yesterday's conclusion — re-run before re-recommending.
2. **Negative results are results.** "No measurable gain" is a publishable answer. It is what keeps configs lean.

## Index

| Date | Experiment | Agents | Headline |
|---|---|---|---|
| 2026-10-01 | [Real OSS workspace workflow smoke](2026-10-01-oss-workspace-smoke.md) | Codex CLI | Predeclared real-source disk-file pair completed, both 8/8; reproducible inputs and receipts; no Skill installation recommendation |
| 2026-07 | [Skill baseline: 8 popular workflow skills](2026-07-skill-baseline.md) | Codex CLI | One limited regression-test artifact signal (2/3 treated runs); no robust task-quality gain; all 8 added input tokens |
| 2026-09 | [OCR delegate vs. code-review skill](2026-09-ocr-vs-code-review.md) | Kimi Code | Tie on small diffs; OCR slightly better on large changesets via false-positive discipline |
| 2026-09 | [Code-review bench calibration](2026-09-bench-calibration.md) | Kimi Code | Baseline saturates all 3 difficulty tiers; small-PR spec review has no skill headroom for this model |
| 2026-09 | [Correction: trigger-mode inline-snapshot artifact](2026-09-trigger-snapshot-correction.md) | Kimi Code | Inlining the repo snapshot suppresses skill triggering (0/9 recall artifact); on disk, the skill fires — but only ~11% of the time |
| 2026-09 | [Debugging bench: diagnosing-bugs (exploratory)](2026-09-debugging-bench-exploratory.md) | Kimi Code | Quality saturation replicates July on 2/3 tasks; the July test-asset differential does not; prompt beats skill |
| 2026-09 | [Bench hardening follow-up](2026-09-debugging-hardening.md) | Kimi Code | Even hand-designed race/boundary bugs saturate; discriminative material must come from real failures |
| 2026-09-22 | [Codex trigger capture + cross-model divergence](2026-09-22-codex-trigger-capture.md) | Codex CLI + Kimi Code | Same skill, same bench: Codex 6/6 trigger recall vs Kimi 1/9 — routing behavior is agent-specific |
| 2026-10-01 | [Codex `diagnosing-bugs` execution and trigger pilot](2026-10-01-codex-diagnosing-bugs-pilot.md) | Codex CLI | One synthetic task suggested a regression-test gain; one historical OSS bug saturated in both arms; no efficacy verdict |
| 2026-10-01 | [Historical OSS case selection and calibration](2026-10-01-oss-case-selection.md) | Codex CLI | Three explicit prompts saturated; issue-style mcp-agent replay missed facets in both arms; installed Skill fired in one valid trial, without task success |

## Reproduce

```bash
git clone https://github.com/remote-controlled-man/skillfit.git
cd skillfit
npm ci
npm run build
node dist/cli.js bench check benches/code-review
```

This verifies bench integrity offline; the [dated first-check example](../docs/reproducible-offline-example.md)
records the expected summaries and their limits. To reproduce an efficacy result, use the dated entry's pinned
Skill source, bench hash, agent/model, and trial count; that run requires a local agent or API key and
may cost money. For a new paired run, render its manifest with
`node dist/cli.js report eval <manifest.json>`. Historical and trigger manifests may have different schemas and cannot be silently
converted by the current renderer.

## Submit your own

We do not accept unverifiable numbers. Submit the pinned experiment configuration, full offline bench
check, result manifest, and limitations through the
[evidence issue template](../.github/ISSUE_TEMPLATE/evidence_submission.yml). CI checks benches offline;
live-agent reproduction is separate. See [CONTRIBUTING.md](../CONTRIBUTING.md).
