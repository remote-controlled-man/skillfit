# Offline case gates before evaluation

This behavior is included in 0.10.1. The immutable npm 0.10.0 archive predates it.
See the [release record](releases/0.10.1.md) for publication status.

Every live `eval` runs the existing offline `bench check` probes before creating
the native run directory or dispatching its first agent/judge call. This covers
inject, installed Skill revisions, rules/MCP configuration experiments, trigger
mode and JSON requests. There is no force/skip flag. Invalid plans, exhausted
call ceilings and existing run groups are rejected before probing.

Only the selected tasks are probed. Trigger mode further limits probes to tasks
with a `shouldTrigger` label, matching the actual dispatch population. The full
bench must still load, and its full content hash stays pinned. A broken verifier
on a structurally valid, unselected task does not block a selected task.

## What blocks execution

The gate reuses `bench check` diagnostics and disposable copies:

- Command task: the untouched fixture must fail its verifier.
- Output task: missing and empty `_output.md` must be rejected.
- Registered oracle: its command must succeed and the repaired fixture must pass
  the verifier with every reported named check passing.
- Verifier/oracle processes without an exit verdict, malformed mock markers and
  other incomplete local checks fail closed. An ordinary mock output that fails
  a functioning verifier is informational, since it can represent a negative
  example; a crashed/timed-out mock probe is a hard failure.
- Bench, candidate and baseline fingerprints must remain equal to the preview's
  inputs after all probes. Changes or unreadable inputs block execution.

On any `FAIL`, zero agent/judge calls are dispatched and no run directory or
quality verdict is created. Human output includes gate codes, reasons and
remedies. Request JSON returns `kind: "skillfit.eval-error"`,
`error.code: "CASE_PREFLIGHT_FAILED"`, `casePreflight.status: "blocked"` and all
diagnostics; exit code is 2. Keep that JSON if the failed check needs archiving.

## Warning, unknown and not applicable

`casePreflight.checks` uses these statuses:

| Status | Meaning | Blocks calls? |
| --- | --- | --- |
| `FAIL` | A required gate failed or could not finish | Yes |
| `WARN` | Observed concern: large fixture, facet-count bounds, weak/missing negative controls | No |
| `UNKNOWN` | Evidence was not obtained: no oracle, absent output mock coverage, omitted mock arm, live difficulty not measured | No |
| `INFO` | Context or inapplicable check, such as text mock probes for file-edit tasks | No |
| `PASS` | This particular offline gate passed | No |

`ORACLE` without a reference repair is `UNKNOWN` here; standalone `bench check`
keeps its version 1 `WARN` contract. `MOCK_COVERAGE` for command tasks is `INFO`
because text mock answers do not implement file edits. A `LIVE_DIFFICULTY`
unknown is always present: offline probes neither calibrate a live agent nor
establish Skill benefit or generalization. Missing optional facets do not become
a fabricated graded signal. A nonzero untouched-fixture exit alone does not
prove the intended defect caused the failure; review it and supply an independent
oracle. Checks execute trusted local bench code, not a sandbox for untrusted code.

`status: "ready"` means zero hard failures in this offline scope. Warnings and
unknowns remain explicit in `summary`; ready does not authorize adoption. The
existing statistical, complete-cost and independence requirements stay unchanged,
and `automaticUpgrade` remains false. This gate makes no calibration or repair
calls and does not retry, add tasks or expand the declared budget.

## Preview, records and cost

`--dry-run` never executes verifiers/oracles or creates run files. Its machine
plan declares `casePreflight: {schemaVersion: 1, scope: "offline-case-integrity",
required: true, status: "pending"}`. A preview is not a passed case check. JSON
requests still require the matching preview hash before probes start; observed
probe output and elapsed time do not enter that hash, so harmless timing changes
cannot invalidate the approved plan.

After a successful gate, `_plan.json.details.casePreflight` freezes the complete
report before dispatch: selected IDs, full bench fingerprint, individual gate
codes/statuses, locations, remedies and bounded process evidence. The native
artifact index covers that plan. JSON assessment returns `casePreflight`, including
for stopped runs; incomplete/stopped evidence remains subject to the enclosing
`evidence.verified` field. A missing historical report is `null`, never an implied
pass. Offline reporting and portable replay preserve the original preflight;
they do not rerun it against current inputs or change historical records.

`casePreflight.cost` records **0 model calls** and observed offline wall time in
`durationMs`. This time includes local probes and fingerprint verification. It is
separate from primary-agent call durations, token totals and spending stop lines;
it is not a CPU, toolchain or dollar bill. Agent/judge budgets and all existing
cost coverage rules remain unchanged.

Ctrl+C/SIGTERM during probing terminates managed verifier/oracle process trees,
dispatches no agent and exits 130/143. Because the run has not started, no stopped
run directory is synthesized. Once dispatch preparation has created a native run,
the normal [interruption and retained-record contract](evaluation-interruption.md)
applies.

## Reproduce offline

```bash
npm test
node --test dist/commands/eval-preflight.test.js dist/commands/eval-interruption.test.js dist/commands/eval-export.test.js
```

The tests use mock executors and local fake processes. They cover all delivery
modes, zero-call hard stops, separate warnings/unknowns, selected/trigger scope,
missing/empty outputs, oracle failures, process failure, malformed/partial mock
coverage, input mutation, unchanged previews, request JSON, interruption, and
portable retention. No real agent CLI or model API is called.

Machine contracts: [preflight schema](schemas/eval-preflight.schema.json),
[evaluation result schema](schemas/eval-result.schema.json),
[standalone bench-check JSON](bench-check-json.md).
