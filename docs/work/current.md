# Current work

## Status

- Current task: R5 checked integration and formal 0.14.0 preview are in progress;
  R2 source delivery and candidate preparation are complete;
  B1–B5/C1–C4 are complete. The user approved continuing delivery/preparation.
  Remaining gap: merged main Windows CI failed on verifier-fixture readiness;
  its local test-only fix passes and the user now authorizes one additional
  protected-branch repair PR, its CI/merge, exact-main CI and formal preview.
  No formal preview or npm upload has occurred.
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
- Delivery boundary: original PR #58 is merged; the user now authorizes one
  additional bounded test-fix PR, existing necessary CI, merge after successful
  checks, exact-main CI and formal dry-run publication preview. npm upload still
  requires separate review/authorization. Keep existing source/CI/package gates;
  do not add automatic deletion, paid runs or a further unapproved PR.
- Source baseline: c9522ddea4c181056f1065e04f3ee0f69845146a, clean at this phase's
  start. At that point the remote delivery branch was 8d8ff24c7adddb0cc1e7f3653a56baddeefef363;
  remote main was 655bccaa384bbc3d0dc5602e76efa63968272ece. Official npm
  registry returns latest=0.13.1 and HTTP 404 for 0.14.0 at preparation time;
  reserve no version and recheck availability before any future upload.


## Execution order and acceptance

| Order | Work / dependency | Status | Acceptance / verification |
| --- | --- | --- | --- |
| R5a | Reconcile authorization, actual main and existing release gates; after R2d | Complete | Remote main is 655bcca and candidate is 90e9b83, with no open PR. Reuse byte-identical installed/local proof; preflight the actual main docs baseline and CI scope before creating the PR. Found 108 false compatibility failures for moved historical Bench data; preserve the failure log. |
| R5b | Fix historical input classification and review affected inputs; after R5a | Complete | Test first through the existing baseline-reader/documentation gate. Use the fixed baseline's existing exclusions for its task data, retaining real document/card paths, private-path protection and missing-evidence failures. No retired-path catalog, broad bypass, restored inputs or new document. Verify targeted tests, exact-main docs gate, architecture and npm test; packaged bytes must remain identical to R2c. |
| R5c | Deliver one PR and wait for existing CI; after R5b | Complete; PR #58 checks passed | Push the reviewed plan/tool fix once, create one PR with actual behavior, tests and AI disclosure, and attach it. Reuse the unchanged CI workflow; all eight checks, including three required OS jobs, must succeed. Preserve exact source and avoid status-only pushes during the PR run. |
| R5d | Merge and validate exact-source main CI; after R5c | Merged; main Windows CI failed | Use an explicit clean merge title/body to retain pinned source ancestry and avoid old skip markers. Verify merged product tree and intended deletions, then wait for the automatically triggered main push CI. Require its exact three full OS receipts; PR/local proofs cannot replace them. |
| R5f | Diagnose main Windows startup failure and prepare the bounded test fix; after R5d failure | Complete locally; repair delivery authorized | Preserve failed run/receipt. Reproduce the exact readiness assertion with a delayed offline harness, distinguish setup readiness from interruption semantics, and verify the smallest test-only envelope correction. Keep kill-tree, usage/sealing assertions and the post-interrupt 10-second deadline. Run affected tests/full offline suite and review package-byte identity. The user subsequently authorizes R5g–R5h; do not bypass source CI or start preview/publication early. |
| R5g | Deliver the authorized bounded test repair PR; after R5f | In progress | Reconcile unchanged reviewed inputs, update this original plan, commit only the test/plan, push non-force, create and attach one repair PR. Existing eight CI jobs must pass; preserve all interruption assertions and package bytes. No status-only push while checks run. |
| R5h | Merge repair and validate exact-main CI; after R5g | Pending | Merge the exact checked repair with a clean message. Confirm main product bytes and consumed commit ancestry; require the automatically triggered eight main checks and the same-attempt full three-OS source receipts before preview. Retain the original failed run; no blind rerun or weakened gate. |
| R5e | Generate, inspect and retain the formal preview; after R5h | Pending successful main CI | Dispatch npm-release.yml once on the verified main with dry_run=true. Download the exact successful run/attempt artifact, validate source/CI identities, original tarball integrity/version/size/package bytes and summary. Retain the complete artifact externally; update this original plan without moving main after preview. Never upload npm or claim registry/provenance/signature acceptance during a preview. |
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
| R4 | Preview, publish once and verify delivery; after R3 | Pending publication authorization | Inspect the exact preview attempt/tarball/hash, then promote those bytes for a new unpublished version. All six existing acceptance stages must pass; retain complete receipts externally and update this plan. Never repack between reviewed preview and upload, repeat an ambiguous upload or run real models. |
| M1 | Review actual merge baseline, rules and local CI entry; within R3 | Complete | Main remains 3a3ff4 and delivery branch 3404dcd; no open PR. Rulesets require a PR and windows/ubuntu/macos status checks. Exact-main docs gate currently fails 287 old path/anchor migrations; preserve that failure and fix it before claiming merge readiness. |
| M2 | Add bounded regression and exact-main snapshot navigation; after M1 | Complete | Existing docs gate must cover representative publication-era retained headings plus retired docs/evidence paths without requiring Git history in tests. Add only fixed snapshot links in existing docs/Bench indexes; preserve all original bytes at 3a3ff4, no restored archive or new page. Full actual-main gate must account for every old path/heading. |
| M3 | Local equivalent of the CI workflow and installed acceptance; after M2 | Complete locally | Existing full-scope CI entry passed 1,068 tests against exact main; public CLI/Bench steps, fresh installed 31 regressions/five portable replays, 29 installed documents and immutable snapshot targets passed. This is macOS/Node 24 working-tree acceptance, not remote or exact-source CI proof. No model calls. |
| M4 | Deliver reviewed candidate and resolve required remote route; after M3 | Complete; M6 subsequently authorized | Four reviewed paths committed and pushed only to origin/codex/docs-framework-architecture without force; independent source ref matched a59848a and main stayed unchanged. The user subsequently authorized M6's one PR/existing-CI route, without npm publication. |
| M5 | Review CI suitability and integration-message/history risks; after M4 | Complete locally | Current CI owner paths and gates remain applicable. A depth-two shallow PR merge and the proposed clean integration's PR/main-push shapes all select full scope and pass the 1,499 old path/anchor migrations. Product/package trees remain identical; only this plan differs. Found eleven CI-skip messages, default squash message aggregation and automatic branch deletion; M6 avoids those risks without changing CI. |
| M6 | One temporary integration branch and existing CI; after M5 | Complete; PR #57 merged as 655bcca | Retained source 5a3c9c8 and initial integration b5a052e have identical trees. Final candidate 153c014 adds only M6a's package-test envelope and plan updates; all 1,989 deletions remain. Final PR CI passed all eight jobs. Merged with explicit clean title/body, without protection, workflow/platform, publication or real experiment changes. |
| M6a | Diagnose and verify Windows package-test timeout; within M6 | Complete | Original Windows timeout preserved. Local suite: 1,068 pass, zero fail/cancel/skip. Final actual Windows CI: 1,065 tests, 1,064 pass, zero fail/cancel and one existing platform skip; offline install completed in 48,429 ms within the bounded 120-second envelope. Product deadlines and all assertions are unchanged; no claim of deterministic Windows reproduction on macOS. |
| M7 | Exact main CI, tree/deletion verification and final status; after M6 | Complete | Main run 40294723010 passed all eight jobs on 655bccaa384bbc3d0dc5602e76efa63968272ece. Existing source-CI collection validated three full OS receipts; source tree equals the reviewed candidate and all 1,989 deletions remain. This sole-plan follow-up incorporates main into the retained delivery branch, preserving six consumed pins. Verify the final pushed ref independently in the handoff; no new PR or CI run solely for status. |

## Checked integration and preview progress

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
