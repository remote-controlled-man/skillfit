# Current work

## Status

- Current task T1: explicit Token-first control is implemented and verified
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
  attempt. npm latest=0.14.0, 18 standalone receipts verified, and all 1,079
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

## Checked integration and preview progress

R9 authorized on 2026-10-27: review 9244d61 and the preceding unmerged closeout,
then create one PR, await necessary CI, merge and check main CI. Main is 7514936;
the source branch is 9244d61 with three unmerged commits and no open PR. The
cumulative scope is seven existing Markdown files; no runtime, package version,
workflow or Bench input changes. Existing classification is full because the
scope includes active agent/guide/driver contracts. Keep all eight current jobs.
The review found the driver's self-test table still assumes source cwd while its
new safety guidance requires the owning workspace; fix this one example and
state the source-path prerequisite. Preserve all fixed historical links and raw
records, including the stopped study and original failed release observations.

R9a complete: one integrated OCR-guided review covers all seven changed Markdown
paths (all filtered by extension, then manually inspected), including current WIP.
Corrected the driver table's source-relative self-test and stated its absolute
source-path prerequisite; the changed example passes from a temporary owning
workspace with spaces, zero model calls and zero preview writes. Current native
read, offline replay, export preview/apply, moved portable verification and actual
replay all succeed with the old source path absent. All 481 study SHA-256/modes
and 33 retained release-file hashes match their baselines; all 18 standalone
release receipts verify. Native observations still match except their location;
the study remains stopped with two historical calls. No new model/Agent calls.

Docs/anchors against actual main 7514936 and diff checks pass with no unmapped
changes. The initial restricted test run passed 1,072/1,073; its sole failure was
EPERM while the MCP HTTP fixture tried to listen on localhost. Retained that log
and reran the unchanged complete suite with local-listener permission: all 1,073
pass, zero fail/cancel/skip (67,019 ms). Source runs remains absent; source/runtime,
package, workflow, public defaults and published bytes are unchanged. No open
review findings. Proof is external at the workspace identified by
/private/tmp/skillfit-closeout-integration-location.txt. Commit the reviewed driver
example and this original-plan follow-up before the single PR; keep subsequent
progress local while checks run.

R9b delivered: reviewed follow-up 5bb1f01fa0cf8648ae9fca9e98edf133f9668016
is pushed non-force and remote identity matches. Created and attached the single
combined [PR #61](https://github.com/remote-controlled-man/skillfit/pull/61),
four commits/seven existing Markdown paths, against main 7514936. Existing PR
CI 40452169975 runs on that exact head. Keep this progress local until PR/main
checks complete; do not dispatch workflows or push progress-only updates.

R9b complete: existing PR CI 40452169975/1 passes all eight jobs on unchanged
5bb1f01, including Windows (12m41s), macOS and Ubuntu; security passes too.
The final guard confirms OPEN/CLEAN/MERGEABLE against unchanged main 7514936,
all nine checks SUCCESS, and all seven committed file hashes match the reviewed
inputs. No CI rerun or progress-only push. Proceed with normal protected merge
of this exact head, preserving consumed history and using an explicit message.

R9c merged: normal protected merge of PR #61 succeeded as
df3dedc32bdc3863e3177f97e76b209ce822833c. Its entire tree equals reviewed head
5bb1f01; prior main 7514936, original publication source b6c804b, consumed source
c9522dd and reviewed workspace change 9244d61 remain ancestors. Fast-forwarded
the retained local branch while preserving only this sole-plan progress follow-up.
Automatic main push CI 40453464788 runs on df3dedc, attempt 1. Await all eight
checks and same-attempt full three-OS receipts. No manual workflow, extra PR,
CI rerun, npm upload or new model calls.

R9c complete: automatic main push CI
[40453464788](https://github.com/remote-controlled-man/skillfit/actions/runs/40453464788),
attempt 1, passes all eight jobs on exact source df3dedc. Existing
collectSourceCi/validateCiEvidence verifies the same-attempt full three-OS
receipts: Ubuntu/macOS each pass all 1,073 tests; Windows passes 1,069 of 1,070
with one existing platform skip and zero failures/cancellations (12m24s).
All retained study files/modes and release-file hashes still match their
baselines after merge, and source runs remains absent. No runtime code,
workflow, defaults, published archive or historical observation changed in R9.

R9 final delivery: R6/R7/R8 guidance and accumulated closeout are on protected
main; the only remaining diff is this original plan's actual progress/results.
Reviewed that follow-up against the verified PR/main identities, retained-byte
proof and executed checks; no open findings. Docs against main df3dedc and diff
checks pass. Reuse the unchanged full offline and CI acceptance; do not repeat
them just for status text. Commit/push this plan-only follow-up on the retained
codex/docs-framework-architecture branch and compare remote refs, keeping main
df3dedc unchanged. No extra PR, CI rerun, npm workflow/upload or model call.
Complete main evidence is under main-source-ci in the existing external R9
proof workspace. Calibration and automatic deletion remain deferred as agreed.

R8 authorized on 2026-10-27: the user asks to choose and implement the appropriate
placement. dist is owned compiled output and remains in the source checkout.
The sole runs/ponytail-efficiency-20261026 directory is an older study whose
launcher hard-codes the source checkout and its output path. CLI defaults already
resolve ./runs from the caller's current directory; no application change is
needed. The old tutorial's repository-root instructions blur those two owners.

R8a complete: frozen inventory contains 481 ordinary files/2,444,971 bytes,
including all 337 indexed native artifacts, with no symlinks/special files.
The existing CLI reads the baseline successfully as stopped/EXECUTION_FAILED:
two calls started/finished of 16 planned; frozen global Skill change caused the
original stop. No matching active study executor is present. Historical outer
launchers/seals and saved paths are observations and remain byte-identical;
this migration does not authorize rerunning or repairing the old live study.
Use existing read/export/replay interfaces, preserve all costs/unknowns and create
only disposable verification exports. Migration proof is outside source at the
workspace identified by /private/tmp/skillfit-workspace-move-location.txt.

R8b complete: moved the entire study atomically to
~/Documents/skillfit-workspaces/ponytail-efficiency-20261026 after another active
executor/collision/hash check. All 481 files, permissions and historical paths
remain unchanged. With the old source path absent, the CLI's native report is
identical after normalizing only the study location. Native offline replay,
export preview/apply, moved portable integrity verification and actual replay
all exit successfully. The original study stays stopped with two calls retained;
this migration made zero model calls. Removed the empty checkout runs parent.
Historical launchers/seals remain evidence, not an instruction to resume the old
pilot. No aliases, path rewriting, application/default change or new mechanism.

R8c complete: current agent, architecture, workflow and driver guidance now
separate caller-owned experiment outputs from source-owned dist. The existing
first-evaluation tutorial captures the compiled source path before switching
into the actual workspace; its controls use an explicit source path and its
relative inputs/runs/exports stay in that workspace. Documentation adds no new
page, flag, output schema, folder requirement or automatic deletion service.

R8d tutorial acceptance: executed all six Bash blocks in a fresh OS temporary
workspace with spaces in its path, outside the source checkout. All four
synthetic controls pass with 27 simulated invocations and zero real model/Agent
calls. Preview creates no runs; report and export succeed; moved replay verifies
and runs after deleting the disposable original control batch. Teaching bench
preview/create/check and real-eval dry-run also succeed without executing a model.
No checkout runs directory appears. Removed owned tutorial scratch after success;
temporary verification exports are not retained as another permanent study.

R8d complete: full npm test passes 1,073 tests, zero fail/cancel/skip (66,370 ms).
Docs against actual main 7514936 and diff checks pass. After the full suite,
source runs is still absent, dist/cli.js exists, and all 481 relocated file hashes
still match the baseline. One integrated OCR-guided review manually covers all
six Markdown/instruction paths filtered by extension; no open findings. All
agent safety/authorization rules, native formats, statistics, source code, CLI
flags/defaults and historical observations are unchanged. The owning project's
ignore rules remain its responsibility; the CLI does not edit them implicitly.

Deliver only these six existing guidance/plan files on the original source branch
and verify its remote SHA; preserve main 7514936 for the next normal authorized
integration. No new documentation, experiment, workspace registry, automatic
cleanup, paid call, PR, remote CI or npm publication was introduced. Temporary
migration/tutorial exports were reclaimed after their independent replay checks;
the one retained native study remains complete in its actual durable workspace.

R7 authorized on 2026-10-27: the user accepts lightweight closeout of the three
identified delivery details. Main remains 7514936 and the existing branch is
a5baa3e, clean with no open PR. All R6 runtime/CI acceptance is complete; the
remaining work is durable receipt retention and existing-document cleanup.
The only complete successful recovery receipts are still under the OS temporary
integration workspace, while the original failed workflow artifact lacks them.
Use a fresh versioned directory under ~/Documents/skillfit-releases, retaining
the complete original artifact separately from the successful standalone records.
No original data is deleted or overwritten. Final docs/plan synchronization into
protected main rides the next normal authorized change, not another standalone
PR/CI cycle. This closeout adds no documentation system, archive catalog or GC.

R7a complete: saved the fresh durable delivery at
~/Documents/skillfit-releases/0.14.0 (33 files, 1,191,816 bytes). original-run/
retains the entire original failed workflow artifact, including the original
908,113-byte tarball and pack metadata. records/ retains the complete successful
protocol-3 recovery bundle; original run metadata/failure log, recovery state and
publication review remain separate observations. Every copied byte matches its
source. Existing reviewedArchive validates the original SHA-256
ba495eafeb58b3d741390d88493014d70fca1f4aba4a2d842df2a893238cde03,
version and 1,079-file inventory; the actual release-records CLI verifies all
18 receipts with zero writes or publications. All six recovery stages passed,
the original failure is intact, and no existing source or destination was deleted
or overwritten. Delivery no longer depends on OS temporary-folder retention.

R7b complete: replaced the existing release manual's stale current-candidate/npm
version introduction with version-neutral publication/receipt guidance. Historical
0.13.1 links, executable commands, headings and release rules are unchanged.
No maintained document, schema, storage service, package or runtime was added.
Final progress and this existing document will be delivered on the same branch;
their main synchronization remains for the next normal authorized integration.

R7c closeout verified: npm test passes 1,073 tests with zero fail/cancel/skip
(69,137 ms); docs against actual main 7514936 and diff checks pass. At the durable
destination, all 33 copied files match their source hashes, the original archive
passes size/SHA-512/SHA-256 checks and all 18 standalone receipts verify again.
Manual review confirms only the release guide introduction and this existing
plan change; all guide commands, headings and procedure body are byte-identical.
No runtime, dependency, version, workflow, historical package or private lab edit.

Deliver the two reviewed documentation files non-force on the existing branch;
independently compare its final remote SHA and unchanged main in the handoff.
No extra PR or remote CI is warranted for this housekeeping. Final plan state
and guide changes deliberately await the next normal main integration; this is
an explicit delivery boundary, not a remaining runtime or receipt-retention gap.
Calibration, live Agent/backend verification and automatic deletion remain outside
this completed engineering/closeout scope. Source-only review/check logs stay in
the OS temporary workspace identified by /private/tmp/skillfit-release-closeout-location.txt;
the actual release delivery is the durable Documents directory above.

R6 authorized on 2026-10-27: the user requests a careful review of 5f3c0ec,
one repair PR, necessary CI, merge after success and post-merge main CI. This
supersedes R4's earlier no-additional-PR boundary only for this repair. Current
main is b6c804b and the existing branch is exactly 5f3c0ec, with no open PR;
main protection requires a PR and the three OS jobs. Existing CI has eight jobs;
keep its workflow and assertions. R4 publication/recovery proof remains fixed
to original source b6c804b and one upload; integration must not dispatch npm.

R6a complete: the integrated OCR-guided review accounts for both source tools
and the manually reviewed plan across main b6c804b to 5f3c0ec. No open finding.
Static linking finishes the receipt module before the acceptance CLI awaits its
other imports; both public verify/recover entries reach ordinary input checks,
and the standalone records entry verifies the original 18 hash-linked receipts.
All 29 focused release cases pass. Full npm test passes 1,073 tests with zero
fail/cancel/skip (70,554 ms); docs against exact main and diff checks pass.
All 1,079 files equal the already accepted npm installation; loader/test bytes
are unchanged from 5f3c0ec. Commit only this authorization/progress follow-up
before the PR; do not push progress during its checks. Evidence is external at
the workspace identified by /private/tmp/skillfit-release-fix-integration-location.txt.

R6b delivered: original-plan follow-up 63ae1e71715fd7d6afec0cb4453b532123c4eaa0
is pushed non-force; underlying tool/test bytes still equal 5f3c0ec. Created and
attached the single authorized [PR #60](https://github.com/remote-controlled-man/skillfit/pull/60)
against unchanged main b6c804b. Existing CI 40439294591 is running all eight jobs
on that exact head; security passed. Keep further progress local during checks.
No new code, workflow changes, npm dispatch or repeated publication.

R6b complete: PR CI 40439294591/1 passed all eight jobs on unchanged 63ae1e7,
including Windows (12m18s), macOS and Ubuntu; security also passed. The final
read-only guard confirms OPEN/CLEAN/MERGEABLE at that head against main b6c804b,
with all nine checks SUCCESS. No rerun or progress-only push. R6c proceeds with
the normal protected merge of exactly this head; never use the npm workflow.

R6c merged: normal protected merge of PR #60 succeeded as
7514936c08edc5ee49925330c2fd433e605b0a53. The entire committed tree equals
checked head 63ae1e7; repair 5f3c0ec, original published source b6c804b and consumed
source c9522dd remain ancestors. Fast-forwarded the retained local branch while
preserving this sole-plan progress follow-up. Automatic main push CI 40440668681
is running on 7514936, attempt 1. Wait for that run and its same-attempt full
three-OS receipts; no npm workflow, duplicate CI or extra PR.

R6c complete: automatic main push CI 40440668681, attempt 1, passed all eight
jobs on exact source 7514936. Existing collectSourceCi/validateCiEvidence verifies
the same-attempt full three-OS receipts: Ubuntu and macOS each pass 1,073 tests;
Windows passes 1,069 of 1,070 with one existing platform skip and zero failures
or cancellations. All 1,079 packaged files still equal the accepted 0.14.0 npm
installation; its 18 standalone receipts verify with no writes or publication.
Latest npm workflow remains original run 40437444187; no release dispatch,
repack, new upload, paid evaluation, additional PR or CI rerun occurred in R6.

Final R6 delivery: source-only repair is now on protected main, and the original
release failure/recovery evidence remains immutable at b6c804b. Full local test
and reviewed tool bytes are unchanged; this final follow-up edits only the sole
plan's progress and actual results. Docs against main and diff checks pass.
Deliver this status commit on the existing codex/docs-framework-architecture
branch, independently verify its remote SHA and preserve main 7514936 without
another PR or status-only main CI. Complete CI evidence is external under
main-source-ci in the existing R6 proof workspace.

R4 authorized on 2026-10-27: the user approves npm upload after final checks.
Order remains reviewed preview promotion → one upload → the six existing
acceptance stages → standalone receipt verification → original-plan delivery.
Prepublication review confirms unchanged main b6c804b and successful preview
40359981385/1, its available artifact, exact main CI 40357729252/1 and original
908,113-byte archive SHA-256
ba495eafeb58b3d741390d88493014d70fca1f4aba4a2d842df2a893238cde03.
Official registry returns 404 for 0.14.0 and latest=0.13.1; there is no prior
0.14.0 publication intent or running release. Reuse the unchanged source/CI and
1,079-file installed acceptance proof; do not repack or repeat full CI. External
publication proof uses formal-publication-b6c804b in the existing integration
workspace. Main must stay at the preview source throughout this publication.

R4 dispatched once: publication run 40437444187, attempt 1, uses main b6c804b
with dry_run=false and exact reviewed preview 40359981385/1. The release workflow
must retrieve the original tarball, claim one upload and run acceptance; do not
claim publication until its actual upload and registry results are available.

R4 upload accepted: run 40437444187/1 retrieved the approved original archive,
persisted publication intent and completed npm upload. The next verification
step exited 13 at its top-level await of release-records.mjs, before creating
acceptance state. Preserve the entire original failed artifact and run logs.
Offline empty-input invocations reproduce the identical exit 13 for both verify
and recover. Ranked hypotheses: the receipt module's import back to acceptance
creates an entry-point await cycle; a Node-specific loader difference; malformed
receipt input. The first predicts that linking receipts before starting the CLI
will instead reach normal input validation. The second predicts a platform-only
failure; the third predicts a receipt error after loading, rather than the same
failure with empty input.

Recovery order/acceptance: first add failing public CLI regressions for verify
and recover in the existing offline test, then make the smallest source-only
loader correction and rerun affected tests. Run the existing recover command on
the preserved original artifact into a fresh external directory; require all six
unchanged acceptance stages and standalone receipt verification. Reconcile exact
original tarball/source/provenance and package bytes; full offline npm test and
one integrated review cover the source repair before its branch commit. Do not
rerun the publication workflow, repack, change main, add a PR, weaken any check
or claim registry acceptance until actually verified.

R4 loader repair verified locally: the public verify/recover regression first
fails with the production exit-13 await warning. Link exportRecords statically
before executing the acceptance CLI rather than awaiting the back-importing
module while the CLI is still evaluating. Both entry paths now reach normal
missing-input validation, preserving evidence and creating no recovery output.
All 29 existing/affected release tests pass; acceptance assertions/stages and the
published payload are unchanged. Begin the existing recover command against the
preserved accepted publication in a new external recovery-attempt directory.

R4 verification recovery complete: the existing recover CLI uses the original
accepted artifact in fresh formal-publication-b6c804b/recovery-attempt. All six
unchanged stages pass: registry-install, documents, examples, features, provenance
and signatures. Actual installed Skill/frontmatter, bilingual README and document
pins pass; 31 installed regressions and five portable replays pass. npm signatures
reports one verified registry signature and one verified attestation; provenance
binds source b6c804b and original publication 40437444187/1. Registry latest is
0.14.0, with official publishedAt=2026-10-27T02:18:01.991Z. Installation initially
observed E404 from propagation and succeeded on its existing bounded second
attempt; both observations are retained. Upload count remains exactly one.

The original, recovered and npm-installed 908,113-byte package preserves SHA-256
ba495eafeb58b3d741390d88493014d70fca1f4aba4a2d842df2a893238cde03;
all 1,079 installed files equal current package source. Source-only loader/test
edits do not ship and require no repack or patch version. No real model/agent CLI
call or actual user-configuration write occurred. Generated standalone protocol-3
records contain 18 hash-linked receipts; the real release-records CLI verifies
them with zero writes/publishes. The complete original failed artifact, logs,
recovery state/records and publication-review.json remain external, identified by
formal-publication-proof-location.txt in the integration workspace. Do not replace
the original GitHub failure with a success claim: upload succeeded there, while
all post-upload acceptance and receipt delivery completed in local recovery.

R4 source repair delivery: final offline npm test passes 1,073 tests with zero
fail/cancel/skip (69,934 ms); the earlier pre-repair 1,072-test result is not the
repair's acceptance. The focused release tests pass 29 cases. One integrated
OCR-guided review covers the two tool files and this manually reviewed plan;
no open finding, new dependency, document or public package/runtime change.
Deliver only these three paths on origin/codex/docs-framework-architecture,
confirm its remote SHA and preserve main b6c804b. The loader fix is not merged
into main, has no new PR/remote CI, and must be integrated through the protected
branch route before the next release; current registry delivery is verified.

R5a complete: explicit user authorization supersedes the earlier no-PR/no-remote-CI
boundary only for this one checked integration and formal preview. npm publication
remains unauthorized. Main protection requires a PR and three OS checks; the
unchanged release workflow requires successful full push CI for the exact main
source and promotes an exact preview run/attempt. Existing eight CI jobs stay.

The preflight against actual main 655bcca finds 108 compatibility errors, all
removed Bench task-data Markdown paths from the previous fixture/prompt/reference
layout. Current discovery correctly excludes tasks/ but the Git baseline adapter
uses only current exclusions, so it reads retired data as maintained prose.
Fix this before creating the PR, using that baseline's own existing data
exclusions. Keep real document/card path/anchor checks and offline/shallow Git
operation. The original failed result and subsequent proof are external at the
workspace identified by /private/tmp/skillfit-014-integration-location.txt.

R5b complete: the new regression first failed because the baseline adapter read
old fixture Markdown. It now reads the fixed source's existing documentation
exclusions before selecting old prose. Removed dataset cards still fail; sources
predating the registry still check real pages, and an available policy read
failure remains an error. No historical task inputs are loaded to classify them.
No catalog or blanket exclusion was added. Thirty focused docs/registry tests
pass; the actual main comparison has zero errors and 244 retained/migrated
anchors. Architecture remains 159 modules, zero violations/exceptions.
Full npm test passes 1,072 tests, zero fail/cancel/skip, 105,541 ms. The single
integrated review covers both tool files and this plan; no open findings.
All 1,079 packaged files still exactly match R2c's fresh installed acceptance,
so its installation, Bench, self-test and old/new portable-replay evidence applies.
Only source-only verification tools/plan changed. CI classifies the cumulative
1,355 path changes as full. R5c is ready for one reviewed delivery and one PR;
no status-only push will interrupt its run.

R5c in progress: pushed reviewed source-only fix 540b3cfa405639a925e966cb1295e2d2d8f77615
and created the single authorized PR #58 against unchanged main 655bcca. Its
existing CI run 40334500516 started all eight jobs; the independent security
check passed. The PR is mergeable but remains blocked until required checks
complete. Keep progress local during CI to avoid restarting the run; no npm
upload or workflow/protection changes. Use an explicit clean merge message.

R5c complete: PR #58's CI 40334500516 succeeded on the unchanged exact head
540b3cf. All eight existing jobs and the external security check passed; PR
merge state is CLEAN. No rerun or status-only source push occurred. R5d proceeds
with a normal merge and explicit clean message, preserving consumed fixed-source
ancestry. The npm environment has branch restrictions but no reviewer gate;
formal preview still waits for successful exact-main push CI.

R5d in progress: PR #58 merged normally as
8746a3decfc8f250a4a3de8c01b2b81382d9879b. Its committed tree exactly equals the
reviewed 540b3cf candidate; c9522dd, previous main 655bcca and the checked head
remain ancestors. The automatically triggered main push CI is 40337728891;
wait for its eight checks and exact three full OS receipts before preview.
The retained local branch fast-forwards to this main source while progress stays
local; do not move main again after preview solely to record status.

R5d verification failed: main run 40337728891 attempt 1 completed seven jobs
successfully, but Windows failed after 11m48s. Its full-scope receipt records
1,069 tests: 1,067 pass, one fail, one existing platform skip, zero cancelled.
The sole failure is eval-interruption's verifier scenario: "Fake process did not
start" before readiness, not a failed interruption/kill/usage assertion. Preserve
the original artifact/logs; no preview has been dispatched.

R5f local preparation: a temporary copy of the existing public CLI test with a
16-second harness startup delay reproduces the identical readiness assertion
(15,478 ms). Ranked hypotheses are setup readiness's 15-second limit, an earlier
preflight error, then a real interruption failure after readiness (not observed).
Validate the first prediction by extending only the verifier scenario's test
setup allowance; retain every behavioral assertion and the 10-second interrupt
exit bound. macOS fault injection is not actual Windows reproduction. A source
fix after the merged PR would need another protected-branch PR; that exceeds
the one-PR authorization. Prepare and verify it locally before asking; keep the
formal preview pending and do not modify main or weaken its CI gates.

R5f local preparation complete: changing only the verifier scenario's readiness
allowance from 15 to 45 seconds makes the same delayed harness pass (17,076 ms).
Its enclosing test allows 60 rather than 30 seconds so setup can use that bound;
all other scenario allowances, every behavioral assertion and the post-interrupt
10-second exit deadline are unchanged. The normal 13 interruption cases pass
(10,308 ms). Full npm test: 1,072 pass, zero fail/cancel/skip, 74,056 ms.
Docs and architecture gates pass; the integrated review manually covers both
filtered files with no open finding. All 1,079 packaged files remain byte-identical
to the accepted candidate because this test does not ship. There are no product,
workflow, dependency or automatic-deletion changes. Real Windows acceptance is
still failed/pending; the local delay probe proves the readiness-bound failure
pattern, not the runner's exact scheduling cause. Leave this two-file fix/plan
uncommitted and local until authorization for the additional PR is resolved.
Main stays 8746a3d and formal preview remains undispatched. No blind CI rerun.

R5g authorized: after inspecting the prepared local fix and its 1,072-test
acceptance, the user explicitly allows one additional repair PR, existing CI,
merge and continuation to formal preview. This supersedes R5f's earlier local-only
boundary; it does not authorize npm upload. Source test hash still matches the
reviewed delayed-readiness/normal-interruption/full-suite inputs. Reuse that
unchanged acceptance and the 1,079 identical packaged bytes; only authorization
and progress text changed afterward. Commit just the test and this original plan.
Current main is 8746a3d, the old delivery branch was automatically removed after
PR #58, and there is no open PR. Push the existing local branch non-force.

R5g final boundary check: the current test content still matches the reviewed
1,072-test acceptance and all 1,079 packaged bytes remain identical. A newly
appeared ignored runs/ponytail-efficiency-20261026 workspace has no current-task
source/tool consumer and was not created by this task's explicit temporary-root
commands. Preserve it as unrelated work; do not inspect or delete its records.
No runs path is tracked or packaged. Earlier empty-runs observations describe
their verification time and are not authorization to delete new work.

R5g in progress: committed the reviewed test/plan as
0c2b0a846610eb164be11c5c3c76df7dd758657f and recreated the automatically removed
original delivery branch non-force. Created the one authorized repair PR #59
against main 8746a3d. Existing CI 40341875940 is running on that exact source;
keep progress local until checks finish to avoid a status-only rerun. There is
no product/package/workflow change and no npm upload. Preserve the unrelated
ignored workspace; source status includes only this local plan follow-up.

R5g complete: PR #59 CI 40341875940 passed all eight existing jobs on exact
head 0c2b0a8; its security check also passed and merge state is CLEAN. This
includes actual Windows execution of the verifier interruption case and Bench
checks. No retry, workflow change or status-only push. At that phase the app's
PR artifact-attachment function was unavailable; do not claim attachment until
the successful resumed-phase call recorded below.
R5h proceeds with the exact checked head and a clean normal merge.

R5h blocked at the execution approval boundary, not at a test: both normal
merge attempts were rejected before execution. The reviewer said the current
question-reply was historical quoted material and not current merge authority.
The first rejection was followed by a read-only guard: PR #59 remained OPEN/CLEAN
at 0c2b0a8 against 8746a3d with all nine checks SUCCESS. The second request used
the same protected gh pr merge action and supplied the exact current human
question/answer plus guard proof; it was rejected for the same reason. Do not
try a different tool, admin flag, indirect command or bypass. Request a plain
current chat confirmation. The user already approved the intended scope; this
is an automatic-review authorization-recognition blocker, not a new design ask.
No merge or additional main CI/preview was executed. Keep this status local
while the PR remains open so its successful checks are not invalidated by a
status-only push. All tests/product bytes remain the exact accepted inputs.

R5h resumed on 2026-10-27: the user directly confirms merging PR #59, checking
main CI and generating the 0.14.0 preview without npm upload. Read-only preflight
confirms OPEN/CLEAN, all nine checks SUCCESS, exact head 0c2b0a8 and unchanged
base 8746a3d. The app attachment tool is available again and PR #59 is now
attached successfully. Reuse existing checked inputs; keep this progress local
until integration/preview completes so a status-only push does not repeat CI.

R5h merge complete: the normal protected merge succeeded after direct user
confirmation. PR #59 is merged as b6c804b7865ed214fd34b97a75be9a0edbe891d2;
its entire committed tree equals reviewed head 0c2b0a8, with original main
655bcca and consumed source c9522dd preserved in ancestry. The retained local
branch fast-forwards to that main while keeping this sole-plan follow-up.
Automatic main push CI 40357729252, attempt 1, is running on b6c804b; wait for
that existing run and its full receipts. No additional PR, rerun or npm upload.

Post-merge local verification: npm test passes 1,072 tests, zero fail/cancel/skip,
73,710 ms, before this progress-only commit. Documentation has zero errors
against 8746a3d; all 1,079 packaged files still equal the prior fresh installed
candidate byte for byte. This preserves its installation, Skill/document and
old/new portable replay acceptance; it does not substitute for main CI. The
only local source diff is this original plan. Keep unrelated ignored work intact.

R5h complete: exact-source main push CI 40357729252, attempt 1, passed all eight
jobs on b6c804b. Existing collectSourceCi/validateCiEvidence validates the original
same-attempt full three-OS receipts: Ubuntu and macOS each pass 1,072 tests;
Windows passes 1,068 of 1,069 tests with one existing platform skip, zero failures
or cancellations. Preserve original failed run 40337728891; no rerun was used.
The complete main receipts and upcoming preview proof are external under
formal-preview-b6c804b in the integration workspace. R5e may now dispatch the
existing dry-run workflow once. No source change, extra PR or npm upload.

R5e complete: one dry-run dispatch on unchanged main b6c804b produced successful
preview [40359981385, attempt 1](https://github.com/remote-controlled-man/skillfit/actions/runs/40359981385).
Downloaded its exact npm-release-40359981385-1 artifact into the external
formal-preview-b6c804b/preview-artifact directory. Existing reviewedArchive,
validateCiEvidence, validatePreview, validateRelease and inspectBuiltPackage
validate source identity, same-attempt main CI, version, original archive integrity,
inventory and workflow summary. The original 0.14.0 tarball is 908,113 bytes,
contains 1,079 files and has SHA-256
ba495eafeb58b3d741390d88493014d70fca1f4aba4a2d842df2a893238cde03.
Every archived file equals both current source and the previously accepted fresh
installation, preserving its Skill/docs, installation and old/new portable replay
proof. No additional model call or actual user-configuration write was made.

The workflow reports preview-passed and uploadAccepted=false; publication intent,
npm publish and post-upload acceptance steps are all actually skipped. This is
not registry installation, provenance/signature acceptance or a published release.
Retain the complete downloaded artifact and preview-review.json outside source;
the GitHub artifact currently has 90-day retention. Its location is recorded by
formal-preview-proof-location.txt in the integration workspace identified by
/private/tmp/skillfit-014-integration-location.txt. Preserve main b6c804b so any
future separately authorized publication can promote this exact preview attempt
and original tarball without repacking. Record this progress-only plan follow-up
on the existing delivery branch, with final docs/diff review and an independent
remote-ref comparison; no further PR or main CI merely for status.

Final progress review: only this existing plan changes after the merged source;
its statuses, run IDs, test counts and package digest match downloaded proof.
The docs gate against exact main and git diff --check pass. The already recorded
post-merge npm test covers unchanged code before this status commit. Deliver this
plan on origin/codex/docs-framework-architecture; independently compare its final
remote SHA and confirm main remains the reviewed preview source b6c804b.

## Candidate delivery and preparation progress

R2a complete: automatic deletion is deliberately deferred, not a new release
prerequisite. Existing temporary-data boundaries and manual whole-study rules
remain. Official registry and remote refs are recorded above. Existing CI runs
on main push or PR; branch delivery alone is not a release. The source-only R3
completion records an earlier merge and does not cover this new candidate.
Current reviewed source must still go through the required integration/source-CI
route before an authorized publication; local proofs do not waive those gates.
At R2a completion the remote branch exactly matched c9522dd; main stayed 655bcca.
There is no open PR; the checked workflows trigger CI only for main pushes/PRs.
R2b complete: synchronized 0.14.0 metadata, changelog and all affected current
version/build entrances. Historical minima and publication links stay fixed.
Standalone implementation links and the reproducible source walkthrough use the
already delivered c9522dd. That snapshot intentionally precedes version metadata
and still prints 0.13.1; docs state this explicitly rather than claiming a
0.14.0 version string at that fixed commit. Current 0.14.0 source/package content
and registry availability remain distinct; no release date or upload is claimed.
R2d commit-message review: the existing branch has no push-CI trigger or open
PR, so a clean commit message preserves today's no-CI boundary and avoids a
skip marker blocking a later explicitly authorized PR check. Recheck both before
push. Do not create a dummy integration branch/commit just to remove a marker.
R2c complete: one integrated OCR-guided review covers all 13 changed paths,
including 12 filtered paths checked manually. No open findings. Package/lockfile
change only the three root version fields; dependencies are unchanged. All old
changelog bytes, README command/demo blocks except approved version/source pins,
and the frozen metrics body remain exact. All 13 referenced fixed source files
exist at the already delivered snapshots. No implementation, Bench payload,
profile, schema, workflow or dependency changed.

Final npm test: 1,070 pass, zero fail/cancel/skip, 104,783 ms. Documentation:
34 registered pages, zero errors, 192 c9522dd path/heading migrations accounted
for. Architecture: 159 modules, zero violations/exceptions. Actual offline
pack/install has 1,079 files (908,113 archive bytes), all matching current source;
installed bin/version and driver/docs pins are 0.14.0. The current installed
recipe passes all seven foundation checks, 31 regressions and five moved replays,
plus isolated configuration backup/reinstall and relocated bundle install. All
11 installed Bench gates pass (51 tasks). The old native record is read/exported/
relocated/replayed through the new installed CLI with its original bytes intact.
The public installed self-test protocol also passes all four suites, 27 simulated
invocations, pure preview, report/export/moved replay and no adoption eligibility.
All real model/agent CLI calls and user-configuration writes are zero. Runs remains
empty. These are macOS/Node 24.21.0 local proofs, not registry installation,
signature/provenance validation or exact-main source CI.

R2d complete: reviewed candidate payload 70304aada4090e8af7378ce53d496e2acaf143c3
was committed and pushed non-force to origin/codex/docs-framework-architecture.
Independent ls-remote exactly matched that payload; main remained
655bccaa384bbc3d0dc5602e76efa63968272ece. The branch has no open PR and only
main pushes/PRs trigger CI. No PR, remote CI, main merge or npm upload occurred.
This source-only status follow-up records actual delivery; independently verify
its final remote ref in the handoff. The 1,079 packaged bytes are unchanged from
R2c, and this plan stays excluded from the package. The clean commit message
supports a future authorized PR. Current-candidate main integration, required
source CI, formal preview and npm publication remain pending separate
authorization. Existing release gates are not bypassed.

Evidence is external at the workspace identified by
/private/tmp/skillfit-delivery-prep-location.txt. Review this sequence before
changing candidate metadata. No unresolved design decision requires an ADR or
a new automatic-cleanup mechanism.

## Runs cleanup and commit progress

C1 complete: source/Bench changes passed B1–B5, but the ignored local runs
root was not included in physical cleanup. Current inventory has 36 legacy
workspaces, 107,908 files and 1,305,113,411 bytes. These are generated experiment,
research, build and installation/replay copies, not tracked product modules.
No runs path is tracked. Existing manual whole-batch retention rules still apply:
protect observed facts and accounting populations until a verified complete
published delivery or retained original covers their consumer. Do not infer
expendability from completed/stopped status or remove selected negative outcomes.
Fixed published packages will be read from existing Git objects only for this
one-time safety comparison; no archive/restorer/catalog is added to current source.
The one-time comparison reads 19 complete packages at the fixed published
3a3ff4 commit. Of 76 local native copies, 47 match a complete published copy;
others include private/original bytes differing from the normalized delivery.
After this distinction and recovery loss were explained, the user explicitly
selected deletion of all obsolete experiments, including unpublished/private
originals, with only published results retained at their fixed Git commits.
This supersedes retaining unconsumed local originals; do not create an archive
or claim the private raw bytes are recoverable. All 36 explicit whole roots are
selected (not partial positive/negative outcomes). There are zero source path
consumers, zero open files under runs, and no linked worktrees in those roots.
C2 complete: deleted all 36 reviewed obsolete whole workspaces, removing
107,908 files / 1,305,113,411 logical bytes (1.24 GiB). runs is empty and remains
ignored. No archive copy, tracked run content or private-lab mutation. The 19
fixed published package SHA values are unchanged after cleanup. Four existing
entry/workflow/architecture/tool pages distinguish needed study workspaces from
OS-temporary development/package/build scratch and external release receipts.
The workflow explicitly distinguishes redacted published derivatives from private
raw recovery; no native layout, CLI default, retention service or new document.
C3 complete: after deletion, two complete packages from fixed published Git
objects replay successfully without the old runs paths: the native-diff package
regrades four deliveries with quality/cost/acceptance equal, and the independent
comparison stop package regrades 12 with quality/cost/budget equal, retaining its
reject decision. Both make zero model calls. The first temporary extraction
incorrectly materialized unindexed macOS AppleDouble metadata as ordinary files;
removing only those transport companions fixed extraction. Indexed package bytes,
sealed runtime, assertions and Git objects were never changed. No historical
archive tree or restorer was added to current source.

The integrated follow-up accounts for all 1,344 final path/status entries,
reusing B4 only for unchanged bytes and reviewing the five documentation/plan
inputs. Review corrected wording to preserve normal dist/node_modules locations;
only one-off validation/package scratch goes to OS temporary storage. No open
findings. Final npm test: 1,070 pass, zero fail/cancel/skip, 96,975 ms. Architecture
retains 159 modules and zero violations/exceptions; 34 registered docs and 1,414
old path/heading migrations pass. Runs remains empty and untracked.

Fresh actual offline pack/install has 1,079 files matching current source;
1,077 match B4 exactly and the two changed files are the reviewed workflow and
architecture pages. Runs, private lab and source-only plan remain excluded.
Installed acceptance again passes seven foundation checks, 31 regressions, five
moved portable replays, isolated configuration install/reinstall and relocated
bundle install, with zero real model/agent CLI/user-configuration calls/writes.
C4 complete: created one local commit on codex/docs-framework-architecture
containing the reviewed Bench/source/docs changes and this cleanup guidance,
with [skip ci]. Staged review confirms all 858 Bench file bytes match the final
worktree; Git identifies 605 renames among 739 changed paths (short wrappers and
template consolidation account for remaining add/delete pairs). Ignored runs and
private workspace4skills are absent from the index. Runs is empty. This final
status is folded into the same commit; the handoff names its final hash. The
committed product/package bytes retain C3 acceptance; only this source-only plan
status changes afterward. No push, PR, remote CI, publication or paid evaluation.

The cleanup proof is outside the repository at the workspace identified by
/private/tmp/skillfit-runs-cleanup-location.txt. The user authorized cleanup and
local commit, retaining the existing no-new-documents/no-PR/no-remote-CI boundaries.

## Bench maintenance decision and progress

Requirements: B-R1 makes a task's prompt, fixture, grader and reference local to
that task; B-R2 keeps one manifest and genuine shared grading implementation;
B-R3 preserves public roots/ids/order, schemas, old saved readers and raw input
provenance; B-R4 keeps generated outputs out of source and maintained docs;
B-R5 verifies generated, installed and relocated behavior without live spending.
There is no network service/QPS or new running-cost requirement: this is local
file organization at the measured 11-Bench/51-task scale, with zero model calls.
New permanent infrastructure, Docker requirements, generic telemetry/GC and
Calibration changes are non-goals.

Decision: use tasks/<id>/{prompt.md,fixture/,verify.mjs,reference/}; an optional
prompt.trigger.md/probe lives beside the task. A task using a truly shared grader
references it directly from bench.json; do not manufacture duplicate adapters.
Keep existing dataset-root shared graders, clocks, licenses and provenance.
Consolidate generated template/layout knowledge under one Bench-owned module;
load/edit/gates/replay keep consuming the manifest interface. Existing code-review,
debugging and fixed self-test inputs may retain their legacy layout as explicit
compatibility/teaching inputs. No new layout switch or format version.

Alternatives: documentation-only cleanup is cheap but retains the observed
multi-directory edits for every authored task (B-R1). Fully replacing the format,
renaming public roots or adding aliases would create migration machinery without
improving the manifest interface (B-R2/B-R3). The chosen task-local organization
improves locality behind the existing deep load/read interface. A future actual
consumer requiring different paths can already express them in the manifest;
there is no reason for a storage/plugin framework at this scale.

Current primary guidance: [Harbor task directories](https://docs.harborframework.com/tasks/overview)
keep instruction/environment/solution/tests with each task; the earlier comparison
of Promptfoo/Inspect/SWE-bench remains recorded at the fixed P1–P5 plan. This is
an inference about locality, not adoption of Harbor's TOML, containers or platform.
This changes an implementation convention, not schema/CLI contracts; record it
here instead of creating another ADR or glossary. Existing domain terms remain
in the architecture document.

Pre-mortem and rollback: (1) a moved reference path silently breaks grading —
original-fails/reference-passes and all 11 gates must expose it before delivery;
(2) a fixed recipe or old result depends on the old tree — retain the original
recipe bytes/hash and test old native reads plus real moved replay;
(3) dataset Markdown is rediscovered as project docs — narrow known task-data
exclusions and the existing registry gate must expose it. Zero lost payload bytes,
zero failing required gates and zero changed immutable originals are acceptance
conditions; any violation blocks delivery. Source moves can be reverted against
the recorded baseline; no published bytes are rewritten. Bench content hashes
will legitimately change with paths/cards; never copy old hashes onto new inputs.
No approval question remains: the user's requested reorganization supplies scope;
real experiments, publication and public-contract breaks remain out of scope.

B1 complete: root instructions and relevant skills read; one delegated read-only
consumer audit completed. Baseline hashes are saved at the temporary workspace
named by /private/tmp/skillfit-bench-maintenance-location.txt. The earlier
old-layout native self-test result and installed package remain available there
by explicit receipt pointer; preserve their native indexed bytes during B4.
B2 complete: new authoring paths first failed against the old layout, then passed.
A separate failing assertion exposed the output starter's unregistered trigger
prompt; registering the optional field fixed it. Both starter kinds pass actual
offline graders. Templates/layout have one Bench owner. The authoring/reader/CLI
suite passes 122/122, including source drift, rollback and symlink/collision guards.
All eight contributed Bench gates pass (36 tasks), as do 35 source and 16 tool
regressions. The migration map accounts for 640 moves: 574 byte-identical assets
and 66 path-adjusted executable wrappers; six shared scripts use the new lookups.
Forty-eight unmoved assets are byte-identical. Original prompts, fixture/reference
source and license bytes, provenance, task ids/order/schema/claims and Node flags
are unchanged. Dataset roots remain stable; current paths legitimately change
Bench hashes. No models or real configuration writes were used.
B3 complete: all eight existing cards now describe workloads, scope, source and
offline commands rather than a study sequence. Repaired the MCP card's deleted
evidence examples and pinned the original selection proposal's source link;
raw source hashes/Git blobs are untouched. Existing format/authoring/architecture
pages own task locality, shared graders and honest input/answer-isolation limits.
Known dataset task-data exclusions shrink 21 entries to eight; cards remain
maintained documents. All 34 registered documents and baseline anchors pass.
The current recipe first failed on its old generated script path, then passed
with manifest-derived lookups: seven foundation checks, 31 regressions and five
portable replays. The hash-pinned original recipe is unchanged. A new legacy
layout regression runs/reads/exports, deletes original inputs and replays a moved
package successfully. No new maintained document, schema, flag or dependency.
B4 complete: the single OCR-guided review accounts for all 1,341 path/status
entries (502 selected and 839 manually accounted filtered entries), including
both sides of all moves, exact-byte payloads, script path diffs, tests, cards,
policies and this plan. No open findings. Review found five stale manifest
study descriptions and custom test fixtures that assumed old starter directories;
those are fixed without removing assertions. The initial full suite's 20 failures
are retained; the affected 68-test suite and then the final full npm test pass.
Final suite: 1,070 pass, zero fail/cancel/skip, 109,047 ms. Architecture: 159 modules,
zero violations/exceptions. Documentation: 34 registered pages, zero errors and
1,391 baseline path/heading migrations accounted for. No new maintained document.
Independent baseline comparison confirms all 51 task ids/order/schema/task
metadata and command flags, 640 moves, 574 exact moved payloads and 190 unchanged
other input files. Only current descriptions/cards, known executable paths and
one proposal URL change; raw source hashes/Git blobs and original recipe remain.

Fresh actual offline pack/install: 1,079 package files match current source bytes;
installed bin/version, source-plan exclusion and new task-local command starter
pass. All 11 installed Bench gates pass for 51 tasks. The installed current
recipe passes all seven foundation checks, 31 regressions and five moved replays,
including isolated-home configuration backup/reinstall and relocated bundle
install. The pre-change native record also passes installed public CLI report,
export, moved-package read, verify-only and full regrade. All 265 non-Git native
files and 449 portable files retain exact bytes through these operations; transient
Git metadata is excluded by the existing replay contract. All model/agent CLI
calls and real user-configuration writes are zero. These are macOS/Node 24.21.0
local checks, not remote CI, registry publication or model efficacy evidence.
B5 complete: B-R1 task locality is covered by both starter kinds, capture/import/
draft tests and all contributed tasks; B-R2 has one template owner/manifest and
shared graders without duplicate task wrappers; B-R3 is covered by baseline
hash/proposal checks and old-layout native/portable replay; B-R4 retains the
same 858 Bench files/34 maintained documents with narrow task-data exclusions,
no generated records in source; B-R5 is covered by the full local suite and fresh
installed acceptance above. Final review hashes differ only for these reviewed
status updates; all 1,079 packaged bytes still match the installed acceptance.
Package/lockfile, original proposal fixture, original recipe and HEAD remain
unchanged. No new dependencies, document, archive tree, schema, layout flag or
alias catalog. No commit/push/PR/remote CI/publication or live run was performed.
Evidence is outside the repository at the workspace identified by
/private/tmp/skillfit-bench-maintenance-location.txt, including baseline and
migration maps, initial/final tests, integrated review, final-input integrity,
pack/install, installed feature and old-native acceptance receipts.

## Entry-document review and verification

D1: GitHub's README guide describes purpose, usefulness, getting started and help;
the official AGENTS format separates agent instructions from human onboarding and
requires no fixed section schema. Compared uv's README and Ruff's contribution
entry points without adopting their unrelated tooling or approval policies.
Original SkillsBench v4, Evaluating AGENTS.md v3 (section 4.2) and Snyk's dated
ToxicSkills study support the README's quoted figures; these are external study
results, not validation of skillfit. Review found no need for a new document,
formatter, universal length gate or agent-specific instruction tree.

D2: moved install/first preview ahead of research/history in both READMEs; clarified
that the fixed source walkthrough is reproducible and its features now exist on
main, while npm 0.13.1 is older. Consolidated repeated reference links and command
summaries, added issue/help routing, made License a peer section, and removed the
unsupported .mcpb implication. CONTRIBUTING now provides actual checkout/build/test
steps, distinguishes offline validation from optional paid calibration and directs
retained results outside the repository. Existing historical data and links stay.

D3: AGENTS links contributor and architecture owners, identifies compatibility
entries without a brittle test count, consolidates offline-test instructions and
names the existing docs/anchor check. It preserves all project-specific code,
writer/rollback, private-lab, immutable-data and replay boundaries. Complex work
uses this sole plan and records results per step; no new approval mechanism.

D4 final local acceptance (macOS arm64 / Node 24.21.0):

- One integrated OCR-guided review accounted for all five modified paths. OCR
  filters Markdown as unsupported; all five were manually reviewed against the
  frozen diff, baseline instructions and this task. Zero skipped paths or
  unresolved findings. This was local review, not an independent second reviewer.
- Contributor setup executed with `npm ci --offline --no-audit --no-fund` using
  the existing cache. `npm test` rebuilt successfully: 1,068 tests, 1,067 pass,
  one failure, zero cancel/skip (109.31 seconds). The only failure was the sandbox
  denying a loopback HTTP listener (EPERM). Retained that log; reran the unchanged
  MCP test file outside that restriction: all 11 pass, including the failed case.
  Every suite case therefore has a passing result across these runs; this is not
  described as a single all-green full-suite invocation. No assertions changed.
- Existing docs gate: 34 registered documents, zero errors, all 73 previous
  headings/paths accounted against baseline 3472a8701524a59b0c048b4477236dee388615c7.
  Both READMEs preserve all 15 fenced blocks and five badges byte-for-byte from
  baseline; their ordered blocks/headings remain bilingual. Bundled GFM rendering
  produces Install/First run as the entry sections, 15 pre blocks and three
  tables in each language. No browser/GitHub pixel-render claim.
- Fresh offline npm pack/install: all 1,079 installed files match final source;
  29 shipped public documents have zero link/version errors. Five distinct fixed
  snapshot targets used by these changed documents resolve from local Git,
  including their Markdown anchors. Built/installed help works. npm pack initially
  hit the sandbox's global-cache write restriction; a fresh temporary cache
  succeeded without changing ownership or the user's cache.
- Installed acceptance: 31 regressions, five moved portable replays, four release
  entry documents and disposable configuration preview/install/reinstall/bundle
  checks pass. Zero model/real agent calls or actual user-configuration writes.
- Only the five planned Markdown files changed. Product, test, Bench, package,
  lockfile, workflow and historical bytes remain unchanged. No new maintained
  document, dependency, remote CI, PR, commit/push or publication. Other operating
  systems/live agents and arbitrary external URL availability were not retested.

D5–D6 delivery follow-up: user authorized this review/commit/push after D4. All
five D4 hashes initially match, with no unrelated edits. The earlier sandbox HTTP
failure is retained; run one complete offline suite with local listening allowed
before committing. Other D4 proofs may be reused only for identical final inputs.
Remote preflight confirms the branch remains at 3472a8701524a59b0c048b4477236dee388615c7,
main remains 655bccaa384bbc3d0dc5602e76efa63968272ece and the branch has no open
PR. Existing CI runs on main pushes/PRs; this branch push with [skip ci] does not
request CI. No workflow setting is changed.

D5 scope correction, reviewed before editing: the existing bug-report template
claims artifacts never contain secrets. Trial execution writes verifier output
into _verifier.txt and retains task/model output, so this unconditional promise
is false. Replace only that description with instructions to inspect private
content and share a minimal sanitized copy, leaving native replay bytes intact.
This sixth path is contributor-facing text, not a product/schema/workflow change.
The full pre-commit suite just passed 1,068/1,068 with no failure/cancel/skip
(101.81 seconds). It predates this description-only fix; validate the final YAML
and changed line separately rather than rerun unaffected tests. Ruby/Psych parsed
both original/final issue forms successfully; a structural comparison confirms
only the artifacts description changed, with all required fields/ids/types intact.
No parser/tool dependency was added. Bundled Node/Python YAML modules were
unavailable; their failed availability attempts were not treated as verification.

D5 complete: the integrated review now covers six paths (one OCR-selected YAML,
five manually accounted Markdown files). Reused D4 review only for unchanged
inputs and checked the new template and plan against the source writer and OCR
issue-form rules. No unresolved finding remains. Final docs gate remains 34
registered files/zero errors, with all 73 old anchors/paths preserved. All 1,079
packaged files still match D4's actual installation, retaining its 31 regressions
and five portable replays. Product, fixtures, receipts and native replay bytes
are unchanged.

D6 delivered: committed exactly the six reviewed paths as
`df2d6ebab870f6a4cbaedb7810fc4e0fb6eeb04d` with [skip ci] and pushed non-force
to origin/codex/docs-framework-architecture. Independent git ls-remote returned
that exact commit. Main stayed at 655bccaa384bbc3d0dc5602e76efa63968272ece.
No PR was created and no remote workflow was dispatched. This status-only
follow-up changes this plan alone; the final status ref and absence of new CI
runs are checked in the handoff. Installation/replay and final package-byte
proofs still apply because none of their inputs changed. No additional full
suite is needed for a status-only plan update; the pre-commit suite and final
docs/diff checks are retained.

Reference guidance: [GitHub README](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes),
[official AGENTS format](https://agents.md/),
[uv README](https://github.com/astral-sh/uv/blob/main/README.md) and
[Ruff contributions](https://github.com/astral-sh/ruff/blob/main/CONTRIBUTING.md).
Proofs stay only in the temporary workspace named by
`/private/tmp/skillfit-entry-docs-review-location.txt`.

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

## Verification

M7 final main acceptance:

- [Main CI 40294723010](https://github.com/remote-controlled-man/skillfit/actions/runs/40294723010)
  attempt 1 passed all eight jobs for 655bccaa384bbc3d0dc5602e76efa63968272ece.
  Existing `release-source.mjs ci` collected and validated the actual three
  full OS receipts, run/attempt, job identity, Node version, source and counts.
  Ubuntu/macOS each passed 1,068 tests with zero fail/cancel/skip. Windows passed
  1,064 of 1,065 tests, zero fail/cancel and one existing POSIX-only skip.
  Windows offline install completed in 37,776 ms; all later package checks and
  the complete public/Bench workflow passed. All four compatibility jobs and
  the minimum-runtime job succeeded; no extra dispatch or model calls.
- Main's complete Git tree equals reviewed candidate 153c014 exactly. All
  1,989 intended deletions match the original list. Tracked and owned physical
  archive/evidence/history trees are absent; no archive catalog/restorer remains.
  Original source 5a3c9c8 retains all six consumed snapshot commits as ancestors.
- All 1,079 installed package bytes remain those already accepted in M3; M6a
  modifies only an unshipped test and this plan. The local five-mode installed
  replay acceptance is reused for those identical payloads, alongside actual
  package/install/self-test and native-export checks in the three-OS CI. These
  scopes remain distinct; no new historical study is restored or executed.
- Final plan facts/links/diff pass: 34 documentation entries, zero errors;
  18 main-plan and 1,499 original-main paths/headings accounted. No product or
  package inputs changed after successful main CI.
  The delivery commit incorporates main and original source as parents; its
  only tree difference from main is this plan. Retain the original branch,
  let the temporary PR branch be removed, and compare final remote refs before
  reporting delivery. No second PR, extra CI round, rule change or publication.
- Final proof directory: /var/folders/4t/l1rh16096gnd19k20pxhc5lr0000gn/T/skillfit-framework-merge-50s4fkv1.

M6 merge: PR #57 was squash-merged at 2026-10-26T08:47:24Z as
655bccaa384bbc3d0dc5602e76efa63968272ece, after all eight final PR checks passed.
The explicit final title/body contains no CI-skip instructions. No second PR or
publication was created. M7 verified automatic main CI for this exact SHA.

M6 final PR acceptance: run 40293096838 attempt 1 passed all eight jobs on
153c0141046c27e5a96fb59af694b45c0d0fbe99. The pre-merge query found PR #57
mergeable/CLEAN, targeting main 3a3ff4. Windows's real offline installation completed in
48,429 ms; all subsequent package/bin/docs/request/self-test checks passed.
Actual Windows counts: 1,065 tests, 1,064 pass, zero fail/cancel, one unchanged
POSIX-only skip. A variable-duration installation exceeded the old envelope on
the original run; no package defect was observed after the bounded allowance.
The actual Windows receipt, timing and all eight job conclusions are retained
externally. This status update was held for M7 delivery so recording outcomes
does not trigger another PR CI round.

M6a red evidence: PR run 40290734964 attempt 1 passed seven jobs; Windows failed
only `actual offline npm package matches the reviewed inventory and active
runtime` at check-package.test.mjs:63. Offline npm install hit spawnSync's
60-second timeout (cmd.exe ETIMEDOUT); Windows receipt records 1,065 tests,
1,063 pass, one fail, zero cancellations and one platform skip. Keep that failed
receipt and tests.log in the external proof directory. This is a test envelope
failure, not proof of a product installation defect. The Windows-only timing
probe below must still complete the actual install and every existing assertion;
native macOS tests alone cannot confirm the Windows hypothesis.

M6a local follow-up: the unchanged existing package assertions plus the bounded
Windows-only allowance passed full macOS npm test: 1,068 pass, zero fail/cancel/
skip (107.48 seconds). The code change is five added lines and one replaced
timeout in check-package.test.mjs; no runtime, package payload, protocol, workflow
or dependency changed. OCR-guided integrated review accounted for this test and
the manually reviewed plan, zero skipped/unresolved findings. No independent
reviewer. Preserve the original failed CI and require final actual remote results.
The one existing Windows skip is the POSIX escaped-descendant drain test, not
a new skip introduced by this correction.

M6 candidate: source 5a3c9c832be5893a21a3fac9c63992b68ba1e13d was preserved on
origin/codex/docs-framework-architecture. Integration b5a052e55a79961d81b8f37f71dc2b8c1cc6cf10
is one clean commit on main 3a3ff4, with the identical tree
a181ce5e05a7a91b957baa26d7fcc1611a35346e. All 2,305 changed paths and 1,989
deletions are preserved. [PR #57](https://github.com/remote-controlled-man/skillfit/pull/57)
was the sole PR and started existing CI; results were pending and main had not
yet merged at this stage. M6–M7 above record the final outcomes.
Proof directory: /var/folders/4t/l1rh16096gnd19k20pxhc5lr0000gn/T/skillfit-framework-merge-50s4fkv1.

M6 preparation: live main remains 3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850
and the retained delivery branch remains 6b20bc143a7762d7a085386c009dc2e6135b9c04;
no open PR exists. A tracked-file audit found no archive/evidence/history
directory or archive/historical/restore-named file. No additional product
deletion is needed; the cumulative deletion list must survive integration.
Package archives and current saved-result/replay code still have active consumers.
All product/package inputs remain those accepted in M3; only this plan changed.

M5 CI suitability review:

- Reviewed current ci-scope/build/package tests, workflow assertions, source-CI
  receipt consumer, installed feature recipe and native portable export tests.
  The checks use current owners and do not restore retired archive trees. The
  existing test matrix is three Node-22 OS jobs, four Linux Node compatibility
  jobs and one minimum-runtime job. No new job/check/dependency is needed for
  the integration shape reviewed here; actual remote compatibility is unverified.
- A real shallow Git checkout with only the synthetic PR merge and two visible
  parents passed existing `classify` and `documentation` commands against main
  3a3ff4/source 6b20bc1: full scope, 2,305 paths, available baseline, zero errors,
  all 1,499 old paths/headings accounted. This specifically checks the current
  depth-two checkout arrangement, not just an event-variable fixture.
- A separate temporary one-clean-commit integration was exercised as both a PR
  merge and a main push in a shallow checkout. Both selected full scope and
  passed all 1,499 migrations. Exact Git-tree comparison found only the current
  plan update versus source 6b20bc1; all package/runtime files are unchanged.
  This rehearses a proposed route, not a remotely created commit or CI run.
- Live repository settings permit squash, use COMMIT_MESSAGES for the default
  squash body and delete the merged head branch automatically. Eleven earlier
  source messages contain skip instructions; the current tip does not. GitHub's
  [skip behavior](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs)
  and [push/PR distinction](https://github.blog/changelog/2021-02-08-github-actions-skip-pull-request-and-push-workflows-with-skip-ci/)
  make an explicit clean message necessary. Preserve the consumed original
  branch and let only a temporary integration branch be auto-deleted.
- Reused M3's 1,068 tests, actual installation and five-mode installed replay
  acceptance only for the unchanged source/package inputs. No repeated full
  suite or repack was needed for this plan-only follow-up. No PR, remote write,
  CI dispatch, merge, user-configuration write, model call or publication.
- Proof directory: /var/folders/4t/l1rh16096gnd19k20pxhc5lr0000gn/T/skillfit-ci-readiness-_tjqaj_0.

M4: source candidate a59848a8ffd12f4403ea91ac04bb10d987c99817 was committed
after the full local suite and final docs/link/package/diff checks, then pushed
without force to origin/codex/docs-framework-architecture. Independent ls-remote
matched the candidate and confirmed main remained at 3a3ff4. This status-only
follow-up changes no accepted package/runtime byte. The required remote-route
question is pending; no PR, remote CI, merge or npm publication occurred.

M3 final local acceptance (Node 24.21.0 / macOS arm64):

- Existing `ci-scope.mjs classify` selected full scope for the cumulative
  main-to-source changes. Its actual `test` entry passed the documentation gate
  and full npm test: 1,068 passed, zero failed/cancelled/skipped. This rehearsal
  supplied the exact main baseline through a local event fixture; it is not a
  GitHub run, committed-source receipt, or proof of other OS/Node versions.
- All eight public workflow/Bench checks passed under disposable HOME and a
  Node/Git-only PATH: help, eval preview, synthetic report, install preview,
  doctor, both packaged Bench checks and contributed Bench integrity. Fresh
  installed empty-history report JSON also passed. No real Agent/model calls or
  actual user-configuration writes.
- Fresh offline npm pack/install/bin and package policy passed. All 1,079
  installed files match source. Installed feature acceptance passed 31
  regressions, five portable replays, four release-entry documents, fake-process
  success/failure and disposable configuration/bundle safeguards. Archive:
  947,794 compressed / 4,580,168 unpacked bytes; SHA-256
  b9e50e3c6e504e23a8536c81e39f6e39a2ca00925a37c0a144cfc148cd1b2985.
- All 29 shipped public documents pass link/anchor checks without package Git;
  the four newly selected historical snapshot targets exist in local Git.
  Architecture: 159 modules, zero violations/exceptions. Main-baseline docs:
  34 entries, zero errors, 1,499 previous paths/headings accounted.
- One integrated local OCR-guided review accounted for all four incremental
  paths (one selected test and three manually reviewed Markdown files), zero
  skipped or unresolved findings. No independent reviewer. Prior accepted
  runtime/package inputs remain unchanged; this correction adds only immutable
  navigation and an offline regression. Final status text is checked afterward.
- Version remains 0.13.1; this did not publish a package. No new maintained file,
  dependency, Calibration change, historical-byte rewrite or native format change.
  R3 remains incomplete until the conflicting remote integration route is
  clarified and the permitted merge/checks actually succeed.
- Proof directory: /var/folders/4t/l1rh16096gnd19k20pxhc5lr0000gn/T/skillfit-main-integration-j2oxg4vt.

M2: the new offline regression failed on retained publication-era headings and
retired docs/evidence paths, then passed after four immutable snapshot-navigation
links were added to the two existing indexes. The actual main-baseline gate now
passes all 1,499 prior headings/paths with zero errors (previously 287 errors).
No new page, archive restoration, protocol change or weakened check. M3 rehearses
the existing local CI entry against main before asking about the remote route.


M1: queried live main rulesets read-only (classic protection returns 404, but
rulesets enforce PR + test (windows-latest), test (ubuntu-latest), test (macos-latest)).
No open PR on the delivery branch. Live main/source refs match the last delivery.
The existing gate against actual main reports 287 migration errors: 274 deleted
pages (76 docs, 198 evidence) and 13 old headings in two retained indexes. Earlier
L5 gates used the adjacent ed5eaff baseline; that did not prove the cumulative
main integration. No runtime failure is implied; do not weaken the gate. Plan
updated/reviewed before M2. Proof directory: /var/folders/4t/l1rh16096gnd19k20pxhc5lr0000gn/T/skillfit-main-integration-j2oxg4vt.

R1: local HEAD is the delivered 3404dcd and the working tree was clean before
this plan edit. Reviewed package metadata, changelog, release procedure and the
cumulative diff against recorded main 3a3ff4. Scope and proposed order are above;
no version/registry probe, source change, remote CI, merge or publication occurred.
Only plan facts/links/diff need checking now. Existing L5 tests/install/replay
results remain prior evidence, not new R2 acceptance.


L5 final review, local acceptance and delivery (Node 24.21.0 / macOS arm64):

- All 15 inputs matched the final L4 manifest before delivery updates. Integrated
  local OCR-guided review accounted for three selected code files and 12 filtered
  documents/tests, zero skipped or unresolved findings. No independent reviewer.
  Only authorization/status text changed after the previously reviewed source.
- Fresh full offline npm test: 1,067 passed, zero failed/cancelled/skipped
  (104.75 seconds). Architecture: 159 modules, zero violations/exceptions.
- Fresh link checks: 34 registered docs, zero errors, 177 old headings/paths
  accounted. Verified 22 selected snapshot targets/anchors from Git; all 29
  installed public pages and the standalone driver pass without package Git.
  The exact source-checkout command/proof still selects the driver snapshot.
- Reused the actual L4 offline installation only after verifying archive SHA-256
  91873c64a5f1fc11e030bd5651fa272c80271234c5dd9b94104c0a7b4a6a6812 and
  all 1,079 installed files against current source; no repack/reinstall was needed.
  Fresh installed bin/four entry-doc checks pass. Fresh installed feature acceptance
  passed 31 regressions, five portable replays, fake-process success/failure and
  disposable configuration/bundle checks. Zero real model/agent calls or actual
  user-configuration writes; runtime, formats and statistical text are unchanged.
- Remote baseline independently read: delivery branch ed5eaff7d222de1c73874ce022785fbe89291017,
  main 3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850. Push only the named branch,
  without force; use `[skip ci]` alongside the main-only push CI trigger. No PR,
  remote CI, publication, new maintained file, dependency or runtime format.
- Source commit `9fdeca657bbb1b0cbc0a152409b333e8a48a8185` was pushed without force to
  `origin/codex/docs-framework-architecture`. Independent ls-remote matched local
  HEAD exactly; remote main was unchanged and the working tree was clean. This
  status-only follow-up records the result, changing no accepted package/runtime
  byte. Verify its final push by another independent remote-ref read.
  Status-only documentation checks: 43 passed, zero fail/cancel/skip; final
  source/package inputs remain identical to the accepted source delivery.
- Delivery proof directory: /var/folders/4t/l1rh16096gnd19k20pxhc5lr0000gn/T/skillfit-link-entry-delivery-y75ux1bx.

L1: reviewed the absolute-URL bypass, standalone driver distribution, source/npm
entries and package exclusions before implementation. Relative links cannot
replace source-only targets or standalone-driver URLs indiscriminately. The
scoped existing-check approach needs no crawler, registry, dependency or fetch.

L2: the regression first failed because six moving-ref links produced zero errors,
then passed after a 13-line extension to inspectDocumentation. Main, moving tags
and feature branches are rejected for source-sensitive paths. Full commits,
live contribution/security/workflow channels and other repositories stay valid.
This enforces reference syntax offline, not arbitrary external HTTP availability.

L3: fixed source-sensitive links to the delivered ed5eaff snapshot and kept
co-distributed links relative. Source-only active progress is named as a path,
not an npm link. README/Skill/docs distinguish npm 0.13.1 from source additions;
the release manual requires refreshing affected snapshots. Review found clone
alone selects old main: the new source-entry regression failed, then passed
when both README recipes explicitly selected the same full commit as the driver
before npm ci/build. The checkout executed successfully in an offline disposable
clone starting from old main. Published npm/demo blocks, feature minimums and
historical snapshots are unchanged. The previous assertion requiring a broken
main-plan link now requires the explicit source-only path and rejects an
unshipped package-relative plan link; other README/command checks are preserved.

L4 final acceptance (Node 24.21.0 / macOS arm64):

- One integrated local OCR-guided review covered all 15 modified paths: three
  selected files and 12 filtered documents/tests; zero skipped/findings. No
  independent reviewer was used. Status-only plan edits were inspected afterward.
- Final full offline npm test: 1,067 passed, zero failed/cancelled/skipped
  (109.82 seconds). Before the source-entry follow-up, the earlier suite passed
  1,065/1,066 and exposed the old assertion requiring the broken main-plan link;
  preserved that failure, corrected its contract as described in L3, and reran
  the complete final suite. Final focused docs/registry/entry checks: 43 pass.
- Verified 22 selected full-commit link targets and Markdown anchors from local
  Git, without fetching history or contacting GitHub. The documented source
  checkout selects ed5eaff from old main and exposes the required guides.
- Fresh offline npm pack/install/bin/Skill/docs and package policy pass: all
  1,079 installed files match final source. The 29 shipped public documents pass
  relative links/anchors and the new source-reference check. A standalone copy
  of the driver also passes without sibling docs, registry or Git checkout.
- Fresh installed acceptance: 31 regressions, five portable replays, four release
  entry documents, fake-process success/failure and disposable configuration/
  bundle checks passed. Zero model/real agent calls or actual user-config writes.
- Package: 947,712 compressed / 4,579,570 unpacked bytes; SHA-256
  91873c64a5f1fc11e030bd5651fa272c80271234c5dd9b94104c0a7b4a6a6812.
- Architecture: 159 modules, zero violations/exceptions. Docs: 34 entries,
  zero errors against ed5eaff, 177 previous headings/paths accounted. Docs stays
  at 11 pages. npm excludes the plan and development tools as before.
- Runtime, Calibration, formats, Bench data, package/lockfile and frozen feature
  recipes are unchanged. Statistical text from Unit of analysis onward is
  byte-identical. Both README command/demo block sets match baseline after
  removing only the newly required source checkout line. No new tracked file,
  dependency, maintained document, remote CI, PR, publication, commit or push.
- Acceptance is local macOS/Node 24. Other OS/live Agent/registry checks were not
  run. They are outside this task; external URL hosting is not guaranteed by
  offline pin validation.

Exact current proof directory: /var/folders/4t/l1rh16096gnd19k20pxhc5lr0000gn/T/skillfit-document-entries-2e6uv63r.

## Previous verified delivery

W1–W5 corrected documents/releases and established explicit experiment/data
lifecycle rules, then delivered source cc7315f and status follow-up ed5eaff to
the authorized branch. Fresh final source suite: 1,065 pass; installed acceptance:
31 regressions, five portable replays and four entry-document checks. All 1,079
installed files matched source; relocated replay preserved all 607 package files.
Docs: 34 entries/11 pages, 117 old paths/headings accounted; architecture: 159
modules, zero violations. These are baseline results, not fresh L4 acceptance.
Complete previous plan/proofs: [fixed W1–W5 plan](https://github.com/remote-controlled-man/skillfit/blob/ed5eaff7d222de1c73874ce022785fbe89291017/docs/work/current.md).

P1–P5 / Q1–Q3 removed unused repository archive infrastructure. Source b16d191 and
plan follow-up e0baacb were pushed to the authorized branch; final remote/local
HEAD matched and working tree was clean. Offline suite: 1,065 pass, zero skip;
architecture 159 modules and docs 34 entries passed. Installed 31 regressions,
five portable replays and four release-document checks passed. Seven consumed
fixtures moved with identical bytes; old Git/published observations were unchanged.
These are baseline results, not fresh acceptance for this document revision.

The complete prior plan and historical evidence limits remain at the
[fixed plan](https://github.com/remote-controlled-man/skillfit/blob/e0baacb49981349a145b4ddb0477e7d82da3255d/docs/work/current.md).

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
<a id="delivery-review-and-progress"></a>
<a id="decisions-and-research"></a>
<a id="previous-verified-input"></a>
