# skillfit architecture

skillfit has two main workflows: measure a configuration against task cases, and
inspect or install agent configuration. CLI adapters choose a workflow; the
measurement core owns evidence and interpretation. Runtime code uses Node built-ins.

## Entry points and modules

| Area | Responsibility | Starting points |
| --- | --- | --- |
| CLI | Parse arguments, reject unsupported combinations and select a command | [cli](../src/cli.ts) |
| Evaluation commands | Prepare/confirm plans, preflight inputs and dispatch paired or single-arm work | [eval CLI](../src/commands/eval-cli.ts), [plans](../src/commands/eval-plan.ts), [component](../src/commands/eval-component.ts) |
| Measurement core | Load cases, run disposable workspaces, verify outcomes and retain costs/session evidence | [bench loader](../src/harness/bench.ts), [runner](../src/harness/runner.ts), [session](../src/harness/experiment-session.ts), [trigger](../src/harness/trigger.ts) |
| Reports and policy | Parse saved observations, audit receipts, render reports and assess adoption separately | [manifest parser](../src/harness/eval-manifest.ts), [report adapter](../src/commands/eval-report.ts), [audit](../src/harness/eval-audit.ts), [acceptance](../src/harness/eval-acceptance.ts) |
| Case authoring | Scaffold, capture, draft and check cases; manage manifest registrations | [bench commands](../src/commands/bench.ts), [offline checks](../src/harness/bench-check.ts), [diagnostics](../src/harness/bench-diagnostics.ts), [source capture](../src/commands/bench-source.ts), [drafting](../src/commands/bench-draft.ts), [management](../src/commands/bench-manage.ts) |
| Agent integration | Resolve matrix capabilities and execute via CLI/API/injected adapters | [matrix](../src/matrix/agents.json), [definitions](../src/agents.ts), [executors](../src/harness/executors/) |
| Configuration | Inspect local configuration; plan and apply selected profiles or portable bundles | [doctor](../src/commands/doctor.ts), [install](../src/commands/install.ts), [setup](../src/commands/setup.ts), [bundle export](../src/commands/bundle.ts) |
| MCP discovery | Handshake and inspect the tool catalog without invoking a tool | [probe](../src/mcp/probe.ts) |

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

## Dependency boundaries

Commands can depend on core functions and render their results. The core should
not import command adapters. Shared data parsing, diagnostics and policy belong
with their domain rather than a renderer. Agent-specific paths and capabilities
come from the matrix; no new command-local vendor path constants are needed.

Saved-manifest parsing lives in the core; audit and adoption policy use the same
parser as report adapters. `node scripts/check-architecture.mjs` verifies the
compiled runtime, including literal dynamic imports, for cycles and core-to-command
dependencies. This development check uses the existing TypeScript compiler and
adds no runtime dependency.

Offline case gates and their diagnostic model also live in the core. Eval
preflight calls that shared offline entry directly. The bench command keeps
loading/selection, calibration preparation, confirmation and CLI summaries;
calibration reuses the same gate implementation. Generated verifier templates
remain standalone programs rather than importing command modules.

## Configuration writes and artifact writes

Actual user-configuration changes go through dry-run/planning, confirmation,
backup, write/validation and rollback on failure. Setup reuses the installer.
This transaction boundary stays intact during the cleanup.

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
