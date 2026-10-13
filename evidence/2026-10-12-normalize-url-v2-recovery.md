# Timing repair: one completed invocation, trust-alias guard stop

The separately declared timing-repair batch made one original-Skill invocation,
then stopped on a configuration guard. It has **zero graded pairs** and no
treatment invocation. The output, final usage, all three pre-call refusals and
the stopped session remain preserved. Its delivery is not retroactively turned
into a quality observation after repairing the guard.

## Earlier timeout diagnosis

The previous baseline started at 2026-10-12 18:56:47.615 +0800. Local `pmset`
events record clamshell sleep at 18:58:41, dark wake at 19:16:31, return to sleep
at 19:16:33 and dark wake at 19:33:06. The timeout receipt finished at
19:33:06.390, with a 2178.775-second wall interval and nominal 600-second timer.
The deadline fell inside the recorded sleep interval; the failed receipt
coincides with the later wake. This supports host suspension delaying execution,
rather than interpreting the wall interval as active model computation.

The [original report](2026-10-12-diagnosing-v2.md) and all 249 files in its
artifact index remain unchanged. Its final token usage is still unknown; no
private rollout/session reasoning is consulted to fill that gap. The new
[package](artifacts/2026-10-12-normalize-url-v2-recovery/README.md) retains an
exact copy of the published timeout receipt and only the relevant power events.

New trial costs use a monotonic interval and retain wall duration. CLI deadlines
are checked at a one-second heartbeat, output arrival and process close as well
as the nominal timer. Clock discrepancy over five seconds or an observation gap
over six seconds produces an environment error, retains available public output
and partial usage, and stops calls. Pipe draining after termination is bounded.
These observations do not identify billing or active compute. JavaScript cannot
run while its host is suspended; [Node does not guarantee exact timer firing](https://nodejs.org/api/timers.html#settimeoutcallback-delay-args).
See [the timing contract](../docs/eval-timing.md).

## Retained timing-repair batch

The [declaration](plans/2026-10-12-normalize-url-v2-recovery.json) froze two pairs,
four calls, the unchanged original Skill and compact v2, the unchanged
normalize-url fixture/grader and a 600-second timeout. The same configured
`gpt-6.1-sol / xhigh / default`, Codex CLI `0.162.0-alpha.17.2` and Node
`v24.21.0` were used. Served model identity remains unrecorded.

The single invocation completed normally in **400.535 monotonic seconds** and
400.534 wall seconds. Its CLI diagnostics record no anomaly, no timeout,
maximum observation gap 1002ms and maximum wall/monotonic discrepancy 1.241ms.
Temporary idle-sleep assertions were verified before calls; the utility was
alive at finish and released afterward. System-sleep prevention applies on AC
power; this invocation recorded Battery Power. Forced sleep remains outside the
JavaScript process's control.

Public final spending for this excluded invocation is:

| Input | Cached input | Uncached input | Output | Elapsed |
|---:|---:|---:|---:|---:|
| 325088 | 288512 | 36576 | 10752 | 400.535s |

This is additional study spending, not evidence of a Skill cost increase or
decrease. No successes were graded, so cost per success is undefined.

## Trust-alias diagnosis and correction

The old guard declared the logical macOS temporary path; the CLI registered its
canonical physical path. The post-call guard reported a changed configuration.
Removing only pure trust registrations for the physical counterparts of the
four declared workspaces restores the exact frozen configuration hash
`c7ccf165f24a4e6e438285bbaf17916ae1db762cd8f3edad26d44c2abef9cf2f`.
The package's `trust-alias-proof.json` records those hashes without publishing
configuration bodies. Other configuration bytes are unchanged under this check.

The subsequent repair freezes both logical and physical names before calls and
pins their relationship. Unrelated trust paths, extra settings, untrusted values
and alias retargeting still stop calls. Two offline regression tests cover these
boundaries; the full project suite passed **460 tests**. The original timing-only
runner is retained in this batch's frozen replay; the alias fix belongs to a
[separate new declaration](plans/2026-10-12-normalize-url-v2-comparison.json).

Fresh archive replay reports matched 0, excluded 4, actual invocations 1 and
identical cost aggregation/analysis. The new comparison must be analyzed
separately. This stopped batch is never appended to, replaced or pooled into
quality rates. No global Skill replacement, commit, PR or upstream write occurs.
