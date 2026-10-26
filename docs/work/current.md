# Current work

## Status

- Baseline: clean local `main` at 3404dcd4ffdf990a31b325fb9fd24d84df949c72;
  the last delivery independently matched origin/codex/docs-framework-architecture.
- Current task: integrate the reviewed cumulative source into main through the
  authorized temporary branch, one PR and existing CI; keep retired archive
  trees absent and preserve installed workflows and current saved replay.
- Progress: W1–W5 and L1–L5 complete; R1 scope review and M1–M3 local merge
  verification complete. R3 integration is in progress through PR #57 and its
  existing CI; R2 version preparation and R4 publication remain
  separate proposed work, not prerequisites for this source-only merge.
- CI suitability follow-up: M5 complete locally. Current CI remains suitable;
  M6's clean temporary integration branch and one existing CI route are now
  authorized. No workflow or product code change was needed for CI suitability.
- Delivery: reviewed candidate a59848a8ffd12f4403ea91ac04bb10d987c99817 is pushed
  to origin/codex/docs-framework-architecture; independent remote read matched.
  Main remains 3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850. No merge occurred.
- Scope: existing plan/docs and necessary offline regressions. User authorized
  merging only after successful review/flow validation; no version bump or npm
  publication. No new maintained document, dependency, Calibration refactor, real
  experiment or actual user-configuration write. The user approved this one
  PR/remote-CI integration route after its review; earlier no-PR/no-CI limits
  remain historical task constraints, not a prohibition on this approved route.

## Execution order and acceptance

| Order | Work / dependency | Status | Acceptance / verification |
| --- | --- | --- | --- |
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
| R2 | Prepare candidate version and local release inputs; after R1 | Proposed; not executed | Candidate 0.14.0, subject to an unpublished-version check. Synchronize package/lockfile/changelog and current README/Skill command pins, source-only availability notes and implementing-source snapshots; preserve historical minima and old publication links. Review the cumulative main-to-branch scope, then run local tests, actual pack/install/docs and portable replay. |
| R3 | Validate then integrate reviewed source; after R1 for this source-only merge | Local verification complete; authorized integration in progress | Main rules require a PR and three OS checks; the user approved one PR and existing CI. Use the reviewed temporary integration branch, preserve protections and consumed source snapshots, then verify exact main CI. No version bump, publication or paid experiment. |
| R4 | Preview, publish once and verify delivery; after R3 | Pending publication authorization | Inspect the exact preview attempt/tarball/hash, then promote those bytes for a new unpublished version. All six existing acceptance stages must pass; retain complete receipts externally and update this plan. Never repack between reviewed preview and upload, repeat an ambiguous upload or run real models. |
| M1 | Review actual merge baseline, rules and local CI entry; within R3 | Complete | Main remains 3a3ff4 and delivery branch 3404dcd; no open PR. Rulesets require a PR and windows/ubuntu/macos status checks. Exact-main docs gate currently fails 287 old path/anchor migrations; preserve that failure and fix it before claiming merge readiness. |
| M2 | Add bounded regression and exact-main snapshot navigation; after M1 | Complete | Existing docs gate must cover representative publication-era retained headings plus retired docs/evidence paths without requiring Git history in tests. Add only fixed snapshot links in existing docs/Bench indexes; preserve all original bytes at 3a3ff4, no restored archive or new page. Full actual-main gate must account for every old path/heading. |
| M3 | Local equivalent of the CI workflow and installed acceptance; after M2 | Complete locally | Existing full-scope CI entry passed 1,068 tests against exact main; public CLI/Bench steps, fresh installed 31 regressions/five portable replays, 29 installed documents and immutable snapshot targets passed. This is macOS/Node 24 working-tree acceptance, not remote or exact-source CI proof. No model calls. |
| M4 | Deliver reviewed candidate and resolve required remote route; after M3 | Complete; M6 subsequently authorized | Four reviewed paths committed and pushed only to origin/codex/docs-framework-architecture without force; independent source ref matched a59848a and main stayed unchanged. The user subsequently authorized M6's one PR/existing-CI route, without npm publication. |
| M5 | Review CI suitability and integration-message/history risks; after M4 | Complete locally | Current CI owner paths and gates remain applicable. A depth-two shallow PR merge and the proposed clean integration's PR/main-push shapes all select full scope and pass the 1,499 old path/anchor migrations. Product/package trees remain identical; only this plan differs. Found eleven CI-skip messages, default squash message aggregation and automatic branch deletion; M6 avoids those risks without changing CI. |
| M6 | One temporary integration branch and existing CI; after M5 | PR #57; first CI 7/8 passed, Windows installation test timeout under repair | Retained source 5a3c9c8 and initial integration b5a052e have identical trees. PR #57 preserves all 1,989 deletions. Windows's real offline npm install exceeded its test-only 60-second envelope; M6a changes only the bounded Windows test allowance and records timing. Retain every installation/inventory/self-test assertion, then require the final PR checks before merging. No workflow/platform, protection, publication or real experiment change. |
| M6a | Diagnose and verify Windows package-test timeout; within M6 | Local 1,068 tests passed; final Windows/PR verification pending | Preserved first-run logs/receipt. Existing package test is the observed red seam: spawnSync cmd.exe ETIMEDOUT at offline npm install, 1,063 pass / 1 fail / 1 skip. Only the Windows install-test envelope becomes 120 seconds with timing diagnostics; other systems keep 60 seconds. Product/install/verifier deadlines and assertions are unchanged. Integrated review covered the two changed paths; require actual Windows/full PR success, not a synthetic Windows claim from macOS. |
| M7 | Exact main CI, tree/deletion verification and final status; after M6 | Pending M6 | Inspect automatic main CI for the actual merged SHA. Confirm source/package files and all intended deletions against the reviewed candidate; verify the original snapshot branch remains. Update this sole plan with real PR/CI/merge outcomes on the retained delivery branch, incorporating main as an ancestor. Do not open another PR or trigger another full CI solely to record post-merge status. |

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
main; the comparison here uses the recorded main baseline, not an unchecked claim
that the remote has remained unchanged. The existing release contract requires
exact-source main CI, so no publication is executable under the retained no-CI
constraint. Do not weaken that contract or create another release route.


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
The release workflow is not dispatched. This link-entry follow-up makes only
local source/documentation checks and the authorized branch delivery; release
dispatch, PR creation and remote CI remain outside this follow-up.

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
is the sole PR and starts existing CI; results are pending. Main has not merged.
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
