# skillfit: case authoring and evaluation roadmap (October 2026)

## Goal and current position

Help a user evaluate a Skill, rules file or MCP setup on tasks from their own work:
create a case, verify its acceptance checks, preview a small budget, then inspect
outcomes and complete spending. Bundled benches teach the format. Repeatedly
optimizing one external debugging Skill is not the product roadmap.

The previous published CLI is 0.9.1, with a [verified registry install](releases/0.9.1-verification.json).
The user authorized the case workflow and 0.10.0 publication on October 16;
[release preparation](releases/0.10.0.md) is in progress. No live model calls
are authorized by this delivery.

## Available foundations

| User need | Existing path | Boundary |
| --- | --- | --- |
| Start or capture a case | `bench init`, `bench add --freeze`, `bench add --from-commit`; `bench init --kind command` (0.10.0) | Starters teach text-output or file-edit grading; real tasks need their own fixture and acceptance checks |
| Validate the case offline | `bench check`: original/NOP failure, oracle pass, facet checks and fixture hygiene | Case integrity is not model quality or proof of difficulty |
| Preview and run a bounded comparison | `eval --dry-run`, `--max-calls`, JSON request preview and plan hash | Real runs need separate spending consent; 0.10.0 `spendingBudget` stops between calls and can overshoot in flight |
| Compare revisions and inspect evidence | `--baseline-skill`, balanced order, `report eval`, JSON assessment and offline replay | Missing evidence stays missing; the component never upgrades a Skill |
| Share or contribute | [Report guide](sharing-results.md), [offline CI example](examples/bench-check.yml), [bench guide](bench-authoring.md), contribution/issue templates | CI stays offline and never calls a model |
| First run across operating systems | Native Node CLI, mirrored READMEs, macOS/Linux/Windows CI | Local agents and credentials are needed only for live evaluation |

The [evidence index](skill-evaluation-evidence.md) retains 195 study calls,
including failed and interrupted runs. Seven historical final usages remain
unknown, and no tested revision has qualified for adoption. These are examples
of the CLI's evidence gates, not a universal Skill benchmark.

## Delivery order

Work is sequential. Dates are work records, not timers or unattended execution.
The code-editing starter is merged in PR #24 and JSON checks in PR #25.
The October 16 delivery completes task selection, case management and portable
exports, with publication tracked separately from source and CI completion.

| Priority / order | Work | Acceptance |
| --- | --- | --- |
| 0 — complete, PR #23 merged | Commit existing work, update both READMEs and mutable guides, preserve dated evidence, push and review CI | [PR #23](https://github.com/remote-controlled-man/skillfit/pull/23): 556 offline tests and Linux/macOS/Windows CI pass; evidence replay adds no live calls |
| 1 — complete in source, PR #24 merged | `bench init --kind command` alongside the existing text-output starter, with a broken fixture, reference repair and behavioral verifier | Dry run writes nothing; original fails, oracle passes, equivalent repair passes, modified protected tests fail; CLI/docs and three-OS CI pass in PR #24 |
| 2 — complete in source, PR #25 merged | `bench check --json`: stable gate codes, task IDs, locations, remediation and verifier evidence; [contract and schema](bench-check-json.md) | JSON-only stdout; exit 0/1/2 distinguish completed checks from errors; calibration rejected before calls; 585 offline tests and Linux/macOS/Windows CI pass in PR #25 |
| 3 — implemented, final validation pending | Explicit task selection for preview and eval, preserving the selected IDs and costs in the frozen plan and report | Unknown/duplicate selections fail before calls; preview counts only selected cases; small samples cannot authorize adoption |

| 4 — implemented, final validation pending | `bench list/show/edit/remove` with machine output | Preview by default; apply with backup/verification; preserve files and provenance; reject last-task removal |
| 5 — implemented, final validation pending | `report eval --export` portable directory | Exact original receipts and matching inputs; move/delete-original replay; missing/changed inputs reject; stopped costs stay incomplete |
| 6 — authorized, pending publication | Publish 0.10.0 through existing manual OIDC workflow | Three-OS CI, exact-archive dry run, one upload, registry integrity and isolated feature smoke |

Items 2–5 address basic usability gaps, not missing statistical methods.
Inspect existing APIs before implementation and avoid duplicating request preview,
report export, failure freezing or existing budget controls.

## Later decisions

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
