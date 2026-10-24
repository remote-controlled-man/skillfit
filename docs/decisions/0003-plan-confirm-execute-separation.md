# ADR 0003: Separate plan, confirm and execute responsibilities

**Status:** proposed (A3 evaluation delivery recorded; A4 authoring remains open). **Date:** 2026-10-22.
**Scope:** Internal evaluation/application interfaces; existing confirmation contracts retained.
**Supersedes:** none. **Superseded by:** none.

## Context

Before A3, shared planning called the command's dry-run branch and captured its
preview. Request execution, positional eval, single-arm modes and self-test
have related but distinct plan/confirmation contracts. Input, policy,
implementation and self-test context must remain hash-bound. A service extraction
can accidentally drop context or change serialization without changing outcomes.

The [current interface view](../architecture-interfaces.md#current-entry-contracts)
also shows that plain text and JSON/request execution do not have a universal
confirmation requirement. Internal restructuring must preserve those differences
and all preflight/session protections.

## Decision

Resolve read-only inputs using explicit dependencies; build the existing plan
deterministically from resolved data and an explicit implementation digest;
execute only after the entry's existing confirmation and dispatch rechecks.
Move saved-evidence read/audit/assessment orchestration behind an application
interface and keep render/interactive behavior at the entry boundary.

CLI, request and self-test adapters should call the shared operations instead
of invoking a command in dry-run mode to construct a plan. Preserve complete
context, neutral option/types, old export paths, errors, JSON order and mode
semantics. Keep separate single-arm contracts. Bench prepare/apply follows the
same effect separation, with explicit drafting rather than hidden model calls.

## Alternatives considered

Continuing to reuse dry-run avoids immediate churn but couples planning to
command execution and presentation. Adding an independent planner per entry
creates competing policy paths. Requiring a new universal confirmation flow
changes public behavior and is outside this refactor. Prefer shared internal
operations with compatible adapters and current entry-specific rules.

## Consequences

Plan construction can be verified independently of dispatch and presentation.
Resolution remains effectful read-only work, while execution still owns the
preflight/guard/session lifecycle. More explicit dependencies and compatibility
wrappers are required. Real code movement changes implementation fingerprints:
new previews/confirmation are expected; preserving an old digest by omitting
new modules would weaken evidence integrity.

## Delivery and verification

A3 now implements read-only resolution, pure plan building, shared evaluation
execution and saved-read services in the current source. Legacy adapters keep
return types, exports and wire ordering. Calibration uses its separate baseline
plan; self-test suites call the shared application directly. See the
[current interface table](../architecture-interfaces.md#target-application-interfaces-proposed)
and [A3 execution record](../plans/2026-10-22-documentation-governance-and-architecture.md)
for concrete ownership and verification. The full ADR remains proposed because
A4 prepare/apply is unimplemented; this staged status does not weaken the A3
contract. F7 delivery and F5 content synchronization are prerequisites; current
F3/F5 acceptance status belongs to the [measurement plan](../plans/2026-10-21-measurement-contract-and-capability-remediation.md#当前执行状态).

Verify [CLI usage](../../src/commands/eval-cli-usage.test.ts),
[component](../../src/harness/eval-component.test.ts),
[case preflight](../../src/commands/eval-preflight.test.ts),
[calibration](../../src/commands/calibration-cli.test.ts) and
[self-test](../../src/commands/bench-self-test.test.ts) behavior. Fixed data and
implementation digest must retain serialization/hash; changed context/inputs
must reject before calls. Preserve stopped/unknown/legacy and synthetic
rejection behavior, then validate relocated packages/replay under V1.
