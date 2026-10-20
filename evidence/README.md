# Evidence

Skillfit distinguishes recommendations from untested candidates. This directory holds dated experiment reports; raw manifests keep the available model identity, skill content hash, bench version, and per-trial results. Some historical manifests remain local to their original runs and are identified by run group in the dated entry; they are not independently downloadable here. New efficacy submissions should include a reviewed, shareable manifest. The selectable Codex catalog is an inventory, not an evidence-backed recommendation.

Two rules:

1. **Evidence expires.** Results are pinned to a model, a harness version, and a bench. A model upgrade can invalidate yesterday's conclusion — re-run before re-recommending.
2. **Negative results are results.** "No measurable gain" is a publishable answer. It is what keeps configs lean.

<a id="index"></a>

## Debugging study followups

The [maintained study index](../docs/skill-evaluation-evidence.md) owns the current
status, cumulative accounting and adoption limits. These later dated reports
retain each cohort separately; their results are not pooled here.

| Date | Report |
| --- | --- |
| 2026-10-15 | [Receiver mechanism probe: candidate failed, stopped after one call](2026-10-15-receiver-mechanism-stop.md) |
| 2026-10-15 | [Native diff mechanism: four authorized development calls](2026-10-15-native-diff-mechanism.md) |
| 2026-10-15 | [Eight-task offline readiness and spending-stop verification](2026-10-15-independent-offline-readiness.md) |
| 2026-10-15 | [Independent original/v4 comparison: stopped on a correctness regression](2026-10-15-independent-comparison-regression-stop.md) |
| 2026-10-15 | [Receiver correction: offline development after the v4 rejection](2026-10-15-diagnosing-receiver-correction.md) |
| 2026-10-14 | [Debugging evaluation stopped for a spending review](2026-10-14-debugging-spending-stop.md) |
| 2026-10-14 | [Rejected reading pilot and post-hoc cost review](2026-10-14-debugging-reading-pilot-and-cost-review.md) |
| 2026-10-14 | [Independent debugging Skill validation](2026-10-14-debugging-independent-validation.md) |
| 2026-10-14 | [Debugging followup interrupted by workspace routing failure](2026-10-14-debugging-followup-routing-stop.md) |
| 2026-10-13 | [Debugging Skill development stops and recorded costs](2026-10-13-debugging-development-stops.md) |
| 2026-10-13 | [Debugging v4 controls: mixed costs and an interrupted validation batch](2026-10-13-debugging-controls-and-sleep-stop.md) |
| 2026-10-13 | [Completed debugging Skill development: v3 rejected, v4 still experimental](2026-10-13-debugging-completed-development.md) |

## Earlier reports

| Date | Experiment | Agents | Headline |
|---|---|---|---|
| 2026-10-13 | [Timing repair and completed normalize-url revision comparison](2026-10-13-normalize-url-v2-validation.md) | Codex CLI | Two fresh pairs, all four deliveries 8/8; v2 uncached input +29.3%, input -28.9%, output -11.6%, elapsed -3.6%; stopped-stage costs retained |
| 2026-10-12 | [Timing repair and trust-alias guard stop](2026-10-12-normalize-url-v2-recovery.md) | Codex CLI | One normal 400.535s invocation; zero graded pairs; pure canonical trust registration exactly restores frozen config hash |
| 2026-10-12 | [Canonical guard repaired, provider connection timeout](2026-10-12-normalize-url-v2-comparison.md) | Codex CLI | One invocation, zero graded pairs; deadline fires at 600.002s, trial 600.019s; 503/TLS reconnect errors and unknown usage |
| 2026-10-12 | [Compact v2 event semantics and independent repository pilot](2026-10-12-diagnosing-v2.md) | Codex CLI | Both v2 onInsert controls 9/9; normalize-url one pair 8/8 before timeout stop; 7 actual invocations, 6 replayable deliveries; regression uncached/output cost increased |
| 2026-10-12 | [Real Skill revision on historical cache failures](2026-10-12-diagnosing-revision.md) | Codex CLI | 30 attempts, 14 graded pairs; candidate 12/14 vs previous 14/14, two callback regressions and one timeout; input −26%, per-success uncached/output/time increased |
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
