# Interrupt and retain an evaluation

This fix is included in 0.10.1; see the [release record](releases/0.10.1.md)
for publication status. The immutable npm 0.10.0 archive does not include it. It changes interruption
handling, not the statistical or adoption protocol.

## Stop a live run

Press **Ctrl+C** once during a live evaluation. The same path handles `SIGTERM`.
It covers paired inject/installed evaluations, JSON request execution, trigger
evaluations and live `bench check --calibrate`. It also stops an active harness
verifier or judge. Read-only JSON previews and reports start no executor.

Version 0.11.0 extends cancellation across standalone `bench check`,
including its verifier and reference-repair descendants. Disposable probe copies
are removed. Nested checks reuse the enclosing evaluation's cancellation context
and restore handlers when finished; they do not swallow the interruption.

The source also cancels [offline case preflight](eval-case-preflight.md) before
dispatch. Its verifier/oracle trees stop with exit 130/143 and zero model calls;
because a native run has not started, no stopped run directory is synthesized.
Once a run directory exists, the retained-evidence contract below applies.

The runner stops subsequent dispatches, terminates managed CLI/process trees
and waits for output to close. POSIX uses the process group; Windows uses
`taskkill /T`. Pipe draining is bounded when a descendant retains a pipe. HTTP
executors abort their local request. The process then seals retained records and
exits **130 for SIGINT** or **143 for SIGTERM**, including request-based JSON
execution. Diagnostics go to stderr; JSON stdout remains one document.

Repeated signals during cleanup keep the first interruption and do not bypass
sealing. There is no automatic retry, replacement, partner invocation or expansion.
Wait for the command to finish rather than treating the first signal as an
immediate process exit. After sealing, signal handlers and cancellation context
are removed so later operations do not inherit a cancelled run.

## Retained evidence

The native run directory keeps:

- `_plan.json` and `_calls.jsonl`: original declaration and actual dispatch events.
- In new source runs, `_inputs.json` and `_inputs/`: sealed inputs available even
  if original Skill/bench/request paths later change or disappear.
- Existing per-trial output, transcripts and `_result.json`: settled final usage
  stays final; recovered counters from an interrupted call stay partial; missing
  usage stays unknown. Interruption is an execution error, not a graded failure.
- `_interruption.json`: version 1 signal name, receipt time, exit code and
  `automaticRetry: false`.
- `_session.json`: stopped status, call counts and stop reason.
- `_artifacts.json`: inventory and hashes of retained files, including interruption
  metadata. A stopped prefix does not acquire a completed efficacy verdict.

Version 0.11.0 records each judge call separately and shows primary
Agent, judge and combined invocation costs; missing/partial usage remains
incomplete. An interrupted judge also retains the existing
`_interrupted-judge-<call>.json` record. Neither a receipt nor a known token total
proves an exact provider bill. See [cost accounting](eval-costs.md).

The same source seals stopped calibration `_calibration.json` records with the
whole declared task set, including zero-count tasks not reached. Trigger receipts
retain interrupted output/tokens with partial/unknown status. Supported sealed
paired, calibration and trigger runs, including new judge receipts, can be read,
audited and exported with the shared report entry point. Historical summaries
without native evidence remain unverified; missing original runtime support
cannot be silently supplied by substituting a new implementation.

Inspect a stopped native run without another agent call:

```bash
node dist/cli.js report eval ./runs/my-run --json
node dist/cli.js report eval ./runs/my-run --export ./exports/my-run --json
```

Export uses [sealed inputs](evaluation-input-snapshots.md) for new source runs;
older runs still require matching recovered inputs. A fresh destination is required. A completed
export replays the same stopped status and cost coverage; it cannot authorize an
upgrade. Preserve this run, fix the cause and make a fresh bounded declaration if
further spending is authorized. Unused slots are not permission to continue.

Local cancellation cannot guarantee that a provider stops work already accepted
on its servers. Usage unavailable after HTTP cancellation remains unknown.
`SIGKILL`, power loss and storage failures can prevent sealing; a directory without
final session/index files remains incomplete. Built-in executors and managed local
processes participate in cancellation; unrelated services are outside that control.

## Offline regression checks

```bash
npm test
node --test dist/commands/eval-interruption.test.js dist/commands/bench-calibration.test.js dist/harness/interruption.test.js
```

The tests inject fake Node CLI/process trees and a fake fetch implementation. They
check standalone verifier/oracle descendants and interrupted primary/verifier/judge work, trigger/calibration/request execution,
repeated signals, between-call interruption, partial and unknown costs, sealed
inventories, stopped-package replay, exit codes and handler/context cleanup.
POSIX integration tests deliver real OS signals to the harness. Windows tests emit
the corresponding Node signal event through an isolated harness because Node's
`child.kill('SIGINT')` forcibly terminates a Windows process; real Windows
`taskkill /T` still terminates the fake CLI and its descendant. These tests do not
establish physical-console event delivery or call any real model or agent CLI.
