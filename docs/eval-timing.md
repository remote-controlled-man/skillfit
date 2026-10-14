# Execution timing and interruption detection

New paired trial receipts retain `startedAt`/`finishedAt` wall timestamps and
measure `durationSeconds` with `performance.now()` around the executor and
engagement check. `timing.wallDurationSeconds` preserves the wall interval;
`timing.execution` is optional CLI diagnostics (null for other executors).
Legacy receipts are never rewritten or silently converted.

CLI diagnostics include the nominal timeout, monotonic and wall elapsed
milliseconds, maximum observation gap, maximum wall/monotonic discrepancy,
actual timeout detection time, termination delay and any anomaly. The CLI checks
the deadline at its timer, a one-second heartbeat, output arrival and process
close. Output arriving after the deadline cannot turn a late completion into a
success merely because a timer callback has not run yet.
After termination, pipe draining is bounded to two additional seconds so an
escaped descendant retaining stdout cannot keep the executor waiting for close
indefinitely. Captured public output remains in the failure receipt; process
groups still cover ordinary shell children and grandchildren.

More than five seconds of clock discrepancy, or an observation interval longer
than the one-second heartbeat plus five seconds, is a timing anomaly. This
detects large sleep/suspension, clock adjustment and event-loop interruptions;
it does not distinguish their causes. The process tree is killed on detection,
public output and available partial token usage are retained, and the managed
session stops further calls. The trial is an environment error under the
existing pairwise exclusion rules, not a model quality miss. Invalid CLI
timeout values are rejected instead of falling into Node's one-millisecond
timer coercion.

Node [does not promise exact timer firing](https://nodejs.org/api/timers.html#settimeoutcallback-delay-args).
No JavaScript callback can enforce a real-time limit while its process/host is
suspended. Monotonic clocks also do not certify active model computation or
provider billing; whether they include host suspend depends on the clock and
platform. Recorded intervals are not clamped to the configured timeout and
sleep is not subtracted to invent an active duration.

On macOS, a declared live experiment can run under the temporary assertions
provided by `caffeinate -is` (see the local `caffeinate(8)` manual). Idle-system
prevention lasts only for the experiment process; the system-sleep assertion
works on AC power. This does not guarantee execution across lid closure, forced
sleep, power loss or process suspension. The interruption detector still
applies. No persistent power preference is changed.

Offline checks cover normal deadline/termination, forward and backward wall
discontinuities, clocks which advance together during an interruption, late
completion, process-tree termination, partial public usage and receipt retention.
These checks run Node fixtures only and make no agent/model calls.

The managed-session plan also freezes each declared workspace's logical and
physical name. Matrix-defined pure trust registrations for either frozen name
are the same permitted CLI bookkeeping. Alias retargeting, unrelated directories,
untrusted values and extra configuration fields still stop further calls. This
avoids a false configuration-drift stop when a CLI canonicalizes a macOS
temporary path; it does not ignore arbitrary configuration edits.
