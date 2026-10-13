# Canonical guard repaired; independent comparison stopped by provider errors

The frozen two-pair batch made **one** actual original-Skill invocation and no
treatment invocation. It produced **zero graded pairs**. It stopped at the
600-second deadline after public 503/TLS reconnection errors, before any public
agent message or tool command. This is an execution failure, not a Skill quality
regression. The baseline workspace and all three subsequent refusals are retained.

## What the new timing evidence establishes

The deadline was detected at **600001.623ms**, followed by an **11.403ms**
termination delay. The full trial took **600.019 monotonic seconds**, compared
with 600.017 wall seconds. Its largest observation gap was 1003ms and largest
wall/monotonic discrepancy 1.859ms, with no timing anomaly. This exercises the
real CLI termination path as well as the offline fixtures; the interval is
recorded rather than clamped to the limit.

The canonical workspace-alias guard passed. Temporary sleep assertions were
verified before execution, the utility remained alive at finish and was released;
AC power was recorded. This distinguishes this connection timeout from the
earlier clamshell-sleep anomaly and [trust-alias stop](2026-10-12-normalize-url-v2-recovery.md).
No global power preference, credential, model setting or Skill installation was
changed by the repair.

## Public failure and spending

The stream contains six events: thread/turn startup, one unstable-feature warning
and three reconnect error events. Reconnects 2/5 and 4/5 report 503 Service
Unavailable; reconnect 3/5 reports a TLS stream closing without `close_notify`.
The CLI's internal reconnects are part of one invoked executor. The harness adds
no retry or replacement sample. Final token usage is **unknown**, not an exact
zero, and no provider request-count/billing conclusion follows from the ledger.

Official [OpenAI error guidance](https://developers.openai.com/api/docs/guides/error-codes)
describes waiting/backoff for transient service errors. The public stream exposes
no `Retry-After` or machine-readable overload code, so the exact upstream cause
is unconfirmed. Increasing the task timeout would extend waiting rather than
establish that task computation needs a larger budget.

Across the two fresh stopped attempts, there are two actual executor
invocations and no graded comparison. Available additional input is at least
**325088**, output at least **10752**, plus unknown spending on this connection
timeout. Their separately recorded monotonic intervals total 1000.554s. These
are additional study costs; they are not a comparison between original Skill and
v2, and cannot be divided by a graded-success denominator of zero. Earlier
studies and orchestration/research/offline validation are excluded from these
totals.

## Fixed procedure and reproduction

The [declaration](plans/2026-10-12-normalize-url-v2-comparison.json) retained the
same original Skill, unchanged compact v2, normalize-url source/prompt/grader,
configured `gpt-6.1-sol / xhigh / default`, CLI `0.162.0-alpha.17.2`, Node
`v24.21.0`, adjacent baseline-first order, no judge and 600-second limit. Served
model identity and sampling remain unrecorded/uncontrolled. The full offline
suite passed **460 tests**; all contributed bench checks had zero failures.

The [frozen package](artifacts/2026-10-12-normalize-url-v2-comparison/README.md)
contains source/compiled code, complete inputs, the public errors, timing/power
diagnostics, ledgers, manifests, all receipts and hashes. Fresh extraction
reproduces matched 0/excluded 4, one actual invocation and exact cost aggregation.
The original 249-file v2 package and the 272-file timing-only recovery package
remain byte-for-byte unchanged.

Independent comparison remains unfinished. A later readiness check and paired
batch must use a new bounded declaration; this failed cohort is never appended
to, relabeled as graded or pooled into later quality rates.
