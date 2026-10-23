# skillfit: case authoring and evaluation roadmap (October 2026)

## Goal and current position

Help a user evaluate a Skill, rules file or MCP setup on tasks from their own work:
create a case, verify its acceptance checks, preview a small budget, then inspect
outcomes and complete spending. Bundled benches teach the format. Repeatedly
optimizing one external debugging Skill is not the product roadmap.

Version **0.13.1** synchronizes the driver Skill and current installed examples;
its [release record](releases/0.13.1.md) owns publication and verification status.
It retains the protected installation transactions and explicit pinned archive
restoration introduced in [0.13.0](releases/0.13.0.md), alongside the earlier
case-authoring and usage-accounting fixes. [CHANGELOG](../CHANGELOG.md) describes
versioned behavior; old release evidence remains unchanged.

Current source work follows the [measurement remediation plan](plans/2026-10-21-measurement-contract-and-capability-remediation.md):
consult its checklist for implementation, local acceptance and remote CI status.
The [documentation and architecture plan](plans/2026-10-22-documentation-governance-and-architecture.md)
owns document migration and internal boundary work, including its dependencies
on the measurement plan. This roadmap owns product direction, not copies of
either plan's progress. The [capability table](eval-agent-preflight.md#current-source-capability-table)
describes implemented source behavior; the [documentation index](README.md)
routes readers to current contracts. Unpublished checkout changes do not amend
the immutable 0.13.1 release record.

The [0.13.1 release plan](plans/2026-10-21-npm-0.13.1-release.md), earlier
[documentation and architecture cleanup](plans/2026-10-20-docs-architecture-cleanup.md)
and [workflow foundations audit](plans/2026-10-17-workflow-foundations.md#completion-audit)
are historical work records. Their [lifecycle classification](documentation-governance.md#plans-and-lifecycle)
does not infer acceptance of unchecked remote work or authorize live evaluation.

## Available foundations

| User need | Existing path | Boundary |
| --- | --- | --- |
| Start or capture a case | `bench init`, `bench add --freeze`, `bench add --from-commit`; `bench init --kind command` (0.10.0) | Starters teach text-output or file-edit grading; real tasks need their own fixture and acceptance checks |
| Validate the case offline | `bench check`: original/NOP failure, oracle pass, facet checks and fixture hygiene | Case integrity is not model quality or proof of difficulty |
| Preview and run a bounded comparison | `eval --dry-run`, `--max-calls`, JSON request preview and plan hash | Real runs need separate spending consent; 0.10.0 `spendingBudget` stops between calls and can overshoot in flight |
| Compare revisions and inspect evidence | `--baseline-skill`, balanced order, `report eval`, JSON assessment and offline replay | Missing evidence stays missing; the component never upgrades a Skill |
| Share or contribute | [Report guide](sharing-results.md), [offline CI example](examples/bench-check.yml), [bench guide](bench-authoring.md), contribution/issue templates | CI stays offline and never calls a model |
| First run across operating systems | Native Node CLI, mirrored READMEs, macOS/Linux/Windows CI | Local agents and credentials are needed only for live evaluation |

The [study index](skill-evaluation-evidence.md) owns current debugging-study status,
cumulative spending and unknown usage. The [public evidence index](../evidence/README.md)
navigates all dated reports. These are examples of the CLI's evidence gates, not a
universal Skill benchmark.

## Delivery order

Independent implementation and verification work may run in parallel. Dates are
work records, not timers or unattended execution.
The table below retains the historical October delivery sequence. Its dated
test counts and PR observations are not current task status; current work belongs
to the linked active plans and publication to each release record.
The code-editing starter is merged in PR #24 and JSON checks in PR #25.
The October 16 delivery completes task selection, case management and portable
exports, with publication tracked separately from source and CI completion. PR #26 passed 600 offline tests and Linux/macOS/Windows CI.

| Priority / order | Work | Acceptance |
| --- | --- | --- |
| 0 — complete, PR #23 merged | Commit existing work, update both READMEs and mutable guides, preserve dated evidence, push and review CI | [PR #23](https://github.com/remote-controlled-man/skillfit/pull/23): 556 offline tests and Linux/macOS/Windows CI pass; evidence replay adds no live calls |
| 1 — complete in source, PR #24 merged | `bench init --kind command` alongside the existing text-output starter, with a broken fixture, reference repair and behavioral verifier | Dry run writes nothing; original fails, oracle passes, equivalent repair passes, modified protected tests fail; CLI/docs and three-OS CI pass in PR #24 |
| 2 — complete in source, PR #25 merged | `bench check --json`: stable gate codes, task IDs, locations, remediation and verifier evidence; [contract and schema](bench-check-json.md) | JSON-only stdout; exit 0/1/2 distinguish completed checks from errors; calibration rejected before calls; 585 offline tests and Linux/macOS/Windows CI pass in PR #25 |
| 3 — complete, PR #26 merged | Explicit task selection for preview and eval, preserving the selected IDs and costs in the frozen plan and report | Unknown/duplicate selections fail before calls; preview counts only selected cases; small samples cannot authorize adoption |
| 4 — complete, PR #26 merged | `bench list/show/edit/remove` with machine output | Preview by default; apply with backup/verification; preserve files and provenance; reject last-task removal |
| 5 — complete, PR #26 merged | `report eval --export` portable directory | Exact original receipts and matching inputs; move/delete-original replay; missing/changed inputs reject; stopped costs stay incomplete |
| 6 — complete, 0.10.0 verified | Publish 0.10.0 through existing manual OIDC workflow | 600 offline tests and three-OS CI pass; preview archive matches the one upload; 2,609 installed files and eleven feature checks pass; registry signature/attestation verified |

Items 2–5 address basic usability gaps, not missing statistical methods.
Inspect existing APIs before implementation and avoid duplicating request preview,
report export, failure freezing or existing budget controls.

## October 17 source foundations (after npm 0.10.1)

| User need | Source behavior | Boundary |
| --- | --- | --- |
| Avoid paying for a broken calibration case | Hard offline gates and Agent environment checks before live calibration; recheck input/environment changes | Warnings and unknown evidence remain separate; authentication is unknown offline |
| Stop an independent case check | Ctrl+C/SIGTERM terminate verifier/oracle descendants and clean disposable copies | No artificial completed check or native run is created before dispatch |
| Use the same controls across modes | Calibration and trigger JSON previews/confirmation, task selection, call/spending limits and executor deadline | Calibration uses `plan.planSha256`; eval uses `plan.sha256`; neither single-arm mode proves paired benefit |
| Account for enabled judges | Per-invocation judge receipts and Agent/judge/combined costs; shared budget stops; missing API credentials fail explicitly | Historical missing usage remains unknown; no exact bill is inferred |
| Take supported results to another machine | Shared native audit, saved-delivery replay and portable export for calibration, trigger and new judge evidence | No new model calls/detections; historical missing receipts or runtime support cannot be invented |

See [planning](eval-planning.md), [interruption](evaluation-interruption.md),
[cost accounting](eval-costs.md), [report types](evaluation-reports.md) and
[portable packages](replay-packages.md). These features are published and checked
in [0.11.0](releases/0.11.0.md), with 794 offline tests and Linux/macOS/Windows CI
passing. The statistical protocol, dated evidence and automatic-upgrade
prohibition are unchanged.

## Later decisions

The release context below explains the product's foundations. Current support
and verification limits belong to the capability table, and implementation
priorities/acceptance belong to the active plans linked above.

The 0.10.1 release includes interruption cleanup, offline case preflight, sealed
inputs, API cache counts and shared paired report inputs. Version 0.11.0 also
reads calibration and trigger summaries through the public report dispatcher,
with their correct states/metrics and separate descriptive JSON kinds. See
[report types](evaluation-reports.md#calibration-and-trigger-reports-source-after-npm-0101).
This reporting correction adds no live calls.

The same source line now shares ordinary/Agent paired plans, budget stop lines
and executor deadlines, with ordinary JSON preview/confirmation and explicit
no-Skill request baselines. [Shared planning](eval-planning.md) documents defaults,
frozen limits and unchanged adoption restrictions. Version 0.11.0 includes
these additions, with registry delivery tracked in its release record.

Version 0.11.0 also performs [offline Agent environment preflight](eval-agent-preflight.md)
in preview and before dispatch: CLI availability, matrix compatibility, existing
same-name global Skill conflicts and unknown offline authentication. Checks are
sealed and preserved by reporting/replay without a new machine probe. This
check makes no live calls; authentication remains unknown offline.

- Improve error messages based on actual failed case-authoring attempts.
- Verify Claude Code trigger capture when working authentication is available.
- Add Cursor, Gemini CLI or OpenCode only with verified official paths and
  compatibility tests. A hosted dashboard needs demonstrated demand.
- Review new evidence against the fixed [metrics protocol](metrics.md). Task-specific
  regressions and all spending stay visible; insufficient evidence cannot upgrade
  a Skill. Future live evaluations need a fresh, bounded authorization.

Keep zero runtime dependencies and offline tests. Configuration writers retain
dry runs, confirmation, backups and verification. New artifacts preserve existing
outputs; normal repository edits use Git review and checks. Never commit or
clean the private `workspace4skills/` lab.
