# Current work

## Status

- Baseline: clean local `main` at 5696bfa32cf28a5fc11d8d5da237f5d070a3cf17;
  previous architecture work was delivered to `origin/codex/docs-framework-architecture`.
- Current task: remove unused repository archive machinery and clarify Bench/input,
  run/output and release-proof ownership using evidence from mature projects.
- Progress: P1–P5 and Q1 complete; Q2 commit in progress.
- Delivery scope: the user now authorizes review, commit and push to
  `origin/codex/docs-framework-architecture`, followed by exact remote-ref verification.
  No PR, remote CI, publication, model calls or actual user-configuration writes.
  Commits use `[skip ci]`; do not push main or change branch protection.

## Execution order and acceptance

| Order | Work / dependency | Status | Verification / result |
| --- | --- | --- | --- |
| P1 | Consumer audit, external research and plan review | Complete | `src/` does not consume the repository archive catalog/restorer. Release, packaging and dedicated historical tests keep it alive. Compared primary Promptfoo, Inspect and SWE-bench sources below. Separate actual product replay from obsolete repository restoration before deleting anything. |
| P2 | Release acceptance and proof compatibility; after P1 | Complete | New releases require exactly install/documents/examples/features/provenance/signatures. Add a failing public regression, then preserve read-only verification of complete older eight-stage standalone bundles and refuse partial/unknown protocols. Remove repository receipt import and its tests; keep release-upload recovery. |
| P3 | Remove archive infrastructure and all consumers; after P2 | Complete | Delete `evidence/`, `tools/history/`, archive guide and archive-only recipes/tests. Remove historical-object fetches from CI and archive requirements from npm packaging. Keep ordinary tarball inspection, offline install, current report/export/portable replay, provenance and signatures. No fixed Git commit or published package is rewritten. |
| P4 | Bench and documentation ownership; after P3 | Complete | Retain reusable inputs and real regression fixtures with their licenses. Bench manifest remains the only executable task index; preserve schema 1/2. Explain input layout, dataset admission, output locations and removal rules in existing Bench/architecture guides. Catalog distinguishes reusable cases from diagnostic controls; remove dated study/recovery instructions. Migrate links, Skill, registry, package policy and AGENTS together. Docs index provides the fixed-source link for retired pages. |
| P5 | Integrated review and final local acceptance; after P4 | Complete | One OCR-guided review covering final code, tests, docs and deleted callers. Full `npm test`; architecture/docs/link gates against the exact baseline; offline contributed bench checks. Actual npm pack/install and five current portable replays through the installed feature recipe; check current report/export and Skill docs. Record actual counts, package size and any unresolved limitation here. |

## Delivery review and progress

| Order | Work / dependency | Status | Verification / result |
| --- | --- | --- | --- |
| Q1 | Reconcile final inputs, review consumers and verify install/replay | Complete | Confirm all 65 task paths against P5 hashes, including the seven untracked fixture moves. Reconcile the integrated review with current requirements; fill any uncovered consumer. Run the required full offline suite before committing. Verify retained install/replay receipts against exact package/source/log bytes; rerun only when inputs or proof are unavailable/changed. |
| Q2 | Commit reviewed source and updated plan; after Q1 | In progress | Stage only the reviewed task paths, check staged whitespace/content hashes and include `[skip ci]`. Preserve unrelated work. |
| Q3 | Push authorized branch and confirm remote; after Q2 | Pending | Normal fast-forward push HEAD to origin/codex/docs-framework-architecture; independently compare remote SHA with local HEAD. No PR or remote CI. Record actual result here. |

## Decisions and research

Keep a single modular CLI. Four distinct artifacts have different consumers:
reusable Bench inputs are versioned with their graders; completed runs preserve sealed
local observations under ignored `runs/<group>/`; exports/replay packages are
explicit user-selected deliveries; release receipts belong to an external
workflow artifact. There is no fifth, automatically accumulated repository
`evidence` lifecycle. Future changes must name a real consumer before adding a
new retained artifact or mandatory gate.

Primary comparisons (reviewed 2026-10-26):

- [Promptfoo tests](https://www.promptfoo.dev/docs/configuration/test-cases/)
  separate reusable case/assertion configuration from
  [explicit generated outputs](https://www.promptfoo.dev/docs/configuration/outputs/).
- [Inspect tasks](https://inspect.aisi.org.uk/tasks.html) own dataset/solver/scorer;
  [evaluation logs](https://inspect.aisi.org.uk/eval-logs.html) go to a configurable
  run-log directory rather than becoming task definitions.
- [SWE-bench harness](https://www.swebench.com/SWE-bench/reference/harness/)
  consumes datasets/predictions; its separate
  [experiments repository](https://github.com/SWE-bench/experiments) has submission
  metadata with real leaderboard consumers and externally hosted bulky artifacts.

Our choice is an inference from those boundaries, not a claim that every project
uses one physical layout. Do not copy their provider/plugin/storage platforms.
Changing JSON/YAML syntax or renaming every fixture would not remove our unused
archive lifecycle. Keep existing compatible manifest paths and offline fixtures;
clarify authoring and artifact ownership instead. No new schema or dependency.

The user now explicitly requests archive removal, superseding earlier requirements
to ship the catalog/restorer and rerun all repository historical procedures.
Published evidence remains unchanged in fixed Git history. Current saved-result
readers and portable replay remain required; legacy repository import is retired.
Complete old standalone release bundles remain read-only verifiable. Reject
unknown/partial proof protocols; do not reinterpret failed checks as passed.

Plan review: deletion follows every known consumer, including Skill instructions,
package rules and document anchor migration. Main risks are confusing npm tarballs
with obsolete history, invalidating old standalone receipts, and deleting fixture
inputs used by current offline regressions. P2 tests and P5 installed acceptance
cover these seams. No unresolved material design choice blocks implementation.

## Verification

P3–P4: deleted the catalog/restorer, historical tools, archive guide and archive-only
recipes/tests; removed all three CI historical-object fetches and npm requirements.
Current product report/export/replay code is unchanged. Seven genuinely consumed
fixtures moved by owner with identical bytes; the unused budget ledger was deleted.
Bench format/catalog and existing architecture/release/Skill entry points now
separate inputs, diagnostics, run outputs and delivery proofs. No new maintained
page or schema. Documentation gate: 34 entries, zero errors against 5696bfa,
171 old headings/paths accounted. The two fixture-only failures caused by the
removed archive check ID were fixed; all 51 focused checks then passed.

P2: new-standalone-proof regression failed first (schema 2 vs expected 3), then passed.
Ten release-acceptance checks pass: exact six-stage generation, old complete
eight-stage read-only verification, incomplete/mismatched/unknown refusal and
failed/interrupted upload recovery. Manifest remains standalone schema 3; its
verification protocol distinguishes old v2/eight stages from new v3/six stages.
Repository import removed; no historical receipt bytes were changed.

P1: clean baseline confirmed. Read-only consumer audit covered source, release,
CI, package policy, documentation registry, Skill and bench test dependencies.
No production runtime imports the deleted facilities. Keep the versioned
0.11.0 installed feature recipe: it is still called and hash-pinned by current
feature acceptance. Preserve real provenance and regression fixtures even where
their folder is currently named history. No live experiment was run.


P5 final acceptance (Node 24.21.0 / macOS arm64):

- Integrated OCR-guided review accounted for all 65 paths: 21 selected by OCR and
  44 filtered docs/tests/deletions/data checked here; zero skipped, no remaining
  finding. Consumer exploration was delegated; final review was one local review.
- Full offline `npm test`: 1,065 passed, zero failed/cancelled/skipped, 69.5 seconds.
  Removed archive-only coverage explains the lower count than the 1,099 baseline.
  A subsequent registry-order-only cleanup and plan wording change passed all
  26 affected documentation regressions; no product/runtime input changed.
- Architecture: 159 modules, zero violations/exceptions. Documentation: 34 entries,
  zero errors against the exact baseline. All eight contributed benches / 36 tasks
  passed offline integrity checks. Docs now has 11 maintained pages, no new page.
- Actual offline npm pack/install/bin and Skill document checks passed: 1,079 files,
  943,203 compressed / 4,567,018 unpacked bytes (84,251 / 430,082 bytes less than
  baseline). SHA-256 a4c771c70ef7087138b3502a364511e6a61972f5b2eceb1bb588eb8491973286.
  Every installed file matches final source; installed feature acceptance passed
  31 regressions and five portable replays, fake-process success/failure and
  disposable configuration/bundle checks. Four release entry documents passed.
- Seven moved fixture files match baseline bytes; no product runtime code changed,
  no executable reference to a deleted script remains. Diff and final link checks
  pass. Old complete eight-stage receipts remain read-only verifiable; repository
  import and historical-study restore/rerun are deliberately retired, not tested
  as current requirements. Original Git commits and published packages are untouched.
- Proofs and optional HTML comparison are outside the repository:
  /var/folders/4t/l1rh16096gnd19k20pxhc5lr0000gn/T/skillfit-archive-removal-hbq8f6rg.
  Zero model calls, real agent CLI calls or actual user-configuration writes.
  At P5 no new commit, push, PR, remote CI, registry verification or publication occurred.
  Validation was local on macOS/Node 24; remote OS/Node matrices were not run.

Q1 delivery review: all 65 paths accounted, zero skipped or remaining finding.
The previous 64 source/data inputs and OCR rules match exactly; reviewed the plan's
new delivery authorization and rechecked deletion/receipt consumers. Fresh full
`npm test`: 1,065 passed, zero fail/cancel/skip (71.0 seconds). Fresh acceptance
using the same hash-verified installed package passed 31 regressions, five portable
replays and four release-document checks; all 1,079 installed files still match
current source. Architecture: 159 modules, zero violations; docs: 34 entries,
zero errors and 171 prior paths/headings accounted. Seven fixture moves retain
original bytes. Contributed bench input closure is unchanged; P5's eight-bench /
36-task offline result remains applicable. Proofs: /var/folders/4t/l1rh16096gnd19k20pxhc5lr0000gn/T/skillfit-cleanup-delivery-tfy8ptfd.
No real model/agent calls, user-configuration writes, remote CI or PR.
The authorized remote branch still points to baseline 5696bfa before delivery.

## Previous verified input

C1–C5: Agent environment/health collection belongs to Agents; Records receives
facts and uses typed Session details; trigger presentation belongs to CLI.
Local acceptance: 1,092 tests passed, zero skipped; 157 architecture modules,
39 documentation entries, 24 old anchors/paths; installed bin/Skill/34 public
pages, 31 retained regressions and five portable replays passed. Package had
1,086 files, SHA-256
4bad2ef8883d381f6848be4289831f4402deb845fcf972191ed036ff67ab2616.
These results describe the pre-N1 input, not the new edits.

Historical acceptance: all 19 archives + 1,583 support files restored with exact
hashes; 18 frozen replays plus one export-hash check passed on Node 24.21.0 /
macOS arm64. C1–C5 revalidated their unchanged closure and 38 log digests and
explicitly reused those results. An earlier intermittent historical replay
failure was not root-caused; retain that limitation when interpreting later
successful replays. Never rewrite an archived observation.

Earlier F1–F8/D1–D3/A1–A5/V1 and S2–S5 work remains in Git history. The local
implementation commit is `b68ebd3ee7d7676c5829459915c1d07e0ceb563d`; its direct
push was rejected because main required PR/status checks. No new delivery is
implied by this plan. Prior full source plans and receipts remain at the
[fixed source documentation](https://github.com/remote-controlled-man/skillfit/tree/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs).


## Previous delivery

N1–N5 / D1–D3 completed before this task: 1,099 offline tests, 159 architecture
modules and 36 registered documentation entries passed; installed features passed
31 regressions and five portable replays. Historical restoration then verified
19 archives and 1,583 support files. Those are baseline results, not proof for
this cleanup. Delivery branch and local HEAD matched 5696bfa; remote main remained
3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850. No PR or remote CI was created.

Previous full plan: [fixed source](https://github.com/remote-controlled-man/skillfit/blob/5696bfa32cf28a5fc11d8d5da237f5d070a3cf17/docs/work/current.md).

<!-- Retained inbound anchors. -->
<a id="当前执行状态"></a>
<a id="ownership-follow-up--execution-order"></a>
<a id="previous-cleanup-baseline"></a>
<a id="framework-follow-up--execution-order"></a>
<a id="delivery"></a>
<a id="previous-delivery"></a>

<a id="final-review-and-delivery"></a>
<a id="decisions-and-safety"></a>
<a id="remaining-research"></a>
