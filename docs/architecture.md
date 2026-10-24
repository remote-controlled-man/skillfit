# skillfit architecture

skillfit has two main workflows: measure a configuration against task cases, and
inspect or install agent configuration. CLI adapters choose a workflow; the
measurement core owns evidence and interpretation. Runtime code uses Node built-ins.

This entry describes the current source checkout, including unpublished changes;
the package version string alone does not identify the installed behavior. Use
the [capability table](eval-agent-preflight.md#current-source-capability-table)
and [versioned release record](releases/0.13.1.md) for that distinction. A3/A4 separate evaluation and authoring from command adapters; A5 enforces registered runtime/type directions and bounded effect checks. Final stage evidence belongs to the existing plan.

Read by question:

- [System/module boundaries](architecture-boundaries.md): current import view,
  enforced dependency roles and owned migration/debt map.
- [Runtime scenarios](architecture-runtime.md): paired, trigger, calibration,
  self-test, saved report/replay, failure evidence and package/write boundaries.
- [Interfaces](architecture-interfaces.md): existing ports and entry-specific
  confirmation, current resolve/build/execute and prepare/draft/apply authoring interfaces.
- [Architecture decisions](decisions/README.md): the existing ADRs, alternatives,
  consequences and verification; accepted decisions retain their stated limits.

## Entry points and modules

| Area | Responsibility | Starting points |
| --- | --- | --- |
| CLI | Parse arguments, reject unsupported combinations and select a command | [cli](../src/cli.ts) |
| Evaluation commands | Adapt arguments, presentation and existing confirmation; delegate evaluation to application services | [eval CLI](../src/commands/eval-cli.ts), [plans](../src/commands/eval-plan.ts), [component](../src/commands/eval-component.ts) |
| Evaluation application | Resolve/build plans, gate/dispatch paired and trigger runs, read/assess saved evidence; calibration has a separate baseline contract | [planning](../src/harness/eval-planning.ts), [service](../src/harness/eval-service.ts), [read service](../src/harness/eval-read-service.ts), [calibration](../src/harness/calibration-service.ts) |
| Measurement core | Load cases, run disposable workspaces, verify outcomes and retain costs/session evidence | [bench loader](../src/harness/bench.ts), [runner](../src/harness/runner.ts), [session](../src/harness/experiment-session.ts), [trigger](../src/harness/trigger.ts) |
| Reports and policy | Parse saved observations, audit receipts, render reports and assess adoption separately | [manifest parser](../src/harness/eval-manifest.ts), [report adapter](../src/commands/eval-report.ts), [audit](../src/harness/eval-audit.ts), [acceptance](../src/harness/eval-acceptance.ts) |
| Case authoring | Scaffold, capture, draft and check cases; manage manifest registrations | [bench commands](../src/commands/bench.ts), [offline checks](../src/harness/bench-check.ts), [diagnostics](../src/harness/bench-diagnostics.ts), [authoring](../src/harness/bench-authoring.ts), [source capture](../src/harness/bench-source.ts), [drafting](../src/harness/bench-draft.ts), [management adapter](../src/commands/bench-manage.ts) |
| Agent integration | Resolve matrix capabilities and execute via CLI/API/injected adapters | [matrix](../src/matrix/agents.json), [definitions](../src/agents.ts), [executors](../src/harness/executors/) |
| Configuration | Inspect local configuration; plan and apply selected profiles or portable bundles | [doctor](../src/commands/doctor.ts), [install](../src/commands/install.ts), [setup](../src/commands/setup.ts), [bundle export](../src/commands/bundle.ts) |
| Installation transaction | Stage ordered file writes, preserve backups, commit, validate and roll back failures | [transaction](../src/install/transaction.ts), [shared constants](../src/install/constants.ts) |
| MCP discovery | Handshake and inspect the tool catalog without invoking a tool | [probe](../src/mcp/probe.ts) |

These are current responsibility/start-point groups, not proof that every command
is already thin or every core module belongs to one pure layer.

## Evaluation lifecycle

The preview resolves selected cases, target fingerprints, executor capabilities,
call ceilings and the output layout. It performs no verifier, oracle or model call.
Live dispatch checks the agent environment and case integrity, rechecks inputs,
then creates a fresh run with sealed inputs and a frozen plan.

The session tracks every invoked call, including failures, judges and partial
usage. Paired runs compare baseline/treatment; calibration measures baseline
difficulty; trigger runs measure Skill discovery. Saved reports audit original
evidence. Rendering and replay do not make a single-arm run a paired efficacy
study or turn unknown usage into zero. [Metrics](metrics.md), [planning](eval-planning.md)
and [cost accounting](eval-costs.md) define these contracts.
The [runtime view](architecture-runtime.md#evidence-lifecycle-and-failure-states)
maps actual files/statuses without adding a new persistent state machine.

## Dependency boundaries

Commands can depend on core functions and render their results. The core should
not import command adapters. Shared data parsing, diagnostics and policy belong
with their domain rather than a renderer. Agent-specific paths and capabilities
come from the matrix; no new command-local vendor path constants are needed.

Saved-manifest parsing lives in the core; audit and adoption policy use the same
parser as report adapters. After building, `node scripts/check-architecture.mjs`
checks runtime cycles, registered dependency roles, source type directions and
bounded pure/application effects against [the policy](../scripts/architecture-policy.json).
It uses the existing development compiler and adds no runtime dependency.
The [boundary view](architecture-boundaries.md#enforcement-today) records exact
coverage, alias limits and the single owned legacy matrix-validation edge.
Shared mechanisms, summaries and authoring implementations preserve compatible
exports. `npm test` and full CI execute the same real policy after building;
see the [stage plan](plans/2026-10-22-documentation-governance-and-architecture.md).

Offline case gates and their diagnostic model also live in the core. Eval
preflight calls that shared offline entry directly. The bench command keeps
loading/selection, confirmation and CLI summaries; the calibration service owns
its preparation/execution and reuses the same gate implementation. Generated verifier templates
remain standalone programs rather than importing command modules.

## Configuration writes and artifact writes

Actual user-configuration changes go through dry-run/planning, confirmation,
backup, write/validation and rollback on failure. Setup reuses the installer.
The command prepares ordered writes and validates profile content and lockfile
bytes. The independent `install/` transaction stages all files before committing,
then runs that validation callback. User backups retain the first original;
lockfile backups retain the previous version. Temporary restore copies retain
the immediately previous target for rollback. Cleanup attempts every file and
reports its failures alongside the initial error; failed rollbacks retain their
restore copies. This is best-effort rollback, not multi-file crash atomicity.

Setup delegates to the same command. Bundle export copies all active compiled
runtime modules, including `install/`, so relocated bundles use this transaction
without referring to the source checkout.

New benches, evaluation runs and replay exports instead use fresh destinations
and preserve collision checks. Verifiers execute against disposable fixture
copies. See [case management](case-management.md), [sealed inputs](evaluation-input-snapshots.md)
and [portable packages](replay-packages.md) for the distinct record contracts.

## Active code and frozen evidence

`src/` is the active TypeScript implementation and `dist/` is its build output.
`evidence/artifacts/` contains fixed observations, archives and historical replay
implementations. Those copies are inputs to reproduction, not extra active
modules to refactor or include in an active dependency scan. Dated release recipes
and receipts retain their original versions too.

`runs/` is local evaluation output. The ignored private lab is outside development,
CI and package scans. Offline tests use injected executors and temporary roots;
see [contributing](../CONTRIBUTING.md) for the existing build/test commands and
[the documentation index](README.md) for the public contracts.
