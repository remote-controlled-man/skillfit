# Documentation governance

This is the current source policy for maintaining skillfit documentation. The
[document registry](../scripts/documentation-policy.json) records ownership,
applicability and topic authority; this page defines what those records mean.
The [governance plan](plans/2026-10-22-documentation-governance-and-architecture.md)
owns implementation progress. The
[measurement plan](plans/2026-10-21-measurement-contract-and-capability-remediation.md)
owns F1–F8 and R1–R4. Registration does not complete either plan's pending work.

D1 delivered the registry, rules and examples. D3's [registry parser](../scripts/documentation-registry.mjs)
and [documentation gate](../scripts/check-docs.mjs) consume them for independent
checks, offline tests and CI. The development registry is used in a source
checkout and is not a dependency of the shipped CLI. Source-test references
identify checks; registering one does not mean it ran or proved the prose.

## Document responsibilities

| Kind | Purpose | Keep elsewhere |
| --- | --- | --- |
| `tutorial` | One guided learning path, prerequisites and expected results | Complete field definitions and project progress |
| `how-to` | Steps and recovery for a particular goal | Another reference's complete rules and enums |
| `reference` | Fields, defaults, rejection conditions and supported contracts | Implementation diaries and proposed capabilities |
| `explanation` | Rationale, architecture, limitations and tradeoffs | Repeated command walkthroughs |
| `plan` | Scope, dependencies, authority, one checklist and acceptance evidence | A second permanent description of implemented behavior |
| `decision` | One significant decision, its context, status and consequences | Routine implementation choices and full execution logs |
| `record` | Dated observations or versioned delivery facts | Today's capabilities or renewed execution permission |
| `index` | Routes to authoritative documents | Copies of their status numbers or full contracts |

Existing pages can contain more than one kind of content; `kind` identifies
their primary job. Summaries and safety-critical reminders can repeat with a
link, while complete contracts and status ledgers keep one owner. Migrations
preserve paths and fragments; the plan records the actual compatibility map
and checks. Completion and remaining external acceptance belong to the plans,
not a second status ledger here.

The English README remains the product entry point; its Chinese counterpart
mirrors its sections and preserves command/demo blocks and badges. The
[documentation index](README.md) remains the user navigation entry. New
maintenance guidance belongs here; project instructions can link here rather
than carry a second copy of these rules. Existing AGENTS/CONTRIBUTING rules and
the user's task authorization continue to govern work.

Use [planning](eval-planning.md) for settings/confirmation/budget input,
[metrics](metrics.md) for measurement/adoption/stop meaning,
[cost accounting](eval-costs.md) for populations/coverage, and the
[component](eval-component.md) for request/result/policy fields. The
[capability table](eval-agent-preflight.md#current-source-capability-table),
[self-test guide](bench-self-test.md), [report guide](evaluation-reports.md) and
[portable package contract](replay-packages.md) own their respective implemented
surfaces. These are topic entry links, not another copy of their rules.

To review an affected topic, find its ID in the registry, follow `canonical`,
inspect `sources`/`schemas`, review `dependents`, and select the named checks
from the catalog below. Navigation pages link task/release/study owners rather
than copying current counters. Current conclusion limits are documented in
[metrics](metrics.md#non-goals-and-known-limitations): bench schema 1 has no
claims declaration. Current-source schema 2 and frozen measurementScope are now
defined in [bench claims](bench-claims.md). That page owns declarations, objective
derivation/refusal and frozen-scope compatibility; guides link it rather than
copying its full field definitions. Registration and content synchronization do
not complete external CI or other unchecked plan work.

## Maintenance roles

Roles identify the responsibility to maintain and review a topic. They do not
assign a person, create an approval requirement or authorize an external action.

| Owner ID | Responsibility |
| --- | --- |
| `development` | Repository rules, documentation governance, architecture, navigation and task records |
| `evaluation` | Plans, measurement semantics, execution, costs, evidence interpretation and public report contracts |
| `bench-authoring` | Bench format, capture/drafting/management, verifier contracts and offline controls |
| `agent-integration` | Matrix capabilities, adapters, profiles, Skills and configuration entry points |
| `distribution` | Package contents, releases, archive delivery and publishing procedures |
| `evidence` | Maintained evidence indexes and correct interpretation/protection of dated observations |

One document has one accountable role. Its topic dependencies can span several
roles. The maintainer doing the change checks those dependencies rather than
assuming that another role or an automated check has updated the prose.

## Document registry

`scripts/documentation-policy.json` is JSON data, not an executable workflow.
Its only top-level keys are `schemaVersion`, `documents`, `topics` and
`exclusions`. Version 1 rejects unknown keys at every defined object level,
duplicate document paths and duplicate JSON object keys. Array order does not
grant authority. Topic IDs and check IDs are stable, case-sensitive identifiers.

| Field | Shape and meaning |
| --- | --- |
| `schemaVersion` | Integer `1` |
| `documents` | Array of document records, sorted by repository path for review |
| `topics` | Object keyed by unique topic ID; each value has the topic fields below |
| `exclusions` | Array of explicitly justified file or directory exclusions |

Each document has exactly `path`, `kind`, `lifecycle`, `audience`, `owner`,
`scope`, `topics` and `checks`, with optional `supersededBy`:

- `path` is an existing repository-relative Markdown file. Use `/`, exact
  filename casing, no absolute path, `.`/`..` segments, backslashes or glob.
  Resolve symlinks before checking public scope. Private labs and local run
  directories cannot be registered or followed through an alias.
- `kind` uses the enum in Document responsibilities; `owner` uses Maintenance
  roles. Neither accepts arbitrary free text.
- `lifecycle` is `maintained`, `historical` or `frozen`. Maintained documents
  describe current work or behavior. Historical documents preserve context and
  can retain incomplete proposals. Frozen records preserve original evidence
  or published delivery facts; corrections require a new linked record.
- `audience` is a nonempty, duplicate-free array of `user`, `maintainer` or
  `contributor`.
- `scope` is a nonempty array of distinct `{ "kind", "ref" }` objects.
  `kind` is `source`, `released`, `protocol` or `historical`; `ref` is a nonempty
  reference such as `working-tree`, `0.13.1`, `metrics-v2@2026-09-23` or a dated
  record ID. Source/released scopes identify contexts addressed by a page;
  they do not claim that every source feature exists in that release.
- `topics` and `checks` are duplicate-free ID arrays. Non-authoritative indexes
  and historical records may have no topics. An authoritative document must
  include its topic and that topic's checks. An ID is a lookup, not shell code.
- `supersededBy`, when present, names an existing registered Markdown path.
  Replacement chains must be acyclic and preserve the original document.
  Do not invent replacement relationships just because a file is older.

The minimal [valid example](examples/documentation-policy.valid.json) contains
one document and one topic. It is a valid shape/reference example, **not** a
complete registry of this repository. The [invalid example](examples/documentation-policy.invalid.json)
differs only in its unknown `owner`, `unassigned`; it is rejected as an
unknown role. Both files are valid JSON. The [parser tests](../scripts/documentation-registry.test.mjs)
exercise the same production parser with coverage disabled for these shape/reference
examples, then separately check the real registry with discovery enabled.

## Topic authority

Every topic has exactly `canonical`, `sources`, `schemas`, `dependents` and
`checks`:

- `canonical` names one registered Markdown path with an optional existing
  heading fragment. That document is the normative explanation of the topic.
- `sources` is a nonempty, duplicate-free array of existing public repository
  file paths: implementation, machine declarations or retained records that
  substantiate the explanation. Do not substitute an empty directory or only
  another page title for implementation evidence.
- `schemas` lists applicable existing machine schemas; it may be empty where
  no schema exists. This registry does not invent one for such a topic.
- `dependents` lists other registered Markdown documents whose summaries or
  procedures need review when the topic changes. It is not a second authority.
  The reverse relation is maintained explicitly; the canonical page is omitted.
- `checks` is a nonempty, duplicate-free array from the check catalog. Sources,
  schemas and check registration identify what must be examined, not a claim
  that the check was executed or that all prose has been proved correct.

The registry is the authority for the map; each topic's canonical page owns its
contract. Schemas own machine structure, source/tests substantiate behavior,
and prose explains semantics. Conflicts require correction; marking one page
canonical is not permission to ignore contradictory evidence.

A page can own several distinct topics, so different topics may share a
canonical path. Each topic still has exactly one authority. Historical pages
do not become current authorities because their source files still exist: the
September [portable source audit](codex-upstream-audit.md) records that dated
selection, while [selectable setup](selectable-codex.md) and its pinned manifest
describe the maintained source/installation contract. Historical pages are not
put on the list of dependents that must be rewritten when current behavior changes.

The initial map covers onboarding; bench format/authoring/management/drafting,
verifiers, offline diagnostics and controls; planning, request/result,
capabilities, preflight, delivery, revisions and configuration; statistics,
costs, timing, interruption, snapshots, reports and replay; evidence/study
indexes; profiles; distribution/releases; and development/governance. Read the
registry to find their actual canonical paths and evidence. Do not duplicate
the entire map in this page.

## Discovery and exclusions

Inventory public Markdown files directly at the repository root (currently
`AGENTS.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `README.md`, `README.zh-CN.md` and
`SECURITY.md`), and below
`docs/`, `benches/`, `profiles/`, `skills/`, `scripts/` and `evidence/`.
Discovery is case-insensitive for `.md` but preserves exact path casing.
The checker inspects public trees directly, including untracked new guides,
rather than relying only on Git's tracked file list. Ignore dependency/build
trees and never traverse the private lab, local runs or aliases into them.

Every discovered Markdown file must be registered or match one explicit
exclusion. A registered path cannot also be excluded. Each exclusion has
exactly `path`, `reason`, `owner` and `verification`. A path ending in `/` is
a literal directory prefix; otherwise it is one exact file. No wildcard or
repository-wide exclusion is allowed. The directory/file must exist and stay
inside public scope; unused or overlapping exclusions require review.
`verification` is an existing check ID or `manual: ` followed by a concrete
review responsibility. A manual responsibility never produces machine proof.

Exclude case prompts, fixtures, ground truth and the dedicated synthetic target
using each bench's explicit data directories. These are task/agent inputs, not
maintenance guides: changing their text can change the measured problem.
Keep each bench's top-level README registered. New benches/guides need their
own entries; excluding `benches/` or `benches/contrib/` would hide omissions.

Exclude `evidence/artifacts/` and `evidence/inputs/` as fixed observation/input
collections with their existing integrity checks. Register root dated evidence
as frozen records and `evidence/README.md` as a maintained index. Do not edit
their bytes to add frontmatter. The release directory mixes a maintained
publishing guide with versioned records: register its Markdown individually,
with released pages frozen, rather than exclude the whole directory. Its
non-Markdown receipts and pinned recipes retain existing release/package
checks and are not document-discovery inputs.

## Plans and lifecycle

The two maintained task records are the
[measurement remediation plan](plans/2026-10-21-measurement-contract-and-capability-remediation.md)
and the [documentation/architecture plan](plans/2026-10-22-documentation-governance-and-architecture.md).
Their own checklists own progress. Registration neither grants implementation
authority nor changes pending CI, F5/F7/F8 or R work.

The other existing plans are historical records of their declared work or
proposals. This classification does **not** assert that every task finished,
that a proposed run happened or that remote delivery was accepted. Retain their
unchecked/conditional statements and follow the current plan or evidence index
when deciding what can happen next.

| Existing plan | Lifecycle and interpretation |
| --- | --- |
| [OSS task evaluation](plans/2026-10-01-oss-task-evaluation.md) | Historical implementation proposal; current workflow contract lives in maintained guides |
| [Experiment workflow](plans/2026-10-09-experiment-workflow.md) | Historical implementation/authority record, not a current permission grant |
| [Grader calibration amendment](plans/2026-10-09-grader-calibration-audit.md) | Historical grader correction and original-run limitations |
| [Waza/resource evaluation](plans/2026-10-09-waza-resource-evaluation.md) | Historical implementation and review record |
| [Skill evolution](plans/2026-10-13-skill-evolution.md) | Historical study/delivery design; no new live budget |
| [Skill experiment handoff](plans/2026-10-13-skill-experiment-cleanup.md) | Historical handoff; current study status belongs to its maintained index |
| [Evidence/release sequence](plans/2026-10-14-evidence-and-release-sequence.md) | Historical sequence including stopped cohorts and zero remaining live budget |
| [Followup](plans/2026-10-14-skill-followup.md) | Historical closed cohort declaration; no automatic continuation |
| [Followup restart](plans/2026-10-14-skill-followup-restart.md) | Historical separate recovery declaration, not reopening the previous cohort |
| [Independent comparison proposal](plans/2026-10-15-independent-comparison-proposal.md) | Historical proposal; its original execution/authorization conditions remain visible |
| [Native diff mechanism](plans/2026-10-15-native-diff-mechanism.md) | Historical prospective mechanism design and preparation boundary |
| [Receiver mechanism proposal](plans/2026-10-15-receiver-mechanism-proposal.md) | Historical prospective design, not evidence that its whole procedure ran |
| [Case workflow/release](plans/2026-10-16-case-workflow-and-release.md) | Historical feature and delivery record |
| [Workflow foundations](plans/2026-10-17-workflow-foundations.md) | Historical completion audit; current contracts remain in guides |
| [Previous docs/architecture cleanup](plans/2026-10-20-docs-architecture-cleanup.md) | Historical completed scoped cleanup; not proof of the new target architecture |
| [Install/archive delivery](plans/2026-10-20-install-transactions-and-archive-delivery.md) | Historical implementation/delivery record; protections remain active |
| [Measurement remediation](plans/2026-10-21-measurement-contract-and-capability-remediation.md) | Maintained measurement task record; consult its actual pending items |
| [0.13.0 release](plans/2026-10-21-npm-0.13.0-release.md) | Historical release/followup record; immutable release evidence stays separate |
| [0.13.1 release](plans/2026-10-21-npm-0.13.1-release.md) | Historical publication/verification record |
| [Release automation](plans/2026-10-21-release-workflow-automation.md) | Historical local delivery/handoff; retain its remote conditions, do not infer acceptance |
| [Documentation/architecture](plans/2026-10-22-documentation-governance-and-architecture.md) | Maintained governance task record; D1 registration is not later-stage implementation |

Classification is a manual judgment against the recorded scope and current
handoff, not a filename/date rule. On completion or replacement of a maintained
plan, preserve its original results, link the current explanation and update
registration. Moving an unfinished plan to historical must explicitly retain
the outstanding work or show where it is tracked. It must never silently cancel
a user requirement. A1's [ADR index](decisions/README.md) records the current
proposed designs and their delivery boundaries. Registration never marks an ADR
accepted or an implementation stage complete.

## Change and review procedure

1. Identify the changed behavior or document purpose and its topic owner.
   Read the canonical contract and the source/schema evidence. Resolve a factual
   conflict before relying on a page's status or a passing link check.
2. Update the canonical explanation and review its dependents in the same
   change when behavior changes. Mark source-only behavior, proposed features,
   released versions and historical observations explicitly.
3. Register new public Markdown, adjust topic evidence/checks and classify task
   inputs narrowly. Preserve existing paths/anchors and bilingual entry rules;
   content movement belongs to the authorized migration stage.
4. Run checks relevant to the change. Reviewers assess prose, scope and version
   claims separately. Record the actual final inputs, checks, results, skips
   and limitations; a check ID in the registry is not an execution receipt.
5. Keep one current task checklist per plan and one current publication/study
   status source. Preserve dated evidence and old decisions. Do not inherit a
   prior task's authority to make model calls, write configuration or publish.

New architecture decisions should record context, decision, status,
consequences, replacement links and verification. Use them for consequential
tradeoffs; normal documentation edits do not need an extra approval ceremony.

## Keeping records out of the reading path

Reuse the current plan for accepted follow-up work; keep its status and one
checklist visible, with completed detailed records in a collapsed section.
Do not create another plan, design note or status page for routine continuation.
Historical plans/audits and immutable release receipts retain their paths and
original facts in Git; their lifecycle does not imply every proposal finished.
They are source-maintenance records, separate from the npm CLI's required inputs.

Merge a short operational page into its existing task guide when that removes a
second maintained explanation. Preserve old paths/fragments as a concise routing
entry, update the registry's canonical topic and review dependents. Distinct
reference contracts and bench data remain separate; fewer files alone is not an
acceptance result. Future release receipts are grouped by version, with one
release page linking the machine verification record. Existing frozen records
are not migrated to imitate the new layout.

## Check catalog

These IDs are the allowed registration vocabulary. The listed files are real
checks with a [static development mapping](../scripts/documentation-registry.mjs).
The documentation gate reports selected check locations without executing commands
from registration or claiming those tests ran.
Source `.test.ts` files run from their built `.test.js` counterparts via
`npm test`. Manual checks have no automatic pass result. Unknown IDs are rejected;
the existing test runners execute their fixed offline test sets.

| Check ID | Kind | Existing evidence/check location and limit |
| --- | --- | --- |
| `documentation-review` | Manual | This page and the registered topic: authority, applicability and prose review; deterministic registration checks do not prove prose |
| `historical-review` | Manual | Original dated plan/report and maintained index: classification/limits; does not prove execution or completion |
| `study-review` | Manual | [Study index](skill-evaluation-evidence.md) and linked reports: cohort separation, accounting and unknowns |
| `docs-links` | Automatic | [check-docs](../scripts/check-docs.mjs), [link tests](../scripts/check-docs.test.mjs), [registry tests](../scripts/documentation-registry.test.mjs): registration/discovery, maintained and explicitly changed record links/anchors, public scope |
| `readme-parity` | Automatic | [docs checker tests](../scripts/check-docs.test.mjs): section levels and command/demo blocks; prose translation still needs review |
| `release-documents` | Automatic | [release-docs tests](../scripts/check-release-docs.test.mjs): current pinned commands and historical minimum compatibility |
| `measurement-scope` | Automatic | [Loader/refusal/native scope tests](../src/harness/bench-claims.test.ts), [mode/replay tests](../src/commands/eval-measurement-scope.test.ts), [CLI/import tests](../src/commands/bench-claims-cli.test.ts), [synthetic adoption tests](../src/harness/eval-component.test.ts) |
| `bench-contracts` | Automatic | [bench loader tests](../src/harness/bench.test.ts), [authoring docs tests](../src/docs.test.ts): format and existing contract assertions |
| `bench-authoring` | Automatic | [bench](../src/commands/bench.test.ts), [source](../src/commands/bench-source.test.ts), [draft](../src/commands/bench-draft.test.ts), [manage](../src/commands/bench-manage.test.ts) tests: existing offline cases |
| `bench-preflight` | Automatic | [bench JSON](../src/commands/bench-check-json.test.ts), [case preflight](../src/commands/eval-preflight.test.ts) tests: gates, warnings and selection |
| `verifier-contract` | Automatic | [verifier](../src/harness/verifier.test.ts), [timeout](../src/harness/verifier-timeout.test.ts) tests: grading and infrastructure distinctions |
| `eval-planning` | Automatic | [CLI usage](../src/commands/eval-cli-usage.test.ts), [component](../src/harness/eval-component.test.ts), [calibration CLI](../src/commands/calibration-cli.test.ts) tests: reviewed plans and existing entry contracts |
| `executor-capabilities` | Automatic | [CLI executor](../src/harness/executors/cli.test.ts), [API executor](../src/harness/executors/api.test.ts), [agent preflight](../src/commands/eval-agent-preflight.test.ts) tests: offline adapter evidence, not live authentication |
| `trigger-observations` | Automatic | [detection](../src/harness/trigger-detection.test.ts), [trigger](../src/harness/trigger.test.ts) tests: identity and observability counterexamples |
| `model-identity` | Automatic | [identity](../src/harness/model-identity.test.ts), [eval identity](../src/commands/eval-model-identity.test.ts) tests: source binding and legacy unknowns |
| `bench-self-test` | Automatic | [self-test](../src/commands/bench-self-test.test.ts), [interruption](../src/commands/bench-self-test-interruption.test.ts) tests: synthetic controls and isolation |
| `metrics-contract` | Automatic | [stats](../src/harness/stats.test.ts), [report](../src/harness/report.test.ts), [efficiency](../src/harness/eval-efficiency.test.ts) tests: frozen formulas and policy samples |
| `eval-accounting` | Automatic | [costs](../src/harness/costs.test.ts), [budget](../src/harness/eval-budget.test.ts), [judge accounting](../src/harness/judge-accounting.test.ts), [session](../src/harness/experiment-session.test.ts) tests: costs/coverage and stop lines |
| `execution-timing` | Automatic | [timing](../src/harness/execution-timing.test.ts) tests: monotonic duration and recorded limitations |
| `interruption` | Automatic | [interrupt](../src/harness/interruption.test.ts), [eval interruption](../src/commands/eval-interruption.test.ts) tests: stopped evidence and process cleanup |
| `input-snapshots` | Automatic | [layout](../src/commands/eval-layout.test.ts), [preflight](../src/commands/eval-preflight.test.ts) tests: sealed inputs and change rejection |
| `eval-reports` | Automatic | [report](../src/commands/eval-report.test.ts), [dispatcher](../src/commands/evaluation-report.test.ts), [component](../src/harness/eval-component.test.ts) tests: report/assessment separation and old data |
| `eval-replay` | Automatic | [export](../src/commands/eval-export.test.ts), [export modes](../src/commands/eval-export-modes.test.ts), [replay cancellation](../src/commands/replay-cancellation.test.ts) tests: relocation and integrity |
| `archive-integrity` | Automatic | [archive tests](../scripts/check-archives.test.mjs): catalog-pinned originals/support bytes; not all historical prose |
| `archive-restoration` | Automatic | [restore tests](../scripts/fetch-archives.test.mjs): injected/offline restoration and collision boundaries |
| `package-contents` | Automatic | [package tests](../scripts/check-package.test.mjs), [policy](../scripts/package-policy.json): actual offline package and required contents |
| `install-transactions` | Automatic | [transaction](../src/install/transaction.test.ts), [install](../src/commands/install.test.ts), [setup](../src/commands/setup.test.ts), [bundle](../src/commands/bundle.test.ts) tests: isolated configuration writers |
| `profile-sources` | Automatic | [upstream](../src/commands/upstream.test.ts), [setup](../src/commands/setup.test.ts) tests and [source manifest](../profiles/codex-upstream-sources.json): pinned sources; new upstream facts need review |
| `release-workflow` | Automatic | [release workflow](../scripts/release-workflow.test.mjs), [source](../scripts/release-source.test.mjs), [acceptance](../scripts/release-acceptance.test.mjs) tests: injected/offline gates, not permission to publish |
| `architecture-dependencies` | Automatic | [architecture check](../scripts/check-architecture.mjs), [tests](../scripts/check-architecture.test.mjs): current runtime cycles/core direction only; A5 target rules pending |

## D1 verification boundary

D1 checks the actual inventory, field shapes, references, role/check vocabulary,
topic ownership, examples and public path scope using the delivered data and
existing link utilities. The governance plan records executed results. This
did not install a new checker, wire CI, move existing guides or change CLI
behavior. D3 reuses those contracts/examples and adds parser/discovery/CI
counterexamples; its current behavior is below. D1's historical results stay
in the plan and do not stand in for the new checks.

## Executable checks and CI

Run `node scripts/check-docs.mjs` from a source checkout. `--json` returns one
`skillfit.documentation-check` document. The shared `checkDocumentation(root, options)`
interface is used by the command, tests and CI. Registration, topic/source/schema
references, roles/check IDs, replacements, exclusions and untracked-guide coverage
are validated before prose is read. It then checks **all maintained documents**,
including nested guides and active plans, README section levels/command and demo
blocks/badges, and the existing current-release command pins.

Historical/frozen records keep their bytes and do not acquire current-version
requirements. Their registration and authority/replacement references are checked;
only an explicitly changed record joins the body/link check. Excluded input trees
are not traversed for Markdown or treated as guides; their named integrity checks
and manual responsibilities remain separate. Empty, overlapping, broad, missing
or unsafe exclusions fail. Aliases cannot escape public scope, enter skipped
dependency/private trees or create discovery cycles.

Use `node scripts/check-docs.mjs --base <exact-commit-SHA> --json` to include
tracked working-tree changes and untracked public paths. The Git adapter requests
old bodies only for changed public, non-excluded Markdown. `anchorMigrations`
lists old path/fragments as `retained` or `missing`; a heading or explicit alias
at the old path retains compatibility. Removing the path/fragment fails with a
repair hint. Without a baseline, `anchorBaseline: "not-provided"` does not assert
that old anchors were compared. An invalid or unavailable explicitly requested
baseline fails; it does not silently waive compatibility.

`impacts` identifies affected topics from source/schema, canonical/dependent page
and mapped-test changes, including owner, authority, dependent guides and fixed
check locations. Entries are `review-required`; an unchanged Markdown file does
not automatically fail, and a changed one does not automatically prove consistency.
`unmappedChanges` asks for review of mapping coverage. `manualReviews` retains
manual exclusions as `not-machine-verified`. Review prose, translations, external
sources and version applicability separately. Structural JSON validation and real
offline parser/adapter tests do not prove every narrative capability claim.

Deterministic check errors exit 1; invalid invocation/baseline setup exits 2.
The command reads files/Git only and never starts a verifier, Agent or model.
`npm test` builds and runs the fixed offline suite, including the same gate and
the delivered policy examples. No runtime dependency or executable registry text
is introduced.

`ci-scope.mjs test` runs the shared gate before full/records tests and saves
`documentation.json` in its existing result directory, including failures and
manual-review hints. Records retain explicit changed Markdown body checks and
release-receipt verification. Policy/check/source/new/unknown changes still use
full CI; known pure plans/release bookkeeping can use records. Known Git baselines
compare old fragments; an unknown baseline falls back to full checks with
`anchorBaseline: "unavailable"`, never a fabricated compatibility result.
The compatibility job's forced full scope and the minimum job's limited runtime
scope remain distinct. Local adapter/workflow tests do not complete remote CI
acceptance in the measurement plan.
