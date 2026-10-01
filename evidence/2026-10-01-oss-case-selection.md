# Historical OSS cases for `diagnosing-bugs` evaluation (2026-10-01)

**Status: candidate selection and calibration, not a Skill efficacy verdict.** These cases come from existing `oss-contrib` work. They can be replayed at pinned pre-fix revisions without creating new issues or PRs. This selection concerns offline coding quality; maintainer acceptance is a separate outcome.

## Selection rule

Prefer a real defect with a fixed pre-fix revision, a reproducible failure, an unambiguous behavioral contract, and a reference repair. A useful task must keep enough surrounding code for diagnosis, grade observable behavior with 2–8 independent facets, and have a regression test that is RED on the original source and GREEN after repair. Baseline difficulty is measured before spending multiple paired trials. A case whose baseline passes at least 90% graduates to regression duty rather than providing evidence of Skill benefit, per `docs/metrics.md` L0.

## Calibrated cases

| Historical case | Offline gate | First adjacent pair | Decision |
| --- | --- | --- | --- |
| [`mcp-use` HTML blob UTF-8](https://github.com/mcp-use/mcp-use/blob/d90a070615a910b96eaf65f65f9eb4cad0123a90/libraries/typescript/packages/client/src/react/view/resolve-view-resource.ts) | Untouched source fails; reference repair passes 8/8 | Baseline 8/8; `diagnosing-bugs` 8/8 | Too easy for efficacy; retain as regression control |
| [`chrome-devtools-mcp` scheduled navigation race](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/a918b7b4086bcb14105b80abab1deb882535f15e/src/utils/WaitForHelper.ts) | Untouched source fails; reference repair passes 8/8 | Baseline 8/8 (108.3s); `diagnosing-bugs` 8/8 (136.4s) | Also saturated; retain as regression control |
| [`mcp-agent` Temporal log filters](https://github.com/lastmile-ai/mcp-agent/issues/382), explicit-contract prompt | Untouched source fails; historical PR #752 repair passes 8/8 | Baseline 8/8 (90.0s); `diagnosing-bugs` 8/8 (209.6s) | Saturated; the prompt supplied several hidden implementation boundaries |
| Same `mcp-agent` fixture, issue-style prompt | Same 8-facet verifier and oracle, new bench hash | Baseline 6/8, fail (185.4s); `diagnosing-bugs` 5/8, fail (116.7s) | Both arms at the pass-rate floor; one pair gives no efficacy verdict |

The Chrome case used the pinned upstream `WaitForHelper.ts` with a deterministic local CDP mock. Its hidden checks covered immediate main-frame scheduling, child-frame and delayed hints, existing requested/started signals, same-document exclusion, listener cleanup, a passing suite, and a RED→GREEN regression. The first prompt described the scheduled-navigation mechanism quite directly, which may have reduced diagnosis difficulty. The `mcp-agent` fixture kept the exact pinned upstream `logger.py` and `events.py`, with standard-library stubs for external runtime pieces. Its original explicit-contract prompt listed independent filter and initialization requirements; after that saturated, a separately hashed version paraphrased the original issue's user symptom without those details. The hidden verifier did not change. The issue-style baseline missed pre-initialization silence and `progress` severity; treatment missed those plus local/upstream filter independence. Its process result is a valid pair, but 0/1 pass in each arm is a floor warning. Prompt versions must not be pooled, and one pair per version cannot establish a time or quality effect.

Raw local manifests are `runs/codex-matt-oss-view-20261001-a/manifest.json`, `runs/codex-matt-oss-chrome-nav-20261001-a/manifest.json`, `runs/codex-matt-oss-mcp-logger-20261001-a/manifest.json` (bench `bca7d4cd891c…`), and `runs/codex-matt-oss-mcp-logger-issue-20261001-a/manifest.json` (bench `d73abf6bff79…`). These scratch benches live in `/private/tmp`, not in the published `benches/` collection.

### Natural activation check on the issue-style case

With the Skill installed at `.agents/skills/diagnosing-bugs`, one corrected Codex JSON-stream trial **read the Skill file** (detected trigger 1/1) but failed the task at 6/8 facets: it missed pre-initialization silence and `progress` severity. The single positive has a very wide Wilson interval (21%–100%); this bench has no negative control, so false-trigger rate is unavailable. The valid manifest is `runs/codex-matt-oss-mcp-logger-trigger-20261001-b/manifest.json`.

An earlier installed-Skill trial also visibly read `SKILL.md` in its raw JSON output, but its custom executor omitted `triggerSkillName`. The harness consequently recorded `triggered: null` and excluded it from rates. Preserve `runs/codex-matt-oss-mcp-logger-trigger-20261001-a/manifest.json` as an instrumentation-error record, not a no-trigger observation. The corrected run passed the parser; neither trial establishes task-quality benefit.

## Next candidates, in order

| Priority | Case and pinned historical base | Why it is harder | Offline gate to build |
| --- | --- | --- | --- |
| 1 | [nanobot reasoning-text SSE gap](https://github.com/HKUDS/nanobot/pull/5834), pre-fix `fa754c220400c26a2ceca3b0506d6730d8231027` | SSE and SDK transports should agree, but delta and done events need aggregation without duplicate callback emission. | Scripted SSE stream; check multiple deltas, done-only fallback, duplicate suppression, summary behavior, and SDK parity. |
| 2 | [crewAI #7636](https://github.com/crewAIInc/crewAI/issues/7636), `3831e8b6c86f78cb3cde18ebf7be0d197b958f0e` | Three version-less Gemini aliases need tool/thinking capability while numbered, Gemma, old, and unknown names keep existing behavior. | Offline construction-time probe and negative model-name controls. Calibrate before inclusion. |
| Deferred | [Mastra #24446](https://github.com/mastra-ai/mastra/issues/24446), `9fe69d6566c3e6d1e5c9f5bf5e9848b35c73e182` | Numeric `modelSettings.timeout` disappears across total, step, and first-chunk budgets, plus a spread-merge path; type and runtime contracts must agree. | The real path spans multiple package imports and a 2,673-line execution file. A tiny extracted fixture would change the integration task substantially; use a full-repository execution mode or a pinned dependency snapshot before calibration. |

These are historical task candidates, not approval to continue or publish their upstream contribution lanes. New source snapshots, fixtures, and reference repairs still need to pass `skillfit bench check`. Only candidates with a workable baseline should receive repeated paired runs. The calibration results above are insufficient for an overall benefit verdict.

## Exclusions

- `mcp-remote` overlapping-verifier race and Graphiti #1837 have unresolved behavioral contracts in the local notes; an oracle would bake in an unapproved choice.
- CopilotKit's single-route prefix bug has a narrow, obvious boundary fix and is likely another ceiling case.
- Weaviate #12986 has a promising mutation invariant but no locally validated reference repair in the notes, so it is not ready for an oracle gate.
