# Current work

<a id="当前执行状态"></a>

## Status

- Baseline: local main `4ec83672b69799bc62613c381f6b12ba8f3f3068`, package 0.13.1,
  plus the 18 locally verified C1–C5 changes; preserve that working input.
- Current task: N1–N5 complete; D1 complete; D1–D2 complete; D3 blocked. Reviewed code is committed locally; nothing was pushed.
- Delivery: the user now authorizes final review, commit and push. No new PR,
  remote CI, publication, live model calls or actual user-configuration writes.
  Use `[skip ci]`; preserve branch protection and report any rejected push.
  Reviewed source commit: ad7ce4c07d39526044cb9254ecfb1ea623697247.
  Main push was rejected. Alternate remote branch is proposed only and needs
  explicit user authorization after the automatic approval rejection.

## Execution order and acceptance

| Order | Work / dependency | Status | Acceptance / actual verification |
| --- | --- | --- | --- |
| N1 | Topic ownership, version baseline and plan review | Complete | One authority per topic; release-process points to releases. Keep one plan; preserve prior verification summary and pinned history. Review all reader/export/launcher and doc/schema/Skill consumers before edits; no unresolved contract choice. |
| N2 | Rewrite existing docs around reader tasks; after N1 | Complete | 12 docs pages: index 1, guides 4, reference 3, maintenance 3, plan 1. Merge controls into Bench guide, rules/MCP into workflow, claims into existing Bench format. Keep schema/example inputs and statistics meaning. Migrate every current link, registry/package/test/Skill consumer; removed docs stay at fixed Git source. Run baseline anchor/link gate and execute the source onboarding's complete offline loop. |
| N3 | Records format/version ownership; after N2 | Complete | One Records-owned type/version and replay-capability contract used by readers, exporters, portable validation and generated launcher. Keep paired/single-arm audits distinct and legacy inference explicit. Unsupported explicit versions/types refuse; legacy absence keeps original meaning. First add failing caller/compatibility regressions, then build, relevant replay/audit/export suites and architecture gate. No format bump or historical byte rewrite. |
| N4 | Derive deterministic CLI reference facts; after N3 | Complete | Existing help text/option declarations have an owned source; derive the repetitive option summary in an existing reference page and check drift locally. Preserve text help bytes, parse behavior, entry-specific defaults and confirmations. No generic parser/schema platform or new maintained page. Verify real help, documentation derivation and installed examples. |
| N5 | Integrated review and local acceptance; after N4 | Complete | Review final changes plus retained C1–C5 inputs. Run full npm test, architecture/docs gates, actual offline npm install/bin/Skill/docs, source tutorial and five portable replays. Freshly restore/hash 19 archives + 1,583 support files. Reuse frozen replay proofs only after exact closure/log-digest validation; otherwise rerun affected frozen recipes. Record final evidence and limits here. |

## Final review and delivery

| Order | Work / dependency | Status | Verification |
| --- | --- | --- | --- |
| D1 | Reconcile all 52 final paths, review contracts/consumers and historical proofs | Complete | 52/52 accounted; no remaining finding. Fresh npm test: 1,099 pass, zero fail/skip; 159 architecture modules, zero violations; 36 docs entries, zero errors. Fresh installed feature checks: 31 regressions + five portable replays. Fresh offline restore: 19 archives + 1,583 support hashes; reuse 18 frozen replays + one export-hash result after closure/38-log verification. |
| D2 | Update this plan and commit reviewed inputs; after D1 | Complete | Local reviewed commit uses `[skip ci]`. EOF blank line caught by staged check was removed before push; final npm test again passed 1,099/1,099. Built/shipped bytes remain identical to the accepted installation. Final staged hashes/diff validated before committing. |
| D3 | Push and verify remote commit; after D2 | Blocked | Main push of ad7ce4c was rejected with GH013: PR required and 3/3 checks missing. Automatic approval also rejected the proposed codex/docs-framework-architecture push because the new remote target lacked explicit authorization. No branch was created or pushed. Main remains at 3a3ff415; no PR/remote CI/protection change. Only propose the alternate branch until explicitly authorized. |

D1 delivery evidence: /var/folders/4t/l1rh16096gnd19k20pxhc5lr0000gn/T/skillfit-final-delivery-07jg84r5/. Current runtime/source payload is
byte-identical to N5; full local tests and installed features/archive restoration
were freshly executed here. Prior identical review inputs were reused while
checking consumers against this delivery request; this was one integrated local
review, not an independent reviewer. Effective remote main rules still require
a PR and three OS checks; remote main was 3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850.
Do not weaken protection or start CI to satisfy a rejected push.

## Decisions and safety

Choose the single-package modular CLI and existing documentation/tool owners.
Renaming folders alone leaves mixed purposes and duplicated facts; adding a docs
site, package split or plugin registry creates work without serving this task.
Rewrite the retained pages and migrate their consumers together. Twelve pages is
this change's scope, not a permanent quality rule. New independent recurring
tasks may justify pages through the existing ownership/admission policy.

The source documentation targets the current build. docs/README owns the single
version entry and links the fixed published 0.13.1 documentation. A source-only
example must say so before commands; npm pins retain their released meanings.
Tutorials show one complete observable workflow, guides solve tasks, references
own fields/constraints and architecture explains current ownership/decisions.

Records owns format identification; Application coordinates copying and use cases.
Keep legacy missing fields distinct from unsupported explicit versions. One
compatibility table does not unify statistics or rewrite JSON. New launchers may
carry the selected type, while historical launchers and runtimes remain unchanged.
Unknown versions failing silently, invented complete costs, changed hashes or a
missing replay entry stop the slice at the first mismatch until fixed.

CLI reference generation is limited to deterministic facts already owned by the
CLI. Do not infer arbitrary semantic validation from TypeScript, erase different
entry defaults or introduce a universal context. Configuration planning stays
deferred until a real new caller needs it. No new product experiments are part
of this architecture task.

Risks: merged guides can become pasted encyclopedias (rewrite around a main
workflow and link exact contracts); type dispatch can erase legacy behavior
(test explicit/absent/conflicting formats through public readers and export);
derivation can become a second authority (one-way generation with a failing
drift check). Preserve unrelated work; roll back only owned local changes.

## Verification

N1: reviewed the 15-page inventory, source/published version evidence, all current
reader/export/descriptor/launcher dispatch sites, doc/package/Skill consumers and
existing anchor/archive checks. The 0.13.1 publication record binds original
source 4eaefde80f7e8a6b1e01939d3bd8a8b6418b75d6; the docs entry now links that
immutable baseline. release-process canonical now matches the release guide.
Documentation gate passed 39 entries. Plan scope, alternatives and failure gates
reviewed with no unresolved choice before N2. Update these notes per slice.

N2: 15 → 12 docs pages. Controls, rules/MCP and claims merged into their existing
canonical task/format owners; current links, package/release checks, Skill and
registry consumers migrated. Gate: 36 registered entries, no errors, old anchors
compared to 4ec83672. All 42 focused documentation checks passed. Built-source
tutorial preview/confirmation/report/export/reproduce passed in a fresh temporary
workspace with zero model calls; original synthetic verdict and unknown usage
retained. Artifacts: /private/tmp/skillfit-iteration-jfygeuec/.

N3: Records now owns supported saved versions/type inference and original-runtime
replay requirements. Reader/export/portable validation and generated launcher use
the same dependency-free contract; paired/single-arm audits remain separate.
A public regression first failed because a future artifact index was accepted,
then passed after refusal was implemented. 98 focused report/export/session
checks passed, including old absent descriptor types, partial legacy plans,
unknown native/portable types and future index versions. Architecture: 158
modules, zero violations/exceptions. No persisted format bump or archived rewrite.

N4: Help/options now share the CLI-owned definition module. Deterministic rows
in the existing component reference are generated one-way; missing declarations,
ambiguous markers or drift fail local tests. Real --help output matched the
pre-move bytes exactly. All 29 focused CLI/reference checks passed. Architecture:
159 modules, zero violations/exceptions; documentation gate: 36 entries, no
errors against the original anchor/path baseline.

N5: one integrated OCR-guided local review covered final code, tests, docs and
policy/package consumers, including filtered files. Fifteen byte-identical C1–C5
files retained their prior review; changed dependencies were inspected here.
Review fixed partial legacy calibration plans incorrectly acquiring paired mode,
malformed explicit summary modes being coerced, and stale contribution/link copy.
Both compatibility failures were reproduced before their fixes. No remaining
known finding in the authorized scope; this is not an independent second review.

Final verification (Node 24.21.0 / macOS arm64):

- Full offline suite: 1,099 passed; zero failed, cancelled or skipped.
- Architecture: 159 modules, zero violations/exceptions. Documentation: 36
  registered entries, no errors; compare both HEAD and all 39 starting public
  documents for historical anchors/paths. CLI reference drift and diff checks pass.
- Final source tutorial passed the complete control preview/confirm, human/JSON
  read, export/reproduce, fresh command-bench creation/check and real comparison
  preview. Zero model/real agent CLI calls; synthetic evidence remains ineligible.
- Actual offline npm pack/install: 1,085 files; 1,027,454 compressed / 4,997,100
  unpacked bytes; SHA-256
  fabc014df929e5995cfb3ef9a67ebda00ad3c2cb4307491c64c1942c86b209e6.
  All installed files matched final source, direct npm binary help matched earlier
  bytes, Skill/release-document checks and all 31 shipped public doc links passed.
  Installed feature acceptance passed 31 retained regressions, five portable
  replays, fake-process success/failure and disposable configuration/bundle checks.
- Fresh offline restore: all 19 archives + 1,583 support files matched catalog
  hashes, zero network attempts, collision and preview protections passed.
  The historical driver/catalog/restorer/recipe closure matched the previously
  verified inputs and all 38 historical log hashes matched. Reused 18 frozen
  replays + one export-hash result; those 19 historical procedures were **not
  rerun**. The earlier intermittent replay limitation remains below.
- Exact artifacts and review accounting remain outside the repository at
  /private/tmp/skillfit-iteration-jfygeuec/. At N5 acceptance no commit/push had
  occurred. Current delivery is tracked in D1–D3 above; no new maintained page,
  PR, remote CI, registry request, publication or actual user-config write.

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

## Remaining research

R1 Power/MDE and sampling; R2 independent task collection/validation; R3 bounded
trajectory measurement; R4 third-party reproduction/live evidence. These remain
proposals, outside this offline framework change.

<!-- Retained links to earlier sections; current status and evidence are above. -->
<a id="ownership-follow-up--execution-order"></a>
<a id="previous-cleanup-baseline"></a>
<a id="framework-follow-up--execution-order"></a>
<a id="delivery"></a>
<a id="previous-delivery"></a>
