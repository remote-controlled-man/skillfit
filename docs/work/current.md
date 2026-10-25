# Current work

<a id="当前执行状态"></a>

## Status

- Baseline: main `3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850`, package 0.13.1.
- F1–F8, D1–D3, A1–A5, V1 and their previous deliveries are complete.
- Previous cleanup: complete locally; pruning, migration, installation, full
  restoration and frozen verification passed. Its existing diff is preserved.
- Current task: S2–S5 implemented and verified locally under the reviewed framework.
- Progress: S2–S5 and final commit review complete; all local verification passed; Git delivery blocked by origin/main protection rules after local commit.
  Existing cleanup/design changes are preserved. No npm release or live evaluation.

## Previous cleanup baseline

- [x] Keep 15 documentation pages total, including this one current plan.
  Result: docs 189 → 49 files; Markdown 77 → 15.
- [x] Keep three evidence entry files; retrieve original bytes on demand.
  Result: evidence 1,605 → 3 files; original catalog unchanged.
- [x] Migrate current links, package requirements and affected offline fixtures.
  Result: 39 maintained entries pass; 8 consumed fixtures (157,794 bytes)
  match original hashes. Retired historical research helpers remain in Git.
- [x] Verify local build, links, package and complete historical restoration.
  Passed: 1,081/1,081 offline tests, 24/24 final documentation tests,
  isolated npm installation, Skill/entry-point checks, 19 archives + 1,583
  support files restored with original hashes and zero network attempts.
  Passed: 18 frozen replays + 1 original export-hash check on Node 24.21.0 /
  macOS arm64; zero model/agent CLI calls. Final package: 1,036 files,
  1,010,479 compressed bytes; every installed file matches final source.
  Review: 1,800 paths accounted for (56 changed/new, 1,744 removed),
  zero skipped, 100% coverage, no remaining findings. Archived bytes were
  checked against fixed snapshots; 51 historical links resolve locally.
  Final documentation and whitespace checks passed.

## Framework follow-up — execution order

The [canonical framework](../maintainers/architecture.md#repository-framework-design-for-the-next-migration)
owns requirements FR1–FR8, module responsibilities, the target tree, artifact
lifecycle, alternatives, failure analysis and rollback. Keep all work in this
plan; update its current status and proof links in place.

| Order | Work | Status | Acceptance / validation |
| --- | --- | --- | --- |
| S1 | Trace growth and define framework | Complete: refined design only | Review current writers, old ADRs and fixed evidence; separate current behavior from recommendations; cover FR1–FR8, module contracts, format/effect ownership and extension/failure/rollback cases. |
| S2 | Close output/admission paths before moving files | Complete: standalone schema-3 proof bundle; explicit legacy recovery; stable release guide | Experiment/release defaults write no tracked docs/evidence; one proof bundle; legacy import explicit; current version/Skill and failed-attempt proofs retained. Offline writer/acceptance regressions, then npm test for code changes. |
| S3 | Migrate tools and docs into the defined hierarchy | Complete: 15 pages grouped, 62 paths moved, 21 obsolete/duplicate script paths retired | Same maintained page scope, one current plan, recipes owned by tooling; migrate imports, package inventory, workflow references and examples together. Documentation gate, installed-package checks and relevant local suite. |
| S4 | Deepen Resources/Agents, Bench/Usage, Evaluation and Configuration/CLI | Complete: owned contracts, neutral mechanisms and CLI composition; local regressions passed | Extract in dependency order; separate Targets, Execution, Measurement and Records; no Bench→Evaluation or shared host-policy imports. Public interfaces, owned types and colocated tests. Preserve JSON/errors, configuration rollback, signals and changed-plan rejection; architecture and offline suite pass. |
| S5 | Enforce prevention and validate final delivery | Complete; installed documentation links and npm executable repaired and guarded; remote delivery blocked | Forbidden writes/imports/layouts and extension-contract regressions fail correctly; installed launchers keep required compatibility paths. Actual package installation, Skill docs, 19-archive/1,583-support restoration and 18 frozen replays plus one export-hash check remain correct on their recorded runtime. |

S1 findings before implementation: historical evidence had 1,605 files / 202 Markdown, including
467 runtime and 320 source replay paths; repeated Git blobs do not represent
that much newly stored Git data. Current flat directories contain 109 harness,
61 command and 55 script files (including tests). release-records still writes
versioned docs/receipts and appends plan status; release-docs-smoke still requires
a new per-version page. Existing role/registry checks do not yet close those
admission paths. The previous cleanup was therefore storage reduction, not the
completed framework migration.

S1 refinement review: current call chains exposed five gaps: mixed experiment/
delivery axes, missing Resource/Target ownership, scattered vendor decoding,
replay paths bound to source layout, and evaluation cancellation/UI inside shared
process mechanisms. The canonical framework now specifies module dependency
and effect rules, five Evaluation responsibilities, explicit codecs/identity
compatibility, and six extension scenarios. Calibration/self-test orchestration
stays in Evaluation to prevent Bench→Evaluation cycles; shared takes explicit
signals, while hosts retain stop/seal/exit policy. Existing mode strings,
statistical meaning, record versions and frozen bytes remain unchanged.

S4 order is Resources/Agents → Bench/Usage → Evaluation internals → Configuration/
CLI composition. New designs/formats may need explicit coordinated contracts;
the plan does not promise that all future changes fit one existing interface.
Validate extension scenarios through caller interfaces and actual installed/
relocated packages, including generated launcher strings and old delegates.
No new plugin system, store, global context or portable format is needed or
selected for this structural migration.

Validation: the 39-entry documentation gate passed; related documentation/
registry regressions passed 24/24. Reviewed FR1–FR8 against the six extension
scenarios, effect/dependency rules, versioned readers and rollback conditions.
This S1 design-only verification preceded implementation S2–S5. Previous cleanup's full code/install/replay
proofs describe their own inputs; no full code-suite rerun is needed for these
two documentation-only edits.

Implementation preflight review: preserve the six installed-recipe test paths
and replay cancellation entry as owned compatibility surfaces. Clean generated
outputs during builds so moved code cannot survive as stale dist modules.
Move the current plan/page rather than create a second one; update all package,
script, generated launcher, schema and Skill consumers. The implementation phase kept all verification local. Its original scope had
no commits, PRs, remote CI or publication; current Git delivery authorization
and results are recorded below.

S2 verification: standalone proof generation failed its new admission assertion
before implementation, then passed hash/tamper and legacy-recovery regressions.
Version/Skill checks retain exact command pins without per-version docs.
Targeted checks passed 41/41; full offline npm test passed 1,081/1,081.
No release, registry request, model call or repository-record import performed.

S3 verification: path migration initially exposed old test URLs, package roots
and five normalized vendored/resource Markdown files. Original payload hashes
were restored before continuing. Affected local regressions passed 143/143,
including real npm package/inventory, installed examples, complete offline
19-archive/1,583-support restoration, Node loaders and protected task provenance.
Documentation gate passed 39 entries; docs remains 15 Markdown pages. The
frozen 0.11.0 recipe and immutable catalog are byte-identical to baseline.
The same plan now lives at docs/work/current.md; no extra plan was created.

S4 verification: Resources/Agents and Bench/Usage now own their contracts and
readers; Evaluation separates application, temporary targets, execution, pure
measurement and saved records. Agent invocation accounting/limits serve drafting
and experiments without Bench importing Evaluation. CLI/composition owns prompts,
signal listeners, exit codes and rendering. Shared subprocesses take explicit
AbortSignal; the narrow asynchronous cancellation scope contains no business state.
A stopped result returned after sealing survives host cancellation unchanged.
Staged builds remove obsolete modules and preserve the last build on failure.
Initial full suite exposed 21 failures (mostly stale consumers plus interrupted
result loss); affected regressions then passed 81/81, zero skipped. TypeScript and
architecture checks passed: 152 active modules, no cycles/role violations or
legacy exceptions. Six installed-recipe tests and concrete old replay delegates
remain owned compatibility entries; no historical bytes/formats were changed.
S5 begins with a regression that fails when Bench can import orchestration.


S5 verification: bounded dependency/effect, layout and protected-output regressions
failed before implementation, then passed. Full offline npm test passed
1,087/1,087, zero failures/skips. Architecture passed 154 active modules with
no violations/exceptions; documentation passed 39 entries, preserving 15 docs
pages and three evidence entries. The eight consumed historical fixtures remain
157,794 exact original bytes. All 55 fixed-source documentation links resolve
against their recorded Git objects. The frozen 0.11.0 recipe and archive catalog
remain byte-identical.

Actual offline package installation passed source-byte comparison, current
Skill/version checks, 31 retained regressions, five portable replays, installation
backup/reinstall and moved-bundle checks. The generated upstream installer had a
stale import; a relocated, local-Skills-only installation regression now covers
that branch. Read-only legacy receipt validation remains available, while normal
repository admission rejects old receipt/document fan-out. Review covered 2,308
changed/deleted paths, including all filtered inputs: 2,308 reviewed, zero skipped,
100% accounting coverage; no remaining actionable finding.

Historical acceptance on Node 24.21.0 / macOS arm64 passed: 19 archives + 1,583
support files restored with original hashes, 18 frozen replays + one original
export-hash check. Final commit review revalidated all 1,602 payload hashes and
38 historical receipt-log digests. Restoration code, catalog, original inputs
and frozen replay recipes are byte-identical, so those replay results are reused;
they were not rerun for source-document link changes or the stable CLI shebang.

Final commit-review package: 1,083 files, 1,051,012 compressed bytes, 5,066,108
unpacked bytes; SHA-256
ef0cdf23b04d0a6210d9a4e9420d5f3990aa79275abffddc21dfb6d6d1253814.
Actual offline npm installation matches every source byte. The installed npm bin
executes directly; 34 shipped public documents resolve their local links/anchors;
current Skill/version checks, 31 retained regressions and five current portable
replays pass. The stable CLI differs only by its restored executable header;
the remaining package differences are source-document links. No model/agent CLI
calls or registry requests occurred. Full offline npm test after both fixes
passed 1,087/1,087 with zero failures/skips. Final documentation/architecture and
whitespace checks passed. Review accounting covers 2,308 paths, none skipped;
unchanged prior inputs reuse their integrated review, and all follow-up diffs
were reviewed against the same requirements and standards.

## Delivery

Current authorization: review all changes, fix omissions, commit and push directly
to origin/main. Do not create a PR, run remote CI, publish npm or call live models.
A commit-message `[skip ci]` directive preserves the existing workflows while
suppressing the push-triggered run.

| Order | Status | Acceptance / actual result |
| --- | --- | --- |
| Review | Complete | The original 2,308-path input was unchanged. Repaired 22 installed source-only links. Direct invocation also found that the new stable CLI delegate lost its executable shebang; the executable shebang is restored. The actual npm bin and packed-link regression checks both failed before the fixes and now pass. |
| Local verification | Complete | Full offline suite: 1,087 passed, zero skipped; actual npm bin, Skill docs, 34 public-page links, 31 installed regressions and five portable replays passed. Historical inputs and 38 receipt-log hashes revalidated; exact-input frozen replay proofs reused. Architecture: 154 modules, zero violations; source docs: 39 entries. |
| Commit and push | Blocked after local commit | Implementation committed as `b68ebd3ee7d7676c5829459915c1d07e0ceb563d` with `[skip ci]`. Direct push was rejected by GitHub GH013: main requires a pull request and all three required status checks. No PR or remote CI was started. Repository protection was not changed; pushing remains incomplete under the current authorization. |

Delivery verification: after the rejected push, origin/main still points to
`3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850`. The reviewed implementation
remains committed locally; this same plan records the delivery blocker in a
follow-up documentation commit, also with `[skip ci]`. No npm release occurred.

Local logs and receipts stay in temporary workspaces. Earlier verification
results above describe their recorded inputs; this final review adds installed
public-document link closure to S5 acceptance.

## Remaining research

- [ ] R1 Power/MDE, budget allocation and actual sampling capabilities.
- [ ] R2 Batch task collection, source protections and independent validation.
- [ ] R3 Deterministic trajectory/process measurement with explicit limits.
- [ ] R4 Third-party reproduction protocol and independent live evidence.

These remain proposals, not implemented product features. No paid/live agent
calls or actual user-configuration writes are authorized by this cleanup.

## Previous delivery

PR #55 merged as `c1c23bb087e6927e0137e6bcc7b08c10ef3163a7`;
[its main full CI](https://github.com/remote-controlled-man/skillfit/actions/runs/40103002073)
passed 8/8. Plan records merged through PR #56 as the baseline above;
[final integration CI](https://github.com/remote-controlled-man/skillfit/actions/runs/40104279638)
passed 8/8. Those results describe their original inputs, not this cleanup.

The full old plans, acceptance receipts, unresolved limitations and historical
experiment conditions remain at the fixed source snapshot below. An earlier
intermittent historical replay failure was not root-caused; retain that limit
when interpreting later successful replays. No archived experiment is rewritten.

Previous source documentation: [fixed snapshot](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/plans/2026-10-21-measurement-contract-and-capability-remediation.md).
