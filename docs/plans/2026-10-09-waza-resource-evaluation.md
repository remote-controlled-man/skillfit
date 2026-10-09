# Waza behavior benches and installed Skill evaluation

## Authority and starting point

The user approved the proposed behavior benches and complete-resource paired evaluation, and asked about CLI distribution. Implement on codex/waza-skill-evaluation, based on b03ced571a75af49d7dcfeb253c76091794b8b12, using the existing clean attached worktree. Preserve the primary checkout and prior branch. Tracked preimages and generated dist are archived in /private/tmp/skillfit-waza-backup-zomy57q6. Newly created files have absent preimages.

## Product direction

Keep TypeScript source, a Node.js command-line entry point and npm packaging. Core runtime dependencies remain zero. Shell/Python may be optional user tools or tested Skill resources; they are not required for the skillfit CLI. Package publication is a separate authorized release step, not part of this change.

## Implementation plan

1. Add paired mode installed for Skill targets and CLI executors. Copy the complete pinned Skill directory, including scripts/assets, only into each disposable treatment workspace at the agent matrix's project Skill location. Baseline and treatment prompts stay identical and receive no injected Skill body. Preserve inject/trigger modes and old manifests.
2. Reject unsafe paths, symlinks, fixture collisions, source drift and unavailable filesystem executors before model calls where possible. Fingerprint all installed resources and verify the copied bytes. Do not edit global agent configuration or install toolchains. Installed mode measures realized task outcomes with native discovery, not guaranteed activation or sandbox isolation.
3. Record delivery mode and installation path in compatible v4 metadata and readable reports. Preserve paired statistics, verdict semantics and all published evidence. Preserve available JSONL transcripts as local receipts, without treating absent activation evidence as non-use.
4. Adapt three Waza behavior cases into offline command benches: explicit hold before commit/push, reuse a valid documentation-check receipt, and recheck a stale receipt. Supply independent command verifiers and reference oracles. Check real files/Git state/receipts, with counterexamples for tempting but wrong actions. Retain provenance and limits; these single-turn tasks do not test authorization persistence across actual interruptions.
5. Add offline node:test regressions using injected executors/temporary roots. Verify actual script/binary copying, unchanged baseline, identical prompts, collisions/path safety, full hashes, legacy report compatibility and benchmark false-positive/false-negative controls.
6. Run npm test, offline bench gates and CLI dry-run/report smokes. Review the exact diff and hand off for independent review. Do not publish npm, push GitHub or modify the shared OSS contribution control state.

## Live pilot, after implementation gates

Use pinned Waza 6b6c736561eaf24c4d1c5360c3c90767ab470805 check/hunt sources, retaining license and all resource hashes. Before any calls, freeze runtime/configuration, prompts, bench/verifier/oracle hashes and stopping plan in a dated runs record. Maximum pilot: three baseline calibration calls (one per behavior task), six check calls (one paired trial per behavior task), and two hunt calls (one pair on the existing real UTF-8 replay): eleven calls, with no significance-chasing replacements. Keep all errors and saturated cases. This pilot checks execution and supports only indicative task-specific observations; it cannot establish general installation benefit. Any missing essential runtime or unreviewed grader blocks its affected calls, not the already-authorized implementation.

## Documentation and evidence

Document installed mode alongside its inherited-configuration and natural-discovery limitations. Update metrics.md with the new measurement surface while leaving its test and verdict formulas unchanged. Existing evidence is append-only. New empirical claims require actual manifests and receipts; offline tests are engineering verification only.

## Implementation gates completed (2026-10-09)

- npm test: 372 passed, 0 failed, 0 skipped; includes 7 installed-resource and 4 behavior regression tests. The first full run exposed one stale exact-message assertion for the extended paired-mode error; its expected text was updated and the complete suite rerun.
- Waza behavior bench: 14 passes, 0 warnings, 0 failures; all three NOP/oracle pairs and 4/5/5 facet contracts passed.
- Contributed bench gate: both benches pass. The pre-existing UTF-8 bench retains its negative-control warning.
- CLI installed dry-run: pinned Waza check has 15 resources, workspace input, equal initial prompt estimates and matrix destination .agents/skills/check; no run directory created.
- Published 2026-10-01 OSS workspace smoke v4 manifest still renders inconclusive with baseline/treatment 1/1. No published evidence was changed.
- git diff --check passed. No runtime dependency or matrix changes.
- Real model calls remain pending an independent review of the new graders and an environment/input freeze. Offline results are not efficacy observations.

## Independent review follow-up plan (before live calls)

Approval session independently reproduced two P2 issues on b009bd8: Kimi's second project Skill directory could contaminate baseline, and inherited core.logAllRefUpdates=false could make a correct hold fail. Backups: pre-review-fixes.tar in the existing backup directory. Check every matrix project Skill directory before either arm (plus explicit installation override). Explicitly enable and verify reflog in disposable Git initialization and the offline hold oracle; Git initialization failure on command tasks becomes an environment error, excluding the pair before any model call. Add offline regressions for alternative paths, a disabled global reflog setting, and unavailable reflog/setup exclusion. Preserve formulas, valid legacy manifests and published evidence. Repeat npm test and bench/report gates; freeze a new pilot plan only after review fixes pass. No live calls have occurred.

Review fixes verified: npm test 376/376, no failures or skips. Four new P2 regressions were run against isolated old b009bd8 runtime modules/oracle: 0 passed / 4 failed, as required; the repaired runtime passes all four. Red log: /private/tmp/skillfit-waza-p2-red-zqpeyz7s/red.log. Both contributed bench gates pass (Waza 14/0/0; existing UTF-8 negative-control warning retained). Published smoke report remains byte-identical. The original frozen pilot inputs are retained as superseded pre-call preparation; no model calls occurred before the review fixes.
