# Current work

## Status

- Baseline: clean local `main` at e0baacb49981349a145b4ddb0477e7d82da3255d;
  this HEAD was verified at `origin/codex/docs-framework-architecture`.
- Current task: correct existing documentation and release instructions, then
  make experiment workflow, process-data placement, retention and cleanup explicit.
- Progress: W1–W5 complete; reviewed source committed, pushed and independently
  verified at the authorized branch. This follow-up records the verified status.
- Scope: existing documents and their current registry metadata. No new maintained
  document, dependency, registry, runtime format, cleanup command or telemetry
  framework. No PR, remote CI, publication, model/agent calls, actual configuration
  writes or deletion of existing runs. The follow-up authorizes commit and push
  only to `origin/codex/docs-framework-architecture`, with no PR or remote CI.

## Execution order and acceptance

| Order | Work / dependency | Status | Acceptance / verification |
| --- | --- | --- | --- |
| W1 | Reconcile audit findings, consumers and plan | Complete | Reviewed the 11 docs pages, release workflow inputs/order, existing output guards, session sealing and export inventory. Use current owners and commands; keep cleanup a documented explicit manual operation. No unresolved contract choice requires a new mechanism. |
| W2 | Correct document purpose and release manual; after W1 | Complete | Remove obsolete page-count/restoration assertions. Correct reference/how-to registry kinds. Keep one operation authority: workflow for steps, reports for saved fields, metrics for statistical meaning. Complete the existing release page with main/source-CI gate, reviewed preview ID/attempt, original tarball promotion, one upload, acceptance, receipt delivery and failure recovery. Validate instructions against current workflow/tools offline; do not dispatch them. Preserve old headings/anchors and frozen statistical meaning. |
| W3 | Implement workflow and data-handling rules in existing guides; after W2 | Complete | Explain design→offline gates→separate development/calibration→fixed validation/preview→execution→sealed read/analysis→optional delivery→retention/cleanup. Use an ignored outer study workspace with unchanged native batch layout. Separate memory-only values, observed facts and derived metrics. Declare consumers, provenance/unknowns and manual cleanup conditions; protect active/referenced batches and every indexed native file. Clarify custom analysis is not automatically exported and retention intent is separate from native completion status. Link concise rules from architecture/Bench/Skill instead of duplicating them. |
| W4 | Integrated review, runnable example and installed acceptance; after W3 | Complete | Review every final path plus metadata, source facts and links against exact baseline. Run existing docs/release/CLI-reference checks. Execute the complete zero-model tutorial in a fresh temporary outer workspace; derive output outside sealed runs and verify unchanged native bytes/export after analysis. Actual offline npm pack/install/bin/Skill/docs and installed feature recipe must pass 31 regressions and five portable replays. Confirm runtime/manifest/tool behavior unchanged. Full npm test only if code/build behavior changes; otherwise reuse the exact HEAD suite (1,065 pass) and execute affected checks. Record actual results and limits below. |
| W5 | Final review and authorized branch delivery; after W4 | Complete | Freeze/review all 12 modified paths, confirm exact installed acceptance inputs, run `npm test` before committing plus final docs/link/diff checks. Preserve installation and moved replay, use `[skip ci]`, push only the named branch without force, and verify the remote commit equals local HEAD. Update this plan with actual proof and delivery status. |

## Decisions and limits

The module layout is sufficient for this work. Application coordinates,
Execution schedules, Agents supplies observable facts, Records seals and reads,
Measurement derives metrics, CLI presents. Calibration's mixed scheduling and
diagnostic responsibilities remain a future candidate when a real behavior
change needs it; this task adds no abstraction or universal runner.

Documents have distinct reader jobs: tutorial, how-to, reference and explanation.
Do not give every page the same template or impose a permanent page-count cap.
Fix stale facts and duplicate procedures in their existing owners. The release
manual describes the existing authorized workflow, not a new publication path.
The release workflow is not dispatched. The follow-up performs only the
authorized Git branch push and read-only remote-ref verification.

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

Plan review: all proposed changes are local document/metadata edits using existing
commands. Main risks are moving operational text that carries statistical meaning,
claiming automatic cleanup/custom telemetry, and suggesting deletion within a
sealed run. Preserve protocol statements, state capabilities accurately, retain
old anchors and verify the real source tutorial plus installed replay. W4 fails
on a broken command/link, changed native hash or replay mismatch; no acceptance
criterion is removed to make a check pass.

## Verification

W5 final review, local acceptance and source delivery (Node 24.21.0 / macOS arm64):

- Final integrated local review covered all 12 modified paths, including OCR's
  selected JSON and all 11 filtered Markdown files; zero skipped/findings. No
  independent reviewer was used. Source contracts, release workflow and cleanup
  safeguards match the documented behavior; no new implementation was required.
- Fresh full offline `npm test`: 1,065 passed, zero failed/cancelled/skipped
  (70.65 seconds). The first sandboxed attempt passed 1,064 but could not bind
  127.0.0.1 for one MCP test (EPERM); the unchanged suite passed after granting
  local loopback permission. Both observations are preserved, no assertion changed.
- Reused W4's actual offline-installed package only after checking its tarball
  SHA-256 and all 1,079 installed files against current source. Fresh installed
  acceptance passed 31 regressions, five portable replays, four release-document
  checks, fake-process success/failure and disposable configuration/bundle checks.
  No model/real agent call or actual user-configuration write occurred.
- Fresh relocated tutorial replay returned byte-identical complete result JSON
  with the original batch unavailable; all 607 delivery files remained unchanged.
  Verify-only also passed. W4's full ten-command tutorial and 344 native-file
  invariance proof retain identical source inputs and remain applicable.
- Fresh architecture: 159 modules, zero violations/exceptions. Documentation:
  34 entries, zero errors, 117 prior headings/paths accounted. Diff checks pass;
  docs still has 11 pages, no new tracked file, runtime format or dependency.
  The status-only follow-up passed all 41 affected documentation checks.
- Before delivery the remote branch is e0baacb49981349a145b4ddb0477e7d82da3255d;
  remote main is 3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850. Push CI targets only
  main; delivery also uses `[skip ci]`. No PR, remote CI or release dispatch.
- Source commit `cc7315f0ef33333962106d8dbb08413463f329f1` was pushed without force to
  `origin/codex/docs-framework-architecture`; independent `ls-remote` matched
  the complete SHA. Remote main remains unchanged. The working tree was clean.
  This status-only follow-up changes only the plan and preserves every accepted
  package/runtime byte. Its push is also checked by an independent remote-ref read.
- Exact W5 proof directory: /var/folders/4t/l1rh16096gnd19k20pxhc5lr0000gn/T/skillfit-w5-review-mcaoy3dd.

W4 final acceptance (Node 24.21.0 / macOS arm64):

- One integrated OCR-guided review covered all 12 modified paths: the selected
  registry plus 11 filtered Markdown files; zero skipped or remaining findings.
  Review restored the moved tokenCoverage field description at its reference
  owner and retained explicit export-path/external-toolchain constraints.
- Existing focused docs/release/CLI-reference checks: 62 pass, zero fail/skip.
  After the reference-only review fix, 36 affected documentation checks also pass.
  Architecture: 159 modules, zero violations/exceptions. Documentation: 34 entries,
  zero errors against e0baacb; 117 prior headings/paths retained or accounted.
- Executed all 10 tutorial commands in a fresh temporary outer workspace:
  controls, human/JSON read, export/replay, command-bench creation/check and real
  comparison preview. Exactly 27 synthetic executor invocations, zero model or
  real agent CLI calls. Derived analysis and owned scratch cleanup left all 344
  native indexed-file/index hashes unchanged. Moved the complete original batch
  away; the relocated portable package still verified and regraded with identical
  quality, unknown-usage semantics and synthetic ineligibility.
- Final actual offline npm pack/install/bin/Skill and all 29 shipped public-doc
  links pass. Installed acceptance: 31 regressions, five portable replays, four
  release-entry documents, disposable configuration/bundle checks and fake-process
  success/failure. All 1,079 installed files match final source. Package size:
  947,048 compressed / 4,577,532 unpacked bytes; SHA-256
  207be6382cf8264f4e0d3d43870515337565bf2e8be71898bb985a6e11a24e56.
- No runtime/build/executable-tool behavior or native format changed; the only
  tooling metadata edits are two document-kind values. The core statistical
  protocol text is byte-identical. The 1,065-test HEAD suite was not rerun; its
  exact source closure is unchanged and the affected checks above ran locally.
- No added tracked file or maintained page: docs remains 11 pages. No new
  dependency, registry, background retention, custom collector or cleanup command.
  No existing user run was deleted. Zero real user-configuration writes, remote
  CI, PR, publication, commit or push. Release dispatch/recovery network steps
  were checked against workflow/tools and offline fixtures, not executed.
- Exact proof directory: /var/folders/4t/l1rh16096gnd19k20pxhc5lr0000gn/T/skillfit-workflow-contracts-xmw_emc4.

W3: workflow now owns the study/batch sequence, optional MCP recipe, ignored outer
workspace, observed/derived/memory data and explicit manual retention/cleanup.
Existing tutorial uses the same outer batches/exports arrangement; architecture,
Bench, index and Skill link the guide. Native records/CLI formats remain untouched;
custom metrics and automatic GC are explicitly unavailable. Link gate: 34 entries,
zero errors against e0baacb, 117 prior headings/paths accounted. No new page,
registry, runtime module, telemetry or cleanup implementation. W4 exercises the
source/installed examples before claiming final acceptance.

W2: corrected stale architecture counts/restoration and tutorial copy; report and
release registry kinds now match their jobs. The release page now walks exact
main/source proof, preview ID/attempt, reviewed-byte promotion, single upload,
six-stage acceptance, receipt retention and failed-attempt recovery. Compared all
steps/fields to existing workflow and tools; no remote dispatch. Report commands
point to workflow; metric edits preserve statistical/population semantics. Existing
62 focused docs/release/CLI-reference checks passed, zero fail/skip. Link gate:
34 entries, zero errors against e0baacb; old headings preserved.

W1: confirmed clean baseline and current release workflow; existing architecture
gate passes 159 modules with zero violations/exceptions, documentation gate passes
34 entries. Manual reading found stale architecture text, two registry kind
mismatches, repeated report procedures and missing release/data-lifecycle steps.
No source behavior change is needed. Plan reviewed before W2; no new document.

## Previous verified delivery

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
