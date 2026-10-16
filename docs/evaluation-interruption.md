# Interrupt and retain an evaluation

This is an unreleased source fix; the immutable npm 0.10.0 archive does not
include it. Build the current checkout to use it. It changes interruption
handling, not the statistical or adoption protocol.

## Stop a live run

Press **Ctrl+C** once during a live evaluation. The same path handles `SIGTERM`.
It covers paired inject/installed evaluations, JSON request execution, trigger
evaluations and live `bench check --calibrate`. It also stops an active harness
verifier or judge. Previews and read-only reports install no interrupt handlers.

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
- Existing per-trial output, transcripts and `_result.json`: settled final usage
  stays final; recovered counters from an interrupted call stay partial; missing
  usage stays unknown. Interruption is an execution error, not a graded failure.
- `_interruption.json`: version 1 signal name, receipt time, exit code and
  `automaticRetry: false`.
- `_session.json`: stopped status, call counts and stop reason.
- `_artifacts.json`: inventory and hashes of retained files, including interruption
  metadata. A stopped prefix does not acquire a completed efficacy verdict.

An interrupted judge additionally keeps `_interrupted-judge-<call>.json` with its
available output/usage or null when unavailable. Separate judge spending remains
outside the primary-agent cost totals; this record does not make that bill complete.
Trigger receipts retain interrupted output/tokens with partial/unknown status;
the existing paired JSON assessment/export contract is not extended to trigger
or judge runs by this fix.

Inspect a paired stopped run without another agent call:

```bash
node dist/cli.js report eval ./runs/my-run --json
node dist/cli.js report eval ./runs/my-run --export ./exports/my-run --json
```

Export still requires matching pinned inputs and a fresh destination. A completed
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
node --test dist/commands/eval-interruption.test.js dist/harness/interruption.test.js
```

The tests inject fake Node CLI/process trees and a fake fetch implementation. They
check interrupted primary/verifier/judge work, trigger/calibration/request execution,
repeated signals, between-call interruption, partial and unknown costs, sealed
inventories, stopped-package replay, exit codes and handler/context cleanup.
POSIX integration tests deliver real OS signals to the harness. Windows tests emit
the corresponding Node signal event through an isolated harness because Node's
`child.kill('SIGINT')` forcibly terminates a Windows process; real Windows
`taskkill /T` still terminates the fake CLI and its descendant. These tests do not
establish physical-console event delivery or call any real model or agent CLI.
