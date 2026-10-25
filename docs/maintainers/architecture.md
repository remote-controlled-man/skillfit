# skillfit architecture

skillfit is a TypeScript/Node >=22 ESM CLI with zero runtime dependencies.
User-facing output is English. README.md is the English source of truth and
README.zh-CN.md mirrors its sections, commands, badges and demo blocks.

## Modules and dependency roles

| Role | Responsibility | Current owners |
| --- | --- | --- |
| Contracts | Owned data and validation contracts | resources/contracts, agents/contracts, bench/contracts, evaluation/measurement and records contracts |
| Calculation | Pure statistics, costs and interpretation | evaluation/measurement, agents/accounting, bench/scope and gates/summary |
| Mechanisms | Explicit-input file, process and path operations | shared, resources, bench/gates, evaluation/targets |
| Integration | Matrix, executor adapters and normalized observations | agents, usage |
| Evidence | Saved codecs, readers, sealing and audit | evaluation/records |
| Execution | Mode-specific scheduling | evaluation/execution, bench/draft |
| Application | Preparation, dispatch, read, export and self-test | evaluation/application, bench/authoring |
| Entry | Parsing, confirmation, terminal output and OS signal policy | cli, composition; owned compatibility delegates |
| Configuration | Profile/setup/bundle planning and application | configuration; uses Agent/Usage interfaces |
| Installation | Real configuration write/rollback transaction | configuration/transaction |

[The architecture policy](https://github.com/remote-controlled-man/skillfit/blob/main/tools/verify/architecture-policy.json) uniquely registers
all active modules. Runtime/type directions are separate; runtime cycles,
unknown/overlapping ownership, unresolved dependencies and stale exceptions fail.
Lower roles cannot load command adapters or experiment orchestration. Application
and execution do not load the user-configuration transaction.

The AST gate checks bounded effects: pure roles reject direct Node I/O and
implicit environment/clock/random reads; application rejects console/exit and
interactive-module use. Immutable aliases, destructuring, imported aliases and
lexical shadowing are covered. Reflection, mutable aliases, arbitrary callbacks
and general interprocedural effects remain outside this static check. Literal
and finite declared dynamic targets participate in dependency/cycle checks.

There are no legacy role exceptions. Pure policy parsing no longer loads the
filesystem request parser or matrix discovery. Six shipped recipe test entries
and the old replay/acceptance entrypoints are small owned compatibility surfaces;
they delegate to canonical implementations. They are not extension points.

## Evaluation lifecycle

1. Resolve existing inputs and executor descriptions without creating a run or
   dispatching a verifier, oracle, judge or model.
2. Build the preview from resolved data, an explicit implementation digest and
   the full request/policy/self-test context. Changed code requires a new plan.
3. Preserve entry-specific confirmation: JSON/request execution binds the
   reviewed digest; ordinary text CLI retains its existing contract.
4. Recheck input/environment/implementation fingerprints and collisions, then
   run offline case gates before any paid call or fresh session.
5. Record each attempted agent/judge/drafter invocation, available costs, model
   intent and observed served identity. Unknown readings stay unknown.
6. Finish with completed/stopped/incomplete accounting. Report, statistical
   verdict and adoption decision remain separate; synthetic runs never adopt.

`resolveEvalInputs` / `buildEvalPlan` / `executeEvalPlan` and `readEvaluation`
are internal interfaces. Calibration retains its independent baseline plan and
`planSha256`; trigger retains its single-arm interpretation. Shared mechanisms
preserve argv/cwd/env, deadlines, output bounds, errors and descendant cleanup.
Old command exports and error classes re-export the same implementation.

## Bench authoring

`prepareBenchChange` describes init/add/edit/remove and captures source/target
fingerprints; it performs no UI, verifier or model call. `draftBenchChange` is a
separate authorized bounded step with retained costs/identity/failure records.
`applyBenchChange` rechecks captured inputs and applies the existing validation,
backup and rollback. Public preview bytes cannot mutate private write bytes.
Post-draft rejection still finalizes its summary; partial starter writes remove
their owned files. Edit/remove change registration and preserve task files.

## Write and evidence contracts

User-configuration writers plan, support dry runs, confirm or accept --yes,
back up existing targets, verify and roll back write/validation failure.
Fresh run/bundle/bench outputs instead preserve exclusive collision protection;
fixture workspaces are disposable. Repository edits use Git review and checks.
Never run `git clean -fdx`: workspace4skills/ is a private ignored lab.

Published reports, inputs and replay code stay immutable at their pinned Git
commits. The default tree keeps an index, catalog and restore tool. Restore uses
fixed source bytes, sizes and SHA-256, refuses collisions and has no automatic
execution or fallback to main. [Archive instructions](archive-delivery.md) own
recovery; [metrics](../reference/metrics.md) owns verdict/statistical semantics.

## Development and documentation

Run `npm ci`, `npm run build` and `npm test`. Tests use node:test and offline
executors/temporary roots. Do not run a real model or agent to verify a refactor.
Bench changes also run `node dist/cli.js bench check <bench-dir>`.

Keep commands thin and shared logic testable. ESM relative imports use .js.
Agent-specific capability/path changes belong in src/matrix/agents.json with an
official source and verifiedAt update. Statistical protocol changes update
metrics and code together. Runtime dependencies require prior discussion.

The documentation registry maps current topics to guides, source and tests.
Update one canonical topic and its affected guides; migrate internal links when
merging pages. A fixed source-snapshot link preserves older explanations and
anchors. Keep one short current plan; archive completed process narratives in
Git rather than copying every CI receipt into maintained prose. Necessary JSON
schemas and runnable fixtures stay independently testable.

## Release preparation

Use `node tools/release/npm-release.mjs check <pack.json>` and the release workflow's reviewed
source/preview/publication gates. A release requires main push full CI, exact
run/attempt/SHA receipts, a reviewed package/preview, and explicit publication
intent. Plan-only checks do not authorize publication. Verify the actual registry
installation, Skill documentation, workflows, restoration and historical replay
before completing a release record. Do not republish the same version.

Current source is unpublished even while package.json still says 0.13.1.
[Published-version details](releases.md) link their original receipts.
Publication and real model calls always require separate authorization.

## Repository framework: design for the next migration

The framework is implemented locally. This section records its contracts and
reasons; execution status and verification results live only in the current plan.
Public formats, publishers and repository settings remain unchanged.
Progress belongs to the existing plan. The goal is local change for ordinary
extensions, not a promise that every future product decision needs no redesign.

### Problem and requirements

Before pruning, evidence had 1,605 files / 202 Markdown, including 467 replay
runtime paths and 320 source copies. Identical Git blobs deduplicate, but their
working-tree/package paths still multiply. Main now keeps three evidence files
and 15 docs pages; generators can still recreate the old tree. Technical role
checks do not by themselves define business ownership, format compatibility or
artifact admission. Those choices cross modules and would otherwise be lost,
so their reason belongs here. This is a batch CLI, not a hosted throughput system;
no hosted process or monthly cost estimate is introduced without actual demand.

- FR1: One business owner and a small caller interface per module; no public
  export of all internals or global domain-types collection.
- FR2: One canonical page per topic and one current plan. Keep the 15-page scope
  during migration; new pages need a distinct recurring task/contract and owner.
- FR3: Generated attempts, reports, receipts and frozen runtimes stay outside
  default source/package trees. Running or verifying them never requires a commit.
- FR4: Preserve historical bytes, failure/unknown accounting and explicit offline
  restoration/replay. Never replace pinned observations or implementations.
- FR5: Keep one npm package, Node/TypeScript, zero runtime dependencies and current
  CLI/configuration/authorization contracts; no real model calls for migration.
- FR6: Existing checks enforce module imports, effects, file admission and writer
  destinations. A registered file alone is not justification for its existence.
- FR7: Own persisted formats, identities and compatibility explicitly, independently
  of directory layout, npm version and the newest reader.
- FR8: Test representative extensions for locality; document when a new protocol
  or experiment design legitimately requires coordinated contract changes.

### Domain terms and owners

| Term | Meaning and owner |
| --- | --- |
| Resource | Skill, rules or MCP source bytes, metadata and explicitly named fingerprints. Resources owns read-only validation/inventory; injectable-text and full-resource hashes retain distinct meanings. |
| Target | The Resource treatment/baseline selected for an experiment. Evaluation targets owns freezing, temporary delivery, collision/drift checks and post-delivery verification. Actual user installation belongs to Configuration. |
| Bench | Reusable tasks, fixtures, verifier, oracle, claims and control definitions. Bench owns authoring and local gates; it does not orchestrate evaluation Runs. |
| Run | One attempted execution with reviewed plan, inputs, invocation facts and completed/stopped/incomplete state. Execution owns scheduling; Records owns retained bytes, sealing and readers. |
| Usage | Local invocation observations and coverage, shared by usage reporting and bundle selection; observed activation does not establish efficacy. |
| Report | A projection of Run or Usage facts under a stated interpretation; rendering creates no new observation. Evaluation verdict and Usage summary stay distinct. |
| Evidence | Explicitly published scoped positive/negative results, identified Runs, exact payload/runtime hashes, replay requirements and limitations. Ordinary Runs are not automatically publications. |
| Release | Software/package delivery and its source/installation proofs; it is separate from Skill efficacy Evidence. |

### Target source and document structure

```text
src/
  composition.ts        wire public operations and concrete adapters; no policy
  cli/                  parsing, confirmation, presentation and exit behavior
  resources/            read-only Skill/rules/MCP descriptions and inventories
  agents/               matrix, executors, capability and wire/session readers
  usage/                local observation aggregation and coverage
  bench/                tasks, authoring, claims, gates and control definitions
  configuration/        profile/upstream, install/setup, bundle and rollback
  evaluation/
    application/        prepare, execute, read, replay and export use cases
    targets/            freeze/deliver/verify temporary experiment treatments
    execution/          paired/calibration/trigger designs and invocation stops
    measurement/        pure statistics, costs and acceptance interpretation
    records/            Run sealing, codecs, audit, portable/legacy replay
  shared/               proven process/path/hash mechanisms with explicit inputs

tools/{verify,release,history}/
docs/
  README.md             navigation
  guides/               first run, authoring, self-test, workflow, configuration
  reference/            component contract, claims, metrics, reports
  maintainers/          architecture, archives, one stable release procedure
  work/                 the one current plan, replaced in place
  {schemas,examples,assets}/
benches/                current reusable tasks and provenance
profiles/               current installation inputs
skills/                 shipped CLI driver
runs/                   ignored owned attempts/exports/release workspaces
                         (not read or cleaned wholesale by maintenance)
evidence/               compact index and existing legacy catalog/restorer
```

Do not reproduce every subfolder in every module. Evaluation needs internal
seams because planning, execution, measurement and persisted history actually
change independently. A module's public contracts own its types; shared cannot
collect Bench/Executor/Target/Run types merely because many callers use them.
Existing wire types adapt at entry/codec seams rather than being renamed on disk.
Agent invocation populations and stop lines have both drafting and experiment
clients; Evaluation retains paired populations, verdicts and acceptance policy.
The narrow AbortSignal scope propagates cancellation through asynchronous work;
shared subprocesses receive the signal explicitly. It is not a global state bag.
Builds compile into an owned temporary directory before replacing dist, so old
module paths cannot survive a successful migration or hide missing imports.

| Module | Public responsibility and allowed business dependencies |
| --- | --- |
| Resources | Describe/validate/fingerprint bytes; shared mechanisms only. No install, paid call or experiment verdict. |
| Agents | Own matrix metadata, capability declarations, invocation accounting/limits and vendor decoding; shared mechanisms and Resource contract types. No experiment policy or user-config transaction. |
| Usage | Aggregate normalized Agent observations and Resource inventories; no Configuration/Evaluation dependency. |
| Bench | Load/author/validate tasks and local gates; Resources/shared plus an injected Agent executor for explicitly authorized drafting. No Evaluation dependency. |
| Evaluation | Use Bench, Resources and Agent interfaces; own Target/Run/measurement workflows. No Configuration writer dependency. |
| Configuration | Use Resources, Agents and Usage for selection/planning; alone owns real user-config application/rollback. No Evaluation dependency. |
| Shared | Explicit-signal process, path and hash mechanisms; no business-module imports, discovery, UI, exit or policy text. |

Composition connects public operations and adapters using narrow dependencies;
modules do not import composition, CLI, tools or another module's internals.
Registrations live with their owner and are wired once, not rediscovered through
runtime scanning. Keep the existing runtime/type/effect checks as well as these
business import rules. Preserve the archived
[dependency](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/decisions/0002-layering-and-shared-execution.md)
and [confirmation](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/decisions/0003-plan-confirm-execute-separation.md)
decisions. Revise main-tree retention choices in the
[documentation decision](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/decisions/0001-document-authority-and-history.md)
without changing its fixed historical bytes.

Calibration and known-control self-test orchestration belongs to Evaluation,
even when the CLI spelling starts with bench. Bench supplies gates/control
definitions; it must not call Evaluation back. Within Evaluation, Application
coordinates Execution/Targets/Records/Measurement; Measurement performs pure
calculations without importing the others. Records owns versioned persistence
and saved-data audit, not a second live scheduler. Configuration installation
and temporary Target delivery may share mechanisms, never their write policy.

### Extension contracts and effects

Keep separate internal axes: experiment design (paired/calibration/trigger),
Resource kind, delivery (injected/installed and snapshot/workspace), requested
claim (quality/efficiency/activation or none), and synthetic controls. A single
mode enum must not become the switch for every axis. Compatibility validation
admits only supported combinations before dispatch. Public legacy mode strings,
JSON order, default settings and per-entry confirmation rules remain unchanged.

An Agent adapter owns execution plus public wire/session/identity decoding and
capability evidence. Evaluation and Usage consume normalized observations, not
vendor wireShape. Declared capability, locally checked availability and actual
call coverage remain separate; unknown is never supported or zero. Primary and
optional judge requirements both enter preflight; runtime missing usage still
stops under the existing strict budget. New observations retain source hashes,
final/partial/unknown scope and separate configured/reported model identity.

| Operation | Permitted effects and result |
| --- | --- |
| Evaluation prepare | Read/resolve and return a fingerprinted plan; no verifier, oracle, agent/judge dispatch or run creation. |
| Evaluation execute | Bind existing confirmation, recheck inputs, run local gates, then bounded explicit calls in fresh owned workspaces; seal terminal/partial facts. |
| Records read / replay / export | Read validates saved bytes; explicit replay can run trusted local graders/pinned processes, never an Agent. Export previews first and writes only a fresh external destination when applied. |
| Bench load / gate / draft / apply | Loading does not grade. Gates run local tools; drafting is separately authorized/bounded; apply rechecks inputs and preserves existing backup/rollback. |
| Configuration prepare / apply | Preserve current explicit upstream-fetch behavior during selection/preview; no target write before confirmation. Apply backs up, verifies and rolls back actual configuration. |

Shared process code receives cancellation/deadlines explicitly. CLI owns OS
signals, messages and exit codes; the Run/authoring host owns stop, retained costs
and sealing policy. Do not move evaluationSignal, evaluation text or process.exit
into shared with the process helper. Avoid a global all-purpose context/container.
Fresh outputs, disposable workspaces and actual user-config transactions keep
different collision/recovery contracts. Preview, failure, abort and repeat-apply
behavior are part of each interface, not implementation details.

### Format, identity and replay compatibility

Records owns a reviewed kind/version-to-reader table. Existing native plan and
summary v1, paired manifest v4 and portable descriptor v1 retain their meanings;
legacy filename/field inference stays confined to legacy adapters. Unknown
versions fail clearly. Verify original bytes/hashes before decoding to a read
model; never normalize and then claim the original digest matched. Missing
legacy claims, identity and usage stay unrecorded, without today's Agent metadata.

Resource identity, plan digest, compiled-implementation digest, format version,
statistical/acceptance protocol and npm version answer different questions.
A version string cannot identify dirty/unpublished execution bytes. Include all
behavior-affecting runtime in the existing implementation fingerprint; changed
code invalidates execution confirmation. Do not keep an old digest by excluding
moved modules. Pure rendering can change presentation, not published observations
or the recorded measurement interpretation. An explicit alternative assessment
must identify its own policy/implementation instead of replacing the old result.

Current export qualification and generated launchers depend on internal-looking
paths such as harness/interruption.js. Treat those as compatibility entry points
for the structural migration: isolate the path knowledge in Records/legacy
adapters, keep small exact-contract delegates where required and test the built
package. Do not duplicate whole implementations. Removal requires an explicit
reader/format migration, not just a directory move. No new portable format is
selected here. A future format ships its reader before its writer and retains
old readers/pinned runtimes; it never retrofits the existing 19 archives. Package
asset roots come from one fixed distribution-layout helper, with existing
caller overrides retained, rather than each module guessing its directory depth; source and installed/relocated layouts are both tested.

### Artifact lifecycle and admission to main

| Artifact | Retention and main-tree admission |
| --- | --- |
| Active source/tests/Bench inputs/schemas | Owning module/public input tree; exact consumed fixtures only. |
| Run facts, stopped attempts and sealed inputs | Fresh explicit/ignored workspace; no automatic repository import. |
| Report, analysis and check logs | Derived attempt outputs; not separate maintained truth sources. |
| Published Evidence | Verified versioned manifest, packed payload and conclusion; one concise index entry/digest in main, no unpacked copies. |
| Release proofs | One attempt's proof graph delivered with the version; main keeps changelog/current links, not raw receipt fan-out. |
| Current work | One ordered plan with current status, acceptance and proof links; replace status rather than append every review/test/merge transcript. |

Sealed terminal Runs, including negative/stopped ones, can be explicitly promoted
with exact input/runtime identities and replay requirements. Dirty execution
needs its actual captured bytes. Corrections create linked identities. Reuse
identical runtimes inside a study delivery; standalone portable packages can
stay self-contained. No cross-study object server is introduced. Payload volume
scales with published work; metadata should not multiply with each rendered view.

Old history keeps its pinned Git source. For new durable payloads, recommend
versioned [Release assets](https://docs.github.com/en/rest/releases/assets)
with retained SHA-256 and verified
[immutable-release protection](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases).
The setting is unverified and unchanged. Stage/verify all assets before explicit
publication; failed durability verification blocks promotion, not local Runs.
Expiring [Actions artifacts](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/remove-workflow-artifacts)
cannot be the only copy of published proofs. A Release transport needs separate
implementation/verification; do not change the old restorer's redirect/offline
rules implicitly. No publication occurs in this migration plan.

### Growth controls and extension acceptance

Reuse current policy/check files to enforce doc purpose, one current plan,
no executable release recipes in docs, no generated trees in source/npm, and
allowed business/private-module imports. Shared host effects, Resource writes
and vendor wire access outside Agents are rejected by the bounded AST check. Writers need explicit external roots;
legacy repository import is recovery, not the normal successful-release path.
Remove release-records' normal docs/status fan-out and release-docs-smoke's
per-version page requirement while retaining version/Skill and publication checks.
A new canonical page needs a recurring task/contract and owner; registering a
receipt cannot make it documentation. Verify actual package contents/dependency
closure, not only directory names. No universal file/line-count gate is proposed.

| Extension scenario | Intended locality and acceptance |
| --- | --- |
| Agent using existing execution/delivery/observation contracts | Matrix/concrete adapter and contract fixtures; core planner/Usage never gain vendor branches. Unsupported capabilities refuse before calls. |
| Resource variant using an existing kind/delivery | Resources parsing plus Evaluation Targets/delivery tests; no change to measurement or real-config transaction. A genuinely new public kind requires explicit schema/capability work. |
| Report layout or new metric | Layout stays in presentation; a metric stays in Measurement if required saved facts exist. New data/meaning requires a declared protocol/reader change. |
| New experiment design | Execution design, Application wiring and declared measurement/read support; no forced paired/single-arm unification. New record semantics require versioned codecs. |
| Historical reader or archive transport | Records/legacy or tools/history adapter and fixtures; no rewrite of old bytes or new live execution path. |
| New caller for an existing use case | Call the same public operation with explicit dependencies; never parse CLI stdout or invoke its dry-run branch to plan. |

These are acceptance scenarios, not a plugin registration system.
Contract tests must cover normal, unsupported, missing-counter, failure/abort
and historical cases through real caller interfaces. Preserve existing CLI,
installed-package and frozen-replay coverage; do not replace them with tests of
registration lists. Exact signatures follow actual extraction, not a plugin
framework invented in advance. Depth means more behavior behind a smaller
interface; locality/leverage, not extra folders, are the reason for the seams.

### Alternatives, rollout and rollback

| Approach | Best case and trade-off |
| --- | --- |
| Pruned flat source with existing generators | Cheapest immediate work, but ownership/format and output admission gaps remain. |
| Modular CLI, explicit contracts and external artifact lifecycle | Existing toolchain and local extension seams; import/path/compatibility work is necessary. Recommended for FR1–FR8. |
| Multiple packages and a separate artifact platform | Useful for independent consumers/owners, at the cost of operations, authentication and coordinated versioning; no current need justifies it. |

Choose the modular CLI. Revisit package splits when independent consumers or
release owners actually need them, and storage when measured volume/durability
outgrows release assets. No design guarantees arbitrary future experiments or
remote/distributed execution without new contracts; ordinary extensions should
stay local. There is no hosted throughput target or speculative platform budget.

Follow the existing plan: stop generator admission first; move docs/tools with
all consumers; then extract neutral contracts/Resources/Agents, Bench/Usage,
Evaluation internals and Configuration/CLI composition in dependency order.
Inventory imports, package-root resolution, generated launcher paths, six retained recipe tests,
package allowlists, schemas, Skill links and workflow references before moves.
No remote CI, new PR per folder, paid evaluation or publication is required.

Per slice, zero altered historical hashes, missing runtime payload files or
unexplained relevant local failures are acceptance conditions; a first mismatch
stops the slice immediately. Preserve the last verified source and owned diff,
not reset unrelated work. Path rollback is local until publishing a new format;
after immutable publication, preserve it and correct forward under a new identity.
Run appropriate existing checks and npm test for code changes, then actual
installation/restoration/frozen replay at final integration. Changed code requires
fresh plan confirmation; historical packages continue using their own runtime.

Pre-mortem: failure means writers repopulate docs (early sign: acceptance writes
tracked roots; guard destinations first), shared inherits host policy (early
sign: signal/exit/business imports in shared; narrow explicit dependencies), or
folder moves break pinned replay (early sign: exported launcher cannot resolve
its recorded entry; test real installed/relocated packages and preserve adapters).
Expiring-only proof storage blocks promotion. File moves alone solve none of these.

Non-goals: new statistical thresholds, paid research, microservices, dynamic
plugin loading, a universal runner/store/context or destructive user-workspace
cleanup. Open: verify release immutability before the first new publication;
any future public-kind/format/protocol change requires its concrete compatibility
design. These do not block the present structural migration.

Previous source documentation: [fixed snapshot](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/architecture.md).
