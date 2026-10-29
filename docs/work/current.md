# Current work

## Status

Scope of this file: it holds the active task, stopped-and-incomplete pilots, the
plan table with its acceptance column, and live decisions and limits. Completed
delivery, integration, preview, cleanup and verification logs were retired to Git
history rather than kept inline, on the same reasoning that removed the eleven
per-page snapshot footers: history serves the purpose without a growing local
index, and this file had reached 1,772 lines of which roughly 1,193 were finished
narrative. Nothing was discarded — the retiring commit's parent holds every byte,
and `docs/work/` may not gain a sibling archive because check-docs requires the
sole plan to be updated in place. Before retiring a section, confirm its
load-bearing facts already appear below: the external receipt and study locations,
`npm latest=0.14.0`, the 18 receipts, the 1,079 packaged files and the
no-republish rule all live in this Status block or the plan table, and the one
fact that did not (the registry publication timestamp) was promoted here first.

- Current task T2: verify the repaired source and standalone workspace without
  model calls, fix any reproduced compatibility gap, and commit the scoped
  verified source changes as requested. The initial offline reproduction lost
  valid Codex cumulative counters after a `token_count` notice with `info: null`.
  Reuse the existing reader/executor tests: ignore only absent
  counter notices, keep malformed numeric/identity/monotonicity refusals, and
  prove partial recovery plus during-call stopping before final review. Do not
  restart old studies, refresh their frozen runtime, modify global configuration
  or commit retained experiment data. The standalone workspace remains separate.
  T2 verification: the regression failed before the fix; all 14 adapter tests
  now pass, including failed-child recovery and the four live Token stop lines.
  The original timeout log yields partial input/cache/output 169015/161920/1759
  through both explicit-home and CODEX_HOME paths; its saved files are unchanged.
  Final npm test: 1,080 pass, zero fail/cancel/skip. The first restricted run's
  sole failure was the fake HTTP listener's EPERM; the complete local-permission
  rerun passed. CLI doctor has zero failures and one unrelated Claude import
  warning; the installed skillfit command links to this rebuilt checkout.
  Standalone verification passes 33 tests without skips, four case controls and
  three native permission profiles. One integrated OCR review covers all three
  changed files (one selected, two manually included), no unresolved findings;
  Codex supplied the review, without an independent model. New model calls: zero.
  Real activation/effectiveness remains untested; stopped studies remain incomplete.

- Previous task T1: explicit Token-first control is implemented and verified
  offline. Preserve
  legacy omitted/numeric deadlines and five-number budget semantics. An explicit
  `executorTimeoutSeconds: null` disables the Agent deadline; an explicit
  `spendingBudget.durationSeconds: null` selects Token-only, during-call stop
  lines on supported Codex usage observation. Retain elapsed timing, finite call
  ceilings, manual cancellation, process cleanup and verifier/tool deadlines.
  Local cumulative counters are delayed lower bounds, not a provider billing
  hard cap. Missing counters never become zero or final usage. No new model
  call, study restart, maintained document, dependency, commit, CI or publication.
  T1 progress: explicit-null parsing/CLI preview and legacy refusals pass; four
  live Token lines, cumulative replacement, preceding-call subtraction, manual
  cancellation and moved partial-record replay pass offline. The first full
  suite exposed two error-label compatibility regressions; restored the original
  executorTimeoutSeconds label and both affected CLI regressions pass. Historical
  pilot-001/pilot-002 native read/export/moved verification and reproduction pass
  with zero model calls; all 326 files/modes in each group are unchanged. Temporary
  proof: /var/folders/4t/l1rh16096gnd19k20pxhc5lr0000gn/T/skillfit-t1-history-xdw1vmii/result.json.
  Final npm test: 1,088 pass, zero fail/cancel/skip (72.245 seconds), including
  package/install and saved-replay checks. The integrated review accounts for
  all 38 changed paths (27 OCR-selected, 11 manually included docs/tests), zero
  skipped paths and no unresolved product findings; Codex performed the review
  using OCR rules, without an independent model/reviewer. It hardened the
  no-deadline fake-process cleanup and timestamps; all 13 affected adapter tests
  pass after that test-only change. Production code is unchanged from the full
  passing suite. Review inputs/results are in OS temporary skillfit-t1-review-cozxmca6.
  Final docs/anchor, architecture and diff checks pass; no new tracked file or
  source runs directory. This completes T1's source/offline scope, not P2/P3's
  still-incomplete real paired experiment. No commit/push/release or paid retry.
  T1 plan review: use the existing executor run seam, numeric-only Codex session
  reader, budget recorder and cancellation path. Retain a reached live
  counter/source in the existing partial receipt and budget events, without
  adding per-update files or a telemetry store.
  Require the live observation capability for Token-only/no-deadline execution;
  reject unsupported combinations before dispatch. P2/P3 remain stopped and
  immutable; their intended paired experiment is still incomplete.

- Previous P3 attempt ran one authorized, more permissive pilot-002 pair
  after a fresh preview: same frozen inputs, model/global settings and graders;
  trials=1/maxCalls=2, executor deadline=600 seconds. Whole-batch stop lines:
  input=1,200,000, cachedInput=1,050,000, uncachedInput=200,000, output=30,000,
  durationSeconds=1,200. These include a margin above P2's observed partial
  trajectory; they are between-call stop lines, not a provider billing hard cap.
  P3a passed: ready preview, unchanged inputs/runtime/settings, saved login and
  old-record baseline verified. P3b stopped after its first baseline call reached
  600 seconds, with no token stop line reached; the treatment was not invoked.
  The stream also logged six connection/reconnect errors, including TLS EOF and
  waiting for network, during review. P3c passed stopped-record reproduction
  and post-stop 8/8 grading on a copy; the intended completed pair remains
  incomplete. No new paid attempt. Keep
  pilot-001 stopped and immutable; no automatic retry, extra cohort, global
  settings/code change, new document, commit, CI or publication.
  Previous P2 executed the user's authorized fixed pilot-001 batch, then
  reads/audits its records and verifies disposable portable replay if supported.
  Keep P1's exact request/digest, four-call ceiling, five spending stop lines and
  240-second executor deadline; no retries, replacement calls, extra models,
  calibration, new document, source change, commit or remote CI. P2a passed:
  saved ChatGPT login is present; request, 23 input files/modes and exact ready
  preview were unchanged. P2b stopped after the first baseline call hit its
  240-second deadline; 1/4 calls attempted, no treatment call or paired result.
  Partial recovered input/cache also exceeded their stop lines. No retry.
  P2c passed stopped-record read/export and moved portable verification/replay
  without new model calls; all 326 native files stayed unchanged. The intended
  completed four-call workflow remains incomplete; no quality/Skill conclusion.
  Preparation P1 produced one real-pilot proposal and zero-model-call preview
  in its owning workspace. Reuse oss-normalize-url/query-shape and the existing
  repository's vibe-coding candidate; two balanced paired trials mean four Agent
  invocations. Initial ponytail preview was blocked by an existing global Skill
  conflict; retain that observation here and do not change global configuration.
  P1a-P1c preparation is complete: frozen input copies and request, passed
  offline Bench gates and ready dry-run, four proposed Agent calls with five
  spending stop lines. No model/Agent CLI invocation or run output was created.
  P1 did not authorize live execution; P2 now supplies that bounded authority.
  Actual CLI flags/backend remain unverified until attempted. No maintained document, mechanism, calibration,
  commit or CI is added.
  R9 review and integration are complete. PR #61 merges 9244d61
  and the preceding R6/R7 closeout as main df3dedc; PR/main CI each passed all
  eight jobs, and exact-main full three-OS receipts are verified. Corrected the
  driver's remaining source-relative self-test example and verified external
  records, moved replay and all 1,073 local offline tests. No open review findings,
  application/default change, new model call or npm workflow/publication.
  R8 study/workspace separation and current guidance are complete.
  The complete ponytail study is retained at
  ~/Documents/skillfit-workspaces/ponytail-efficiency-20261026 with all 481 files
  unchanged. Reading and moved replay pass with the old path absent; source runs
  remains absent after tutorial and full offline checks. dist stays build output;
  CLI defaults/formats are unchanged. R8 introduced no new model calls,
  npm publication, PR, remote CI, GC or workspace-management mechanism.
  R7 durable release-proof delivery and documentation housekeeping
  are complete. One external 0.14.0 delivery is retained and verified; the existing
  release manual and this sole plan form the reviewed branch delivery. R7 introduced
  no PR, remote CI, npm publication, automatic cleanup or real experiment. Documentation
  joined main through the user-authorized R9 PR. Final CI observations
  are delivered on the retained source branch without a status-only PR/CI cycle;
  protected-main rules are preserved.
  R6 review and integration of repair 5f3c0ec are complete through
  PR #60 and main 7514936. Both PR/main CI passed all eight jobs. No npm
  publication, workflow dispatch, repack or new release is authorized in R6.
  R4 publication/registry acceptance are complete through verification-only
  recovery. R5 integration/preview are complete;
  R2 source delivery and candidate preparation are complete;
  B1–B5/C1–C4 are complete. The user approved continuing delivery/preparation.
  Original published source: PR #59 is merged as b6c804b; its main push CI
  40357729252 passed all eight jobs and verified full three-OS receipts.
  Formal 0.14.0 preview 40359981385, attempt 1, succeeded; its original archive,
  source/CI identity and all 1,079 packaged files are verified. After its
  successful prepublication review, formal publication run 40437444187,
  attempt 1, uploaded the original reviewed preview successfully. Its post-upload
  CLI loading failure is preserved; the bounded source-tool fix and existing
  recover command completed all six acceptance stages in a fresh external
  attempt. npm latest=0.14.0 (registry publishedAt 2026-10-27T02:18:01.991Z),
  18 standalone receipts verified, and all 1,079
  installed files match the reviewed package/source. Source-tool repair is now
  merged through PR #60 as main 7514936. Its tree equals checked head 63ae1e7;
  main CI 40440668681/1 and its full three-OS receipts are verified. R6 has no
  remaining runtime acceptance gap. R7's complete 0.14.0 delivery is now saved
  and verified at ~/Documents/skillfit-releases/0.14.0; the existing release
  manual no longer claims candidate status. All local closeout checks passed.
  R9 completed protected-main documentation synchronization in one PR.
  Never upload 0.14.0 again.
  Defer automatic deletion: do not add it to this release's execution steps;
  revisit only if an owned disposable temporary-directory leak is evidenced.
  There is no new cleanup service, timer or runs expiry requirement.
- Baseline: 8d8ff24c7adddb0cc1e7f3653a56baddeefef363, clean checkout. Eleven
  Bench manifests index 51 tasks; the eight contributed datasets own 36 tasks.
  The 858 tracked Bench files include 342 fixture and 315 reference files.
- Scope: generated task layout, all eight contributed datasets and their actual
  consumers, existing dataset cards/format/authoring/workflow/architecture docs,
  current installed acceptance, affected offline tests and documentation data
  exclusions. Reuse this sole plan and existing checks. Preserve the public Bench
  root paths, task ids/order, schema 1/2, CLI flags and historical saved readers.
- Required result: maintainable tasks use tasks/<id>/; one manifest indexes the
  executable inputs. Shared graders stay once per dataset. Bench names/cards
  describe workloads rather than a personal study. Explicit native runs, derived
  work and exports keep their established separate locations and retention rules.
- Verification: test-first new authoring/legacy reading, 11 Bench gates, unchanged
  task/fixture/reference provenance, docs/architecture gates, complete offline
  suite, fresh actual npm pack/install and portable replay for new and old layouts.
  B1's temporary baseline and previous native records preserve before/after proof.
- Delivery boundary: PRs #58/#59 and the one 0.14.0 upload/recovery are complete.
  R6 authorizes one repair PR, existing CI, protected merge and automatic main
  CI. Preserve all original release artifacts and verification gates; do not
  publish again, add automatic deletion, run paid experiments or create another
  unrelated PR. Update this sole plan after each phase without restarting CI
  merely for progress text.
  R7 is documentation/delivery housekeeping only: use the existing source branch,
  defer its protected-main integration to the next normal authorized PR, and keep
  the original package, failed publication run and successful recovery distinct.
  R9 is that authorized integration: review all seven existing documentation paths,
  preserve both durable deliveries, run only the existing necessary CI, merge
  after checks pass and verify main. Do not dispatch the npm workflow or create
  a second unrelated PR. Keep progress local while each CI run is active.
- Source baseline: c9522ddea4c181056f1065e04f3ee0f69845146a, clean at this phase's
  start. At that point the remote delivery branch was 8d8ff24c7adddb0cc1e7f3653a56baddeefef363;
  remote main was 655bccaa384bbc3d0dc5602e76efa63968272ece. Official npm
  registry returns latest=0.13.1 and HTTP 404 for 0.14.0 at preparation time;
  reserve no version and recheck availability before any future upload.


## Execution order and acceptance

| Order | Work / dependency | Status | Acceptance / verification |
| --- | --- | --- | --- |
| T2 | Verify source/workspace and close empty-notice regression | Complete; regression, offline suite, native workspace and integrated review passed | Valid counters survive empty notices before/between/after snapshots; malformed counters and wrong identities remain unknown. Exercise failed CLI recovery and all four during-call Token stop lines using fake children; run full npm test, CLI doctor, standalone checks and one final integrated review before the authorized scoped commit. No model calls or historical-record changes. |
| T1a | Review compatibility and declare Token-first acceptance | Complete; source/counter/stop paths reviewed | Explicit null is additive; omitted and positive settings retain normalization. Reuse the existing run seam and receipt mechanisms; keep frozen old requests and evidence unchanged. |
| T1b | Implement explicit disabled Agent deadline and Token-only request; after T1a | Complete; legacy/null parsing and support refusal tested | Test first: parse/preview null, preserve legacy numeric defaults, reject invalid and unsupported execution surfaces before calls. Record timing with a null deadline; keep cancellation, output bounds and local verifier/tool timeouts. |
| T1c | Enforce Token stop lines during supported calls; after T1b | Complete; all four Token lines, cumulative accounting, cancellation and moved stopped replay passed | Offline fake Codex processes only: cumulative updates replace the current-call snapshot; add settled earlier calls once. Stop the tree at a reliable reached update, retain partial counters/source and a typed spending stop; no next call or grading of interrupted output. Cover no counters, identity mismatch, invalid/regressed counters and normal completion/cancellation. |
| T1d | Verify docs, historical readers/replay and final inputs; after T1c | Complete; 1,088 offline tests, historical replay and 38-path review passed | Update existing spending-control owners, schema, generated help/reference, driver and Unreleased entry; no new document. Run full offline npm test, docs and architecture gates; verify historical request normalization and read/export/moved replay without changing retained bytes. Complete one integrated review and update actual results here. No real models or remote delivery. |
| P3a | Declare wider finite limits and review a fresh preview | Complete; ready unchanged-input preview reviewed | User authorized more leeway after the P2 retrospective. Reuse the same 23 frozen input files, Bench/grader, configured model/effort/service tier and development policy. Fresh request-relaxed.json/preview-relaxed.json, runGroup=pilot-002, one trial/two calls, 600-second deadline and the five explicit stop lines above. Check nested readiness, saved login, exact hashes, old-record invariance and fresh output. |
| P3b | Execute the one newly authorized pair; after P3a | Stopped after 1/2 calls; completed pair remains incomplete | Use only the reviewed digest/request once. Keep both conditions' real outcomes, errors, timing and complete/partial usage; no retries or replacement. No additional cohort if stopped. One pair is a workflow pilot, not efficacy/adoption validation; do not pool P2's stopped baseline. |
| P3c | Verify actual record, grades, costs and portable replay; after P3b | Complete for stopped evidence; real pair remains incomplete | Read native evidence and reproduce a moved complete temporary export offline. Check request/policy/runtime bindings, preserved raw files and actual coverage; retain incomplete results honestly. Remove only owned redundant replay scratch, update this existing plan and run docs/diff checks. No extra model calls, maintained document or remote delivery. |
| P2a | Verify live prerequisites and exact approved preview; after P1 | Complete; saved login and frozen preview verified | User authorized this fixed small real run on 2026-10-28. Check saved login status without logging in or exposing credentials; re-preview the unchanged request and require P1's exact digest, ready nested environment, frozen input bytes and absent pilot-001 output. Keep all four-call/token/time limits. |
| P2b | Execute one bounded real batch; after P2a | Stopped after 1/4 calls; execution incomplete, no retry | Confirm only the stored request/digest from the actual workspace, once. Retain its native records/stdout/stderr, grades, actual usage and any error/stop. No retries, replacement, scope/budget expansion, old-study restart, judge/calibration/drafter/subagent calls or global configuration edits. A stopped batch remains stopped. |
| P2c | Read native evidence and test saved delivery; after P2b | Complete for stopped records; four-call outcome remains incomplete | Use saved read/audit and a fresh disposable portable export/replay with zero new model calls. Preserve raw failures/unknowns and intact native indexed files. Record actual grades/costs, replay result and limits here; remove only owned duplicate replay scratch after verification. Do not turn this development pilot into efficacy/adoption evidence. Run docs/diff checks; no new maintained documents or publication. |
| P1a | Select an existing Bench and bound the pilot question | Complete; initial global conflict identified, final candidate selected | Reuse oss-normalize-url/query-shape (one real defect, 21 files/80,732 bytes, no external dependencies) and the existing repository vibe-coding Skill, which applies to this regression task. The initial ponytail dry-run was planned but its nested environment was blocked by global-name contamination; do not rename it or bypass that guard. Development pilot only: verify installed paired execution, regression grading, costs and later saved replay; no efficacy, efficiency, activation or adoption claim. Inspect current contracts and trusted offline graders. |
| P1b | Freeze minimal inputs and check them offline; after P1a | Complete; exact copies and offline gates passed | Create one fresh owning workspace outside source/old studies, preserve all copied Bench/Skill bytes and licenses, and keep the request plus observed preview/check JSON there. No new prose document or generic storage layer. Run offline Bench gates on that copy; confirm no source runs and no real-model dispatch. |
| P1c | Preview exact calls/budget and record acceptance; after P1b | Complete; ready dry-run, zero model/Agent calls | Request development/installed workspace delivery, no harness-installed baseline Skill, Codex, query-shape, two balanced trials, maxCalls=4, no judge/calibration/drafting. Propose all five spending stop lines and a 240-second executor deadline; execute only --dry-run, check nested readiness, frozen hashes, exact workspace paths and absent run output. Record digest, caveats, retention and docs checks in this plan. P1 authorized no live calls; subsequent P2 authorization is recorded separately. |
| R9a | Review cumulative closeout and external records | Complete; one example omission fixed, no open findings | Freeze main 7514936/head 9244d61 and account for all seven existing Markdown files. Correct the remaining driver command's workspace ambiguity, execute it outside source, verify 481 study files/modes and 33 release files/18 receipts, and read/export/replay with the old path absent. Check docs and npm test; no new model calls or native changes. |
| R9b | Deliver one combined closeout PR; after R9a | Complete; all PR checks passed | Push reviewed documentation and original-plan follow-up non-force, create/attach one PR and wait for all eight existing CI jobs plus security on the exact head. Existing classification is full for this scope; do not change workflows, weaken checks or push progress-only updates during CI. No npm workflow. |
| R9c | Merge and verify exact-main closeout; after R9b | Complete; main CI and full three-OS receipts passed | Normal protected merge with checked head and clean message; require identical merged tree and original publication/study ancestry, all eight automatic main checks and same-attempt full three-OS receipts. Confirm source runs absent and retained bytes unchanged; record final status in this original plan without another CI-only PR or npm upload. |
| R8a | Inventory study ownership and migration baseline | Complete | Source contains one stopped study, 481 ordinary files/2,444,971 bytes and no links/special files. Freeze every file hash/mode and native report; confirm no active study executor. Native identity, two completed calls, costs and original failure must remain unchanged. |
| R8b | Move the complete study to its owning workspace; after R8a | Complete; byte-identical move and replay passed | Use fresh ~/Documents/skillfit-workspaces/ponytail-efficiency-20261026 as this study's working directory, not a new global output default. Move all bytes intact with collision checks and rollback on verification failure. With old source path absent, read/audit, export and actually replay a moved portable package offline. Preserve all indexed native files and historical launchers, never rewrite old paths/hashes or restart the stopped pilot. |
| R8c | Correct current source/workspace guidance; after R8b | Complete; existing guidance corrected | Update only existing agent/architecture/workflow/tutorial/driver guidance and this plan. Explain caller-workspace ./runs versus source dist, source-dev OS temporary work and external release receipts. Make tutorial commands execute from the actual workspace with the compiled CLI addressed explicitly; keep public flags/defaults, native layout and historical evidence unchanged. No new page or framework. |
| R8d | Verify examples and deliver; after R8c | Complete; tutorial, replay and offline checks passed | Execute the changed zero-model tutorial in a fresh OS temporary workspace, verify native/report/export/moved replay and unchanged checkout inputs. Run docs/anchors and repository-required npm test before commit; confirm source runs stays absent, study hashes/meaning unchanged and private lab untouched. Commit/push only reviewed existing guidance on the original branch, no PR/remote CI/npm upload. |
| R7a | Retain verified 0.14.0 delivery outside temporary storage | Complete; copied bytes and records verified | Copy the complete original publication artifact, 18 hash-linked recovery receipts and existing failure/run/recovery observations into fresh ~/Documents/skillfit-releases/0.14.0. Preserve exact bytes, reject collisions/symlinks and verify the copied original tarball plus standalone records. No repository evidence/archive tree or new storage mechanism. |
| R7b | Correct existing release guidance; after R7a | Complete; existing manual corrected | Replace stale candidate/latest-version claims with version-neutral guidance in the existing release manual. Preserve original published documents, commands, history and links; record the durable proof location and actual verification here. No new page, version bump or package publication. |
| R7c | Review, verify and deliver housekeeping; after R7b | Complete; reviewed branch delivery | Run docs against actual main, inspect facts/diff and verify retained records at the final path. Complete repository-required offline checks before commit. Commit only the manual and this plan, push the existing branch non-force with no open PR, compare remote refs, and leave main 7514936 unchanged for the next normal integration. |
| R6a | Review 5f3c0ec and exact integration scope | Complete; no open findings | Freeze main b6c804b and head 5f3c0ec. Review all three paths, including the plan filtered by OCR, static-link initialization, public verify/recover entries and original recovery receipts. Run focused release checks, docs against actual main and npm test; retain unchanged 1,079-file package and fixed publication source. |
| R6b | Deliver one reviewed repair PR; after R6a | Complete; all PR checks passed | Commit only original-plan authorization/progress, push non-force, create and attach one PR. Wait for all eight unchanged CI jobs and security on the exact head, with no progress-only push/retry during CI. No npm workflow dispatch. |
| R6c | Merge repair and verify exact-main CI; after R6b | Complete; main CI and full three-OS receipts passed | Use a normal protected merge with an explicit clean message and checked head. Verify merged tree, consumed ancestry and unchanged published bytes, then require all eight automatic main jobs and same-attempt full three-OS receipts. Update/deliver final plan status on the existing branch, verify remote refs and retain original release failure/recovery truth. Never republish 0.14.0. |
| R5a | Reconcile authorization, actual main and existing release gates; after R2d | Complete | Remote main is 655bcca and candidate is 90e9b83, with no open PR. Reuse byte-identical installed/local proof; preflight the actual main docs baseline and CI scope before creating the PR. Found 108 false compatibility failures for moved historical Bench data; preserve the failure log. |
| R5b | Fix historical input classification and review affected inputs; after R5a | Complete | Test first through the existing baseline-reader/documentation gate. Use the fixed baseline's existing exclusions for its task data, retaining real document/card paths, private-path protection and missing-evidence failures. No retired-path catalog, broad bypass, restored inputs or new document. Verify targeted tests, exact-main docs gate, architecture and npm test; packaged bytes must remain identical to R2c. |
| R5c | Deliver one PR and wait for existing CI; after R5b | Complete; PR #58 checks passed | Push the reviewed plan/tool fix once, create one PR with actual behavior, tests and AI disclosure, and attach it. Reuse the unchanged CI workflow; all eight checks, including three required OS jobs, must succeed. Preserve exact source and avoid status-only pushes during the PR run. |
| R5d | Merge and validate exact-source main CI; after R5c | Merged; main Windows CI failed | Use an explicit clean merge title/body to retain pinned source ancestry and avoid old skip markers. Verify merged product tree and intended deletions, then wait for the automatically triggered main push CI. Require its exact three full OS receipts; PR/local proofs cannot replace them. |
| R5f | Diagnose main Windows startup failure and prepare the bounded test fix; after R5d failure | Complete locally; repair delivery authorized | Preserve failed run/receipt. Reproduce the exact readiness assertion with a delayed offline harness, distinguish setup readiness from interruption semantics, and verify the smallest test-only envelope correction. Keep kill-tree, usage/sealing assertions and the post-interrupt 10-second deadline. Run affected tests/full offline suite and review package-byte identity. The user subsequently authorizes R5g–R5h; do not bypass source CI or start preview/publication early. |
| R5g | Deliver the authorized bounded test repair PR; after R5f | Complete; PR #59 checks passed | Reconcile unchanged reviewed inputs, update this original plan, commit only the test/plan, push non-force, create and attach one repair PR. Existing eight CI jobs must pass; preserve all interruption assertions and package bytes. No status-only push while checks run. |
| R5h | Merge repair and validate exact-main CI; after R5g | Complete; main CI and three OS receipts passed | Merge the exact checked repair with a clean message. Confirm main product bytes and consumed commit ancestry; require the automatically triggered eight main checks and the same-attempt full three-OS source receipts before preview. Retain the original failed run; no blind rerun or weakened gate. |
| R5e | Generate, inspect and retain the formal preview; after R5h | Complete; preview 40359981385/1 verified | Dispatch npm-release.yml once on the verified main with dry_run=true. Download the exact successful run/attempt artifact, validate source/CI identities, original tarball integrity/version/size/package bytes and summary. Retain the complete artifact externally; update this original plan without moving main after preview. Never upload npm or claim registry/provenance/signature acceptance during a preview. |
| R2a | Review scope/version and deliver reviewed base | Complete | Keep auto-deletion deferred. Read official registry and exact remote refs; verify no open PR or branch-triggered CI. Push c9522dd non-force to the existing branch and compare the remote SHA. Use that delivered full source commit for standalone behavior links. |
| R2b | Synchronize 0.14.0 candidate metadata and existing docs; after R2a | Complete | Update package/lockfile/changelog and current bilingual README/Skill/docs version pins together; retain old publication snapshots, feature minima and historical command blocks. Clearly distinguish candidate package semantics from registry availability. No new document or publication claim. |
| R2c | Review and verify the final candidate locally; after R2b | Complete | Single integrated OCR-guided scoped review plus reused unchanged-source proof. Run docs/link/version/architecture gates and npm test. Actual fresh offline pack/install, installed current feature recipe, Skill/docs, public preview and moved replay must pass without model calls or real configuration writes; keep proof outside source. |
| R2d | Commit/push candidate preparation and reconcile status; after R2c | Complete; payload 70304aa verified | Commit only reviewed candidate metadata/docs/plan with a clean message, recheck no open PR or non-main push CI, then push non-force to the existing branch, and compare remote/local SHA with unchanged main. Record actual results and pending integration/publication gates here. No PR/remote CI/main merge/npm upload. |
| C1 | Audit ignored runs, consumers and recoverability; after B5 | Complete | Inventory the 36 roots/107,908 files/1,305,113,411 bytes; check active processes and tracked consumers. Compare actual native observations with fixed published packages, not folder names/status. Identify unique retained records and disposable copies before deletion; keep proof outside the repository. Review the explicit cleanup selection. |
| C2 | Remove obsolete local work and reconcile existing guidance; after C1 | Complete | Delete explicit unused whole scratch/duplicate directories only after C1. Keep any unique required native/cost/diagnostic populations intact and verify relocation if needed. Leave runs with only named, needed experiment workspaces, or empty when records are covered or the owner explicitly retires unmatched originals. Development/package/release scratch uses OS temporary or explicit external workspaces; do not add a GC command, archive catalog, new document or change CLI defaults. |
| C3 | Verify final tree and cleanup; after C2 | Complete | Reuse B4 review/installation/replay proof only for identical bytes; review new docs/plan and any changed inputs. Check retained/published hashes, actual replay, source/package exclusions and absent active consumers; run docs/architecture checks and npm test before committing. Never weaken checks or delete private workspace4skills. |
| C4 | Commit the reviewed Bench and cleanup guidance; after C3 | Complete locally | Stage only reviewed task source/docs/assets; ignored local deletions must not enter the index. Commit with [skip ci], confirm recorded tree and clean source status, and record progress/results in this sole plan. No push, PR, remote CI, publish or paid evaluation. |
| B1 | Consumer inventory, alternatives and design review | Complete | Confirm 11 manifests/51 tasks/8 contributed datasets, schema-independent relative paths and actual generator/grader/test/recipe consumers. Preserve root names/task identities and frozen proposals. Choose task-local inputs without a new format/flag/registry; review failure/rollback cases before editing. Save immutable baseline hashes and an old-layout native result outside the repository. |
| B2 | Implement task-local authoring and curated inputs; after B1 | Complete | Two disjoint parts may proceed together: generator init/freeze/from-commit/drafting share a task-layout convention; migrate all 36 contributed tasks, leaving genuinely shared graders once per dataset. Preserve source/fixture/prompt/license bytes, provenance and protections, public root paths and task ids/order. Test new creation/capture and old-layout reading through existing interfaces. |
| B3 | Reconcile contracts, cards, data discovery and installed recipes; after B2 | Complete | Rewrite existing cards around reusable workloads, remove study-stage claims and fix input-mode/answer-isolation/mock wording. Exclude only each known dataset's task-data subtree from maintained-doc discovery. Current release recipe derives its two script lookups from manifests, preserving the hash-pinned original recipe and every check. No new layout option, schema, alias catalog or extra maintained page. |
| B4 | Integrated final review and compatibility acceptance; after B3 | Complete | Account for every move/edit/add/delete in one OCR-guided review. Run all 11 Bench checks, original/fix semantic regressions and frozen-input hashes; docs old paths/headings, architecture and full npm test. Fresh actual package/install must pass current installed feature recipe/five moved replays and read/export/relocate/replay the original old-layout native record. Confirm ordinary previews make zero model calls and reject collisions/symlinks. |
| B5 | Close this plan against final evidence; after B4 | Complete locally | Match every requirement to final-input evidence, distinguish moved-path/new Bench hashes from immutable old saved identities, check no unintended files/dependencies/archive/remote writes and record actual counts/limits. Leave implementation locally reviewable; no automatic commit, PR, CI, publish or live experiment. |
| D1 | Audit entry documents and review this scope; after M7 | Complete | Read root instructions, both READMEs, contribution/security routes, existing docs checks and package scripts. Verify external research claims against original sources. Use concise reader-focused guidance; no universal line-count rule, new template or personal agent-tool requirement. |
| D2 | Correct README navigation and contribution onboarding; after D1 | Complete | Put install/first preview before background/history. Keep all existing badges and fenced command/demo blocks byte-identical, mirror Chinese section order, preserve anchors and fixed links. Correct the post-merge source description, collapse repeated guide links and move detailed contracts to their existing owners. Add actual development setup and separate offline checks from optional paid calibration. |
| D3 | Clarify project-specific agent guidance; after D2 | Complete | Keep commands runnable from the repository root and ownership concise with the architecture link. Preserve skillfit-driver routing, offline tests, zero runtime dependencies, CLI/bilingual conventions, writer backups/rollback, private lab protection, immutable observations and current replay. Retain all previous heading anchors; add no generic approval or agent-specific tooling mandate. |
| D4 | One integrated final review and local acceptance; after D3 | Complete locally | Account for all five paths, review instruction changes against baseline and verify bilingual blocks/badges/headings, original snapshots and anchor migration. Execute new contributor commands and existing docs/entry checks; fresh offline pack/install and installed recipe must preserve installation and five portable replays. Record actual results and limits here; leave edits local. |
| D5 | Recheck final inputs and pre-commit validation; after D4 | Complete | Compare all five content hashes with D4, reuse the integrated review only for unchanged inputs and inspect this plan follow-up. Preserve installed 31-regression/five-replay proof only when every packaged byte still matches. Run npm test once with loopback listening allowed, retain docs/anchors/version/diff checks and record actual results. |
| D6 | Commit and push the reviewed documents; after D5 | Complete; payload df2d6eb verified | Confirm the remote branch is still the expected baseline and has no open PR; check workflow triggers. Commit only the six planned paths with [skip ci], push non-force to origin/codex/docs-framework-architecture, and independently compare remote/local HEAD and unchanged main. Record delivery in this sole plan with a status-only follow-up; verify its final ref in the handoff. No new PR or remote CI. |
| W1 | Reconcile audit findings, consumers and plan | Complete | Reviewed the 11 docs pages, release workflow inputs/order, existing output guards, session sealing and export inventory. Use current owners and commands; keep cleanup a documented explicit manual operation. No unresolved contract choice requires a new mechanism. |
| W2 | Correct document purpose and release manual; after W1 | Complete | Remove obsolete page-count/restoration assertions. Correct reference/how-to registry kinds. Keep one operation authority: workflow for steps, reports for saved fields, metrics for statistical meaning. Complete the existing release page with main/source-CI gate, reviewed preview ID/attempt, original tarball promotion, one upload, acceptance, receipt delivery and failure recovery. Validate instructions against current workflow/tools offline; do not dispatch them. Preserve old headings/anchors and frozen statistical meaning. |
| W3 | Implement workflow and data-handling rules in existing guides; after W2 | Complete | Explain design→offline gates→separate development/calibration→fixed validation/preview→execution→sealed read/analysis→optional delivery→retention/cleanup. Use an ignored outer study workspace with unchanged native batch layout. Separate memory-only values, observed facts and derived metrics. Declare consumers, provenance/unknowns and manual cleanup conditions; protect active/referenced batches and every indexed native file. Clarify custom analysis is not automatically exported and retention intent is separate from native completion status. Link concise rules from architecture/Bench/Skill instead of duplicating them. |
| W4 | Integrated review, runnable example and installed acceptance; after W3 | Complete | Review every final path plus metadata, source facts and links against exact baseline. Run existing docs/release/CLI-reference checks. Execute the complete zero-model tutorial in a fresh temporary outer workspace; derive output outside sealed runs and verify unchanged native bytes/export after analysis. Actual offline npm pack/install/bin/Skill/docs and installed feature recipe must pass 31 regressions and five portable replays. Confirm runtime/manifest/tool behavior unchanged. Full npm test only if code/build behavior changes; otherwise reuse the exact HEAD suite (1,065 pass) and execute affected checks. Record actual results and limits below. |
| W5 | Final review and authorized branch delivery; after W4 | Complete | Freeze/review all 12 modified paths, confirm exact installed acceptance inputs, run `npm test` before committing plus final docs/link/diff checks. Preserve installation and moved replay, use `[skip ci]`, push only the named branch without force, and verify the remote commit equals local HEAD. Update this plan with actual proof and delivery status. |
| L1 | Resolve distribution/link rules and review this plan; after W5 | Complete | Account for repository pages, source-only plan/tooling, standalone Skill and npm documents. Use relative links only when the target ships together; otherwise use an existing reviewed commit containing the described source. Keep published npm instructions distinct. No new release or branch mutation. |
| L2 | Reproduce and close the offline check gap; after L1 | Complete | Add a failing regression through existing documentation checks: version-sensitive same-repository blob/tree links cannot silently follow main, a tag or another moving ref. Permit full commit snapshots and unrelated external/live policy links. Retain relative file/anchor checks and offline/shallow-checkout operation; no Git-history fetch or network crawler. |
| L3 | Correct current links and build/version entrances; after L2 | Complete | Keep together-shipped links relative; pin standalone Skill/source-only references to the already delivered ed5eaff snapshot. Replace misleading current-plan URLs with the explicit source-only path, since the plan does not ship in npm. Make published/current-source entrances explicit in existing README/Skill/docs/release pages; keep bilingual blocks identical, add an explicit reviewed checkout to the source quickstart, and preserve historical/npm command blocks, links, command pins and feature minimums. |
| L4 | Final integrated review and local installation/replay acceptance; after L3 | Complete | Run full offline npm test, final docs/anchors and package checks. Actual fresh npm pack/install, bin/Skill/doc links and installed feature recipe must pass 31 regressions/five portable replays. Verify source-only targets remain excluded and no absolute main link bypasses the new check; inspect final inputs, preserve native bytes, and update this plan. No remote CI, PR or publication. |
| L5 | Review exact final inputs and deliver to the authorized branch; after L4 | Complete | Reconcile all 15 final paths and link/build/installed proofs, run full offline npm test before committing, update this plan, commit with `[skip ci]`, push only origin/codex/docs-framework-architecture without force, then independently compare remote/local HEAD. Preserve main, installation and replay; record actual results and source delivery. |
| R1 | Review integration/release scope; after L5 | Complete | Compare the delivered HEAD with the last verified main baseline, identify user-visible changes and exclusions, and name the required source/version/package/acceptance steps. This is local preparation, without registry availability claims or remote writes. |
| R2 | Prepare candidate version and local release inputs; after R1 | Complete; R2a–R2d above | Candidate 0.14.0, subject to an unpublished-version check. Synchronize package/lockfile/changelog and current README/Skill command pins, source-only availability notes and implementing-source snapshots; preserve historical minima and old publication links. Review the cumulative main-to-branch scope, then run local tests, actual pack/install/docs and portable replay. |
| R3 | Validate then integrate reviewed source; after R1 for this source-only merge | Complete | PR #57 merged as 655bcca after eight final PR checks; exact main push CI passed all eight jobs and existing source-CI collection validated its three full OS receipts. All intended deletions and consumed snapshot ancestry are preserved. No version bump, publication or paid experiment. |
| R4 | Preview, publish once and verify delivery; after R5e | Complete; one upload, six recovery checks and receipts passed | Inspect the exact preview attempt/tarball/hash, then promote those bytes for a new unpublished version. All six existing acceptance stages must pass; retain complete receipts externally and update this plan. Never repack between reviewed preview and upload, repeat an ambiguous upload or run real models. |
| M1 | Review actual merge baseline, rules and local CI entry; within R3 | Complete | Main remains 3a3ff4 and delivery branch 3404dcd; no open PR. Rulesets require a PR and windows/ubuntu/macos status checks. Exact-main docs gate currently fails 287 old path/anchor migrations; preserve that failure and fix it before claiming merge readiness. |
| M2 | Add bounded regression and exact-main snapshot navigation; after M1 | Complete | Existing docs gate must cover representative publication-era retained headings plus retired docs/evidence paths without requiring Git history in tests. Add only fixed snapshot links in existing docs/Bench indexes; preserve all original bytes at 3a3ff4, no restored archive or new page. Full actual-main gate must account for every old path/heading. |
| M3 | Local equivalent of the CI workflow and installed acceptance; after M2 | Complete locally | Existing full-scope CI entry passed 1,068 tests against exact main; public CLI/Bench steps, fresh installed 31 regressions/five portable replays, 29 installed documents and immutable snapshot targets passed. This is macOS/Node 24 working-tree acceptance, not remote or exact-source CI proof. No model calls. |
| M4 | Deliver reviewed candidate and resolve required remote route; after M3 | Complete; M6 subsequently authorized | Four reviewed paths committed and pushed only to origin/codex/docs-framework-architecture without force; independent source ref matched a59848a and main stayed unchanged. The user subsequently authorized M6's one PR/existing-CI route, without npm publication. |
| M5 | Review CI suitability and integration-message/history risks; after M4 | Complete locally | Current CI owner paths and gates remain applicable. A depth-two shallow PR merge and the proposed clean integration's PR/main-push shapes all select full scope and pass the 1,499 old path/anchor migrations. Product/package trees remain identical; only this plan differs. Found eleven CI-skip messages, default squash message aggregation and automatic branch deletion; M6 avoids those risks without changing CI. |
| M6 | One temporary integration branch and existing CI; after M5 | Complete; PR #57 merged as 655bcca | Retained source 5a3c9c8 and initial integration b5a052e have identical trees. Final candidate 153c014 adds only M6a's package-test envelope and plan updates; all 1,989 deletions remain. Final PR CI passed all eight jobs. Merged with explicit clean title/body, without protection, workflow/platform, publication or real experiment changes. |
| M6a | Diagnose and verify Windows package-test timeout; within M6 | Complete | Original Windows timeout preserved. Local suite: 1,068 pass, zero fail/cancel/skip. Final actual Windows CI: 1,065 tests, 1,064 pass, zero fail/cancel and one existing platform skip; offline install completed in 48,429 ms within the bounded 120-second envelope. Product deadlines and all assertions are unchanged; no claim of deterministic Windows reproduction on macOS. |
| M7 | Exact main CI, tree/deletion verification and final status; after M6 | Complete | Main run 40294723010 passed all eight jobs on 655bccaa384bbc3d0dc5602e76efa63968272ece. Existing source-CI collection validated three full OS receipts; source tree equals the reviewed candidate and all 1,989 deletions remain. This sole-plan follow-up incorporates main into the retained delivery branch, preserving six consumed pins. Verify the final pushed ref independently in the handoff; no new PR or CI run solely for status. |

## Real-pilot preparation (P1)

Authorized on 2026-10-28: prepare the proposal and dry-run only, in the actual
workspace; update this existing plan. No real model calls or calibration.

Question: can the installed/workspace paired path handle a real local bug fix,
retain regression grades/costs and later support saved read/export/replay?
This is a development workflow pilot. One task/two trials cannot establish
Skill efficacy or savings; keep the default conservative adoption policy.

Selected inputs: oss-normalize-url/query-shape (21 files/80,732 bytes, one real
upstream defect, protected assets and offline regression gates) and the existing
repository vibe-coding bundle (two files). Its bug-fix/test-first loop fits the
task. Initial ponytail dry-run was status=planned but nested environment=blocked
by GLOBAL_SKILL_CONFLICT at ~/.agents/skills/ponytail and ~/.codex/skills/ponytail.
That preview made zero model/CLI calls and remained memory-only. Selecting the
existing vibe-coding bundle avoids that conflict without renaming a Skill,
changing global configuration or adding isolation machinery. Inherited global
instructions/other Skills remain shared and not fully isolated.

Actual workspace: ~/Documents/skillfit-workspaces/query-shape-pilot-20261028.
At P1 completion only inputs/bench, inputs/vibe-coding, request.json,
bench-check.json and preview.json existed. All 23 copied input-file SHA-256/modes match their sources;
existing licenses/resources are retained. No new maintained Markdown or runner.
Proposed native output is ./runs/pilot-001; workspace runs/ and source runs/
were absent at P1 completion. Old stopped studies and published records are untouched.

Design: baselineSkill=null (no harness-installed Skill), Codex, installed
workspace delivery, query-shape only, purpose=development, two balanced trials.
1 task x 2 trials x 2 arms = 4 planned/maximum Agent invocations. No judge,
drafter, calibration or extra model/subagent calls. Each Agent invocation may
contain multiple internal model/tool turns; four is not a provider-request cap.

| Proposed whole-batch stop line | Limit |
| --- | --- |
| input | 240,000 tokens, including cached input |
| cachedInput | 200,000 tokens |
| uncachedInput | 80,000 tokens |
| output | 12,000 tokens |
| durationSeconds | 1,200 seconds of accumulated Agent execution |

Per-invocation executor deadline: 240 seconds. These are proposed stop lines,
not usage or a monetary quote; model/billing rates are unconfirmed. Checks run
between calls; in-flight work may overshoot, and missing/partial usage stops
further calls. No retry, replacement or automatic budget expansion.

P1b verified: Node v24.21.0, skillfit 0.14.0 from source checkout 7e47dc0.
The copied Bench's offline gate has five passes, zero failures, one INFO and one
warning. NOP fails, reference repair passes all eight facets, and the retained
regression fails on original/passes on reference. Missing trigger-negative
controls is retained as a warning: this paired pilot makes no activation claim.
Difficulty remains uncalibrated; no schema/claim or policy override was added.

P1c verified: eval --request ./request.json --dry-run from the actual workspace,
using the absolute source CLI path, returns planned with nested environment=ready
(four PASS, one UNKNOWN for authentication, one INFO for limited global scan).
Recorded preflight modelCalls=0/cliInvocations=0. Repeating that same dry-run is
byte-identical; request limits, four calls, paths and frozen inputs agree.
casePreflight/inputSnapshot remain pending as designed: live execution must
repeat gates/sealing before spending. Schema-1 measurementScope remains
legacy-unrecorded. Actual CLI flags, login and served model remain unverified.

- Plan SHA-256: 8758519ab04ec3d2358cf16b1187fa1f8fac2fed97f90a54f56e85442d930aaa.
- Implementation: 6e94715c917cbda71f592a260129c985efa7a6d919106a4459f6cb9dd8392ee7.
- Bench: af474475292f1699dcbdc0317b99badd49f4a6ca73a3706aea1df58067025afd.
- Candidate bundle: d28beeede405e7a2f1a05c4f9364c87e82d2b3b89660c4c0f09754dfdfcf5338.

P1 authorized no live execution. Subsequent P2 authorization covers this request
and budget; check saved login status and current preview digest first. Any input/runtime/
environment change requires a fresh preview. Do not restart the old pilot.
P2 acceptance is one bounded batch, honest grades/costs including stops,
native audit and disposable portable replay; none of that live work occurred in P1.

Retain this one proposal and its inputs while under review. An obsolete unused
proposal can be removed as a whole workspace after checking consumers. An
executed batch stays complete while its costs, interpretation or replay depend
on it, including failures. Keep temporary values in memory; create no derived
or export copy without a consumer. No automatic cleanup or additional ledger.
Final doc/anchor and diff checks pass. Git changes only this existing plan;
no source/config change, new document, commit, PR, remote CI or npm publication.

## Real-pilot execution (P2)

Authorized on 2026-10-28: execute the fixed P1 request once, within its unchanged
four-call ceiling, five spending stop lines and 240-second executor deadline.
P2a passed: saved ChatGPT login is present (not a new login or credential dump),
the repeated preview is identical/ready, all 23 input files/modes match and the
native destination is fresh. Confirmation used the exact P1 preview digest.

P2b stopped: CLI exit 2, status=stopped/EXECUTION_FAILED. Only the first baseline
Agent call started/finished; it timed out at 240.044 seconds. No treatment call
or remaining three calls started, no final manifest/paired quality result exists,
and acceptance is inconclusive/ineligible. This is not a completed experiment or
an efficacy result. No retry, replacement or budget/timeout increase occurred.
The trial receipt's error is \"codex\" timed out after 240000ms.

| Recovered spending | Known partial token lower bound |
| --- | --- |
| input (includes cached) | 302,555 |
| cachedInput | 255,616 |
| uncachedInput | 46,939 |
| output | 6,656 |

Elapsed duration is final at 240.044 seconds; token coverage is partial for this
failed invocation, not a complete bill. Both input/cache stop lines were reached
inside the in-flight call; the existing between-call guard preserved usage and
started no further calls. Configured model is gpt-6.1-sol; the served model is
unrecorded. The transcript has 14 completed local commands, including five
Skill/guidance reads and four test commands (exit 1,1,0,0), and two added test
files remain in the stopped workspace. Those tool observations do not replace
final grading or establish why every part of the 240 seconds was spent.

P2c verified: saved report --json --replay preserves the stopped prefix/costs;
native evidence correctly remains unverified as a completed paired result
because no final manifest exists. Export preview/apply to a fresh OS temporary
destination succeeded. After moving the package, verify-only validates all 565
package files and actual offline reproduction preserves status=stopped, exact
session/partial costs/budget/model declarations, inconclusive/ineligible outcome
and modelCalls=0. It proves portable stopped evidence, not a completed comparison.
All 326 native file hashes/modes are unchanged; no active pilot Agent remains.

Retain only this one native group at
~/Documents/skillfit-workspaces/query-shape-pilot-20261028/runs/pilot-001,
its unchanged request/preview/input copies and original execution.json /
execution.stderr.log. The per-trial error/result/transcript are native indexed
records and remain intact. Removed the owned disposable export and rebuildable
outer report after checks; no permanent duplicate delivery or new Markdown.
Temporary check outputs are at skillfit-query-shape-replay-fmn9_kxm under the OS
temporary directory. Source runs remains absent; old studies/records are untouched.

The live four-call goal remains incomplete. Before any future paid attempt,
review the retained execution/overhead and declare a fresh preview and spending
scope; do not silently loosen this request or reuse pilot-001. No new live
attempt is authorized by this stopped result. Docs/diff checks pass; only this
original plan changes in Git, with no source/config changes, commit, PR, CI or
npm publication. Stopping/accounting/read/export/reproduction worked; completed
paired grading is the remaining acceptance gap.

P2 retrospective (no new model calls): the receipt-matched local event log puts
the first regression failure at 59 seconds, implementation/focused pass at 172,
all 11 local tests passing at 233, and timeout at 240. Ten recorded tool batches
span 1.793 seconds in total; gaps also include model/transport/scheduling and
cannot be separately attributed. Ten usage increments sum exactly to 302,555
input tokens; 84.49% of that known subtotal is cached. On a disposable copy,
the unchanged Bench verifier passes all eight facets after the stop; this does
not replace P2's missing final manifest or change its stopped status. Recorded
configured settings are gpt-6.1-sol/xhigh/default, unchanged before P3.

## Wider real-pilot attempt (P3)

Authorized on 2026-10-28 after the retrospective: grant the proposed small
pilot more time and token headroom. The new goal is one completed baseline /
vibe-coding pair on query-shape in the same actual workspace; P2's uncompleted
four-call cohort remains separate. Keep inherited common configuration and
the original grader; do not lower checks, change model/effort or modify global
rules. One trial uses the retained balanced setting but cannot counterbalance
order across multiple pairs. No statistical efficacy/adoption claim.

Use request-relaxed.json and preview-relaxed.json alongside the original files,
with fresh ./runs/pilot-002. Raise the executor deadline from 240 to the existing
600-second CLI default. Whole-batch input/cache/noncache/output stop lines are
1,200,000/1,050,000/200,000/30,000 tokens, with accumulated Agent duration 1,200
seconds and maxCalls=2. The input figure includes cached input; each stop line
is independent. This allows roughly twice two observed partial P2 calls for
cumulative input, plus bounded headroom for completion. Token usage and elapsed
time are not a monetary quote. In-flight work can overshoot; unknown/partial
final usage or any execution error stops further dispatch. One new attempt only.

P3a passed: source CLI 0.14.0 is available; request-relaxed.json changes only
trials, maxCalls, executorTimeoutSeconds, runGroup and spendingBudget. Preview
983308b69b4d2bf9368acd199bf3281415555ccfbec4fc12e707e88049c71d6f is planned
with nested environment=ready and two calls. Re-preview is identical; original
Bench/candidate/implementation fingerprints and gpt-6.1-sol/xhigh/default
settings match P2. Saved login is present. Freeze all 326 old native file hashes/
modes plus original request/preview hashes externally before the new run;
pilot-002 is fresh. Start only the reviewed new digest; no new model calls yet.

P3b stopped: exit 2/status=stopped/EXECUTION_FAILED after the first baseline
Agent call timed out at 600.041 seconds. CallsStarted/Finished=1 of 2 planned;
the treatment never started and no final manifest/paired result exists. No token
stop line was reached. Known partial token lower bounds are input=783,019,
cachedInput=746,112, uncachedInput=36,907, output=12,747; elapsed duration is
final, token coverage is partial. Keep these observations separate from P2.

The captured stream additionally records six error events at transcript lines
60-66: TLS close_notify/handshake EOF, repeated reconnect attempts and waiting
for network, after OCR rule retrieval and before further review changes. It
subsequently resumed work. The local session matches the receipt thread/counter
hash; its last review-check command started at 582.8 seconds, with no final
assistant message or turn.completed before timeout. Monotonic/wall timing shows
no clock anomaly. Network interruption is an observed contributor, not proof of
an OpenAI outage or a measurement of time lost solely to networking. Do not
attribute this attempt entirely to the executor deadline or keep increasing it.
There was no host-level experiment retry; Codex's own stream reconnects occurred
inside that one Agent invocation. Its separate stream retry setting is documented
in the [official configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference).

P3c passed: the model's final local suite had 20 passing tests, and an unchanged
Bench verifier run afterward on a disposable copy passes all eight facets.
That post-stop check does not convert the original result into a completed
pair. Native stopped read and export preview/apply succeeded; after moving the
temporary package, all 565 files verify and offline reproduction preserves the
exact session, costs/budget/model declarations, stopped/inconclusive/ineligible
result and modelCalls=0. Both 326-file native groups and the original request /
preview hashes remain unchanged. Removed only owned duplicate verification
delivery/scratch; retained raw execution-relaxed.json and its stderr next to
the new request/preview. Proof is in OS temporary skillfit-pilot-002-check-e23di2cn.

Read-only connectivity check: default provider=openai, no custom base URL,
proxy environment variables or custom CA environment variables were configured.
A public ChatGPT HEAD request completed TLS verification (curl status 403,
verify_result=0, 2.755 seconds), without a model request. This tests current
basic connectivity only; it does not prove long-stream reliability or identify
which network component reset the earlier stream. No proxy/global/credential
configuration was modified. Prioritize that connection investigation before
any further paid cohort, and require a new reviewed preview/spending scope.

P3 remains incomplete as a real paired pilot. No retry, P4/model dispatch,
calibration, relaxed grader, core-code change, extra maintained document, commit,
PR, CI or publication. Source runs remains absent; old evidence is intact.
Docs/diff checks pass. Across P2/P3 there are two attempted baseline Agent
invocations and no treatment; their known partial token lower bounds total
input=1,085,574, cachedInput=1,001,728, uncachedInput=83,846, output=19,403.
This is descriptive accounting of stopped attempts, not a pooled quality cohort
or complete bill.

## Decisions and limits

CI suitability: the current CI already uses the reorganized source/tools and
contains real offline npm pack/install, public entry docs, request/self-test and
portable-export regressions. The separate installed release recipe adds five
mode-complete moved replays; it was passed locally in M3, not asserted to be a
remote CI stage. Keep these scopes distinct. Existing three-OS checks cover
filesystem/process differences; four Node compatibility jobs and the minimum
job check distinct runtime capabilities. No evidence currently requires replacing
this workflow or deleting a failing assertion.

Proposed integration handling: eleven original branch commits contain CI-skip
instructions. GitHub documents different push/PR skip behavior; the repository's
default squash body copies commit messages, creating a main-CI skip risk. Its
automatic branch deletion would also remove the verified remote branch
retaining consumed intermediate source snapshots if that branch were squashed
directly. A temporary clean integration branch preserves the original delivery
branch, gives main one clean source commit and adds no maintained mechanism.
Verify file-tree identity and explicitly control the final message; do not rewrite
old commits, change repository settings or treat a skipped check as verification.
The user subsequently approved M6, including its one PR, existing CI and merge
after successful verification. This does not authorize npm publication.

Release scope review: the branch contains the cumulative architecture and artifact
cleanup, not merely the final link correction. Relative to the last verified main
3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850, include source-only offline self-test,
explicit bench claims/measurement scope and observation/numerical corrections;
module ownership and current saved-report/replay compatibility; retirement of the
unused repository archive lifecycle; current docs/data-handling contracts and
release-workflow proof reuse. Most path churn is historical-tree removal and
module moves; path counts do not describe independent product features.

The proposed next minor is 0.14.0 because this is more than documentation repair.
It is a candidate, not a checked-free registry version or an approved publication.
The package and latest changelog entry still say 0.13.1; R2 must add the actual
release entry and synchronize versioned instructions. Keep old publication bytes,
historical feature minimums and matching documentation links intact. Source build
examples must reference a delivered commit containing the candidate behavior and
version; a matching version string alone is insufficient.

Release exclusions: no Calibration refactor, paid/live study, new storage/GC,
telemetry platform or documentation system. Existing offline installed recipes
exercise disposable targets only. Actual integration must first reconcile current
main; the comparison uses the recorded main baseline. M6–M7 subsequently verified
the actual merged source and its exact main CI. Publication still requires a new
unpublished version and separate authorization. Preserve the existing release
contract; this source integration does not create another release route.


Link/build decision: repository and installed pages use relative links only for
co-distributed targets. A standalone Skill cannot assume the checkout or sibling
docs exist. Its source links, and references to unshipped source tooling, use the
already delivered full commit ed5eaff7d222de1c73874ce022785fbe89291017. Runtime source
is unchanged from that snapshot; existing historical snapshots remain untouched.
The source-only current plan is named as a path, never linked as an npm file or
mislabelled immutable history as active progress. Published npm 0.13.1 and its
original docs remain distinct from unpublished source features; do not change the
version or substitute an npm prefix for a source command.

L1 review: limit new validation to version-sensitive blob/tree links in this
repository (`docs/`, `benches/`, `src/`, `tools/`, `.github/`). A full commit is
required; live issue/workflow pages and root contribution/security policy links
keep their intended live meaning. Existing relative checks still resolve files
and anchors. Pin syntax enforcement does not claim external HTTP availability;
verify all newly selected commit targets/anchors from local Git during L4. This
avoids new dependencies, arbitrary historical-object fetches and package Git
requirements. Release instructions must remind maintainers to refresh affected
source/Skill pins when the referenced behavior changes.

The module layout is sufficient for this work. Application coordinates,
Execution schedules, Agents supplies observable facts, Records seals and reads,
Measurement derives metrics, CLI presents. Calibration's mixed scheduling and
diagnostic responsibilities remain a future candidate when a real behavior
change needs it; this task adds no abstraction or universal runner.

Documents have distinct reader jobs: tutorial, how-to, reference and explanation.
Do not give every page the same template or impose a permanent page-count cap.
Fix stale facts and duplicate procedures in their existing owners. The release
manual describes the existing authorized workflow, not a new publication path.
The release workflow was not dispatched. The earlier link-entry follow-up was
limited to local checks and branch delivery. M6 later received separate user
authorization for one PR, existing CI and source integration; publication remains
outside this task.

Use existing `--runs-root` / `--run-group` under ignored `runs/`; the proposed
outer study folders do not change native records. Keep analyses and scratch
outside sealed batch directories. A transcript/trial workspace included in
`_artifacts.json` is not disposable scratch. Preserve whole referenced records;
there is no supported native-record slimming or automatic retention/cleanup.
Select whole unused batches manually only after checking active work, conclusions,
budget accounting, diagnosis and delivery consumers. Never select negative outcomes
for deletion while retaining a dependent study claim.

Process observations require an actual question/consumer, source and missing-value
meaning. Existing observable records remain authoritative. Custom collection or
new interpretation is future protocol work; derived external analysis names its
inputs and method/version and is not automatically part of portable export.
Keep only needed memory values in memory. No per-variable files or study catalog.

Native snapshots and exports deliberately copy exact inputs/runtime. Avoid
unconsumed exports and retain a verified complete delivery where needed. This
work does not deduplicate payloads, rewrite old bytes, change statistical gates,
choose a new storage platform or promise durable backup from ignored directories.

Plan review: use the existing documentation interface for bounded offline checks,
not a new crawler or distribution format. Main risks are referencing a moving
version, linking unshipped files as package content, or cloning main while
promising another build. Validate the chosen snapshot and source checkout,
preserve npm/demo blocks and bilingual parity, and test the actual installed
package and portable replays. No acceptance is removed to make a check pass.

