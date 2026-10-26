# Current work

## Status

- Baseline: clean local `main` at ed5eaff7d222de1c73874ce022785fbe89291017;
  the previously authorized delivery branch was independently verified at this HEAD.
- Current task: fix version-sensitive documentation links and build/version entry
  instructions, with small offline regression checks in the existing doc gates.
- Progress: W1–W5 complete (previous delivery); L1–L4 complete; L5 review/local acceptance complete; commit/push pending.
- Scope: existing documents and documentation checks/tests only. No maintained
  document, dependency, crawler, URL registry, runtime format or version bump.
  Calibration, real experiments and runtime/configuration behavior stay unchanged.
  No PR, remote CI, model/agent call, publication or actual user-configuration
  write. The current follow-up authorizes commit/push only to
  `origin/codex/docs-framework-architecture`, without force, PR or remote CI.

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
| L5 | Review exact final inputs and deliver to the authorized branch; after L4 | Checks complete; delivery pending | Reconcile all 15 final paths and link/build/installed proofs, run full offline npm test before committing, update this plan, commit with `[skip ci]`, push only origin/codex/docs-framework-architecture without force, then independently compare remote/local HEAD. Preserve main, installation and replay; record actual results and source delivery. |

## Decisions and limits

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

L5 pre-commit acceptance (Node 24.21.0 / macOS arm64):

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
- Commit/push and exact remote/local HEAD comparison remain pending; a status-only
  follow-up records the verified delivery. Final plan/diff checks run before commit.
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
