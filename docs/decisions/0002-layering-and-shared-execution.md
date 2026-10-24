# ADR 0002: Layering and shared execution mechanisms

**Status:** proposed (complete layering/enforcement decision; A2 extraction delivered). **Date:** 2026-10-22.
**Scope:** Internal responsibilities and dependency rules; public behavior retained.
**Supersedes:** none. **Superseded by:** none.

## Context

The current runtime is acyclic under its existing checker, but several lower
consumers import runner for verifier/process or summary helpers. Runner and
judge mix reusable mechanisms with execution. Commands also hold orchestration
and authoring responsibilities. Zero cycles alone does not prevent this coupling.

The [current boundary view](../architecture-boundaries.md#current-component-dependencies)
records actual imports; its target table is not yet an enforced policy. Frozen
replay/source copies are historical inputs, not extra active modules to refactor.

## Decision

Separate contracts, pure calculation, I/O mechanisms, integration, evidence,
execution, application and entry/presentation roles within the current CLI.
Extract process/verifier/workspace and the pure judge/summary helpers needed
by audits before moving consumers. Keep execution-specific mode and statistical
rules with their proper orchestrator instead of forcing all modes into one path.

Retain one implementation with compatible exports and the same error-class
identity. Preserve the existing install transaction and matrix ownership. A5
should classify all active modules and runtime/type dependencies, test explicit
prohibited effects and allow only narrow, owned temporary exceptions. The
migrated scope must have no remaining exception when its stage completes.

## Alternatives considered

Keeping runner as the universal utility module preserves import paths but makes
low-level consumers depend on unrelated execution. A wholesale directory or
framework rewrite increases migration risk without proving behavior retention.
Line-count limits can split a file without separating responsibility. Prefer
small extractions with existing ports, targeted regressions and package checks.

## Consequences

Shared mechanisms can be used by checks, controls and replay without importing
experiment execution. Compatibility delegates and explicit role registration
add maintenance work. Extracting process lifecycle or helper types can affect
signals, errors, timing and hashes; observable parity must be demonstrated.
Static dependency/effect checks have bounded coverage and do not prove that
arbitrary code is side-effect free.

## Delivery and verification

A1 supplies this design and the [migration/debt map](../architecture-boundaries.md#migration-and-debt-ownership).
A2 has extracted process/verifier/workspace, judge protocol and paired/trigger
summaries; old exports delegate or re-export the same implementation. The judge
prompt compatibility wrapper retains its random default while audit supplies the
retained nonce to pure construction. Focused dependency regression covers the
shared consumers; no general role/type/effect gate is claimed. A4 handles bench authoring; A5 implements
role/type/effect gates. Use [verifier](../../src/harness/verifier.test.ts),
[timeout](../../src/harness/verifier-timeout.test.ts),
[interruption](../../src/commands/eval-interruption.test.ts),
[self-test](../../src/commands/bench-self-test.test.ts),
[report](../../src/commands/eval-report.test.ts) and
[architecture](../../scripts/check-architecture.test.mjs) regressions, then the
final independent package/replay checks. A1 introduces no extraction, new
architecture policy file or production enforcement.
