---
name: autonomous-iteration
description: Deliver a substantial, testable coding goal through multiple verified slices. Use for end-to-end features, migrations, or work spanning context windows; skip for small edits or research-only requests.
---

# Autonomous Iteration

## Overview

Turn a testable requirement into a bounded delivery loop. Persist the contract and evidence when the work can outlive one context window; keep routine implementation moving without repeatedly asking the user what to do next.

## Establish the delivery contract

Before editing, identify:

- the observable outcome and acceptance criteria;
- allowed repositories, directories, systems, and external side effects;
- safety, compatibility, and architecture invariants;
- the commands or observations that can verify completion;
- choices that genuinely require the user's product judgment or new authority.

Infer reversible implementation details from repository conventions. Ask only when a choice changes the product outcome, permission boundary, or recoverability.

## Select the smallest durable harness

- For one contained slice, use the normal plan and repository checks.
- For multiple dependent slices, maintain a checklist or dependency DAG.
- For work likely to cross context windows, keep a small versioned state directory such as `docs/agent/` containing the task contract, execution plan, feature status, progress log, and locked verification commands.
- For any outer loop, persist hard limits for iterations, wall-clock time, cost when observable, consecutive no-progress rounds, repeated failure fingerprints, and permission denials. Stop with `LIMIT_REACHED` when a hard limit is reached.
- Treat every hard limit as an enforced boundary: reaching it blocks `COMPLETE` even if the implementation appears finished. Keep counters and `startedAt` current enough for the harness to evaluate the boundary.
- On a resumed session, read repository rules, the task contract, current progress, and the smoke-test command before changing code.

Do not create process artifacts that are larger than the work. Their purpose is recovery and verification, not ceremony.

## Execute dependency-aware vertical slices

Choose the next unblocked slice that produces observable value. For each slice:

1. Read the closest applicable instructions and relevant source.
2. Establish a failing test, reproduction, or other concrete pre-change observation.
3. If installed, use the `vibe-coding` router and its selected engineering Skills.
4. Implement the smallest coherent vertical change.
5. Run focused checks, then the appropriate broader gates.
6. Review the diff for scope, security, generated-file drift, and missing documentation.
7. Record the evidence, remaining risks, and next unblocked slice.

Continue while a safe, useful next step remains and the persisted harness budget permits it. A retry must add new evidence or change the hypothesis. Stop after the same blocking condition repeats three times and report the exact blocker and evidence.

## Coordinate agents conservatively

Use subagents only for genuinely independent lanes such as parallel research, read-only reviews, or isolated implementations with explicit file ownership. Give each lane a bounded contract, inputs, allowed writes, and expected evidence.

Do not parallelize adjacent edits, dependent interface changes, migrations and callers without coordination, or multiple writers to the same plan or lockfile. Parallel implementation should use isolated worktrees when available, followed by a single integration pass and the full verification gates.

## Preserve authority and recoverability

"Finish this" increases persistence, not permission. Never infer authority to push, deploy, delete material data, modify production, broaden credentials, or send external messages.

Keep changes reviewable and recoverable. Do not leave undocumented half-behavior. Update source and generated artifacts together. Never store secrets in task or progress files.

## Prove completion

Do not use an agent-generated completion phrase as evidence. Completion requires a direct mapping from every acceptance criterion to executed evidence: a locked test, static check, browser or API observation, or a recorded human acceptance result. A planned or requested human step is not evidence and keeps the task out of `COMPLETE`.

Before any completion claim, obtain a fresh independent review. Give the reviewer the original requirement or task contract, final artifact, executed evidence, and locked verification commands without the implementer's self-justification. Resolve actionable findings and record the reviewer result in the acceptance ledger. If an independent reviewer is unavailable, report verification as incomplete rather than self-approving.

Set `COMPLETE` only when the ledger is non-empty, every feature is `passing`, every passing feature has a non-future timestamp plus an existing local or HTTP(S) evidence artifact, the independent reviewer is identified rather than anonymous, the review result artifact is verifiable, and the unresolved actionable finding count is zero. `startedAt` must be a real non-future timestamp. Blank IDs, duplicate IDs, blank planned verification, missing artifacts, hidden placeholders, or pending human checks are invalid completion state.

Before handing off, state:

- what changed;
- which acceptance criteria were proven and how;
- which checks ran and their results;
- who or what performed the independent review and its result;
- any remaining limitations, risks, or user-owned decisions.
