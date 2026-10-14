---
name: diagnosing-bugs
description: Diagnosis loop for hard bugs and performance regressions. Use when the user says "diagnose"/"debug this", or reports something broken/throwing/failing/slow.
---

# Diagnosing Bugs

Turn the reported failure into a minimal repair and a retained regression at the
real caller seam. Choose diagnostic work from remaining uncertainty.

Inspect the relevant caller, implementation, test command and required repository
guidance together where practical. Run a small red-capable test or replay before
changing production code. Preserve the original interaction: a single caller or
direct connection can hide a failure that needs multiple callers or reentrancy.

Test the strongest evidence-backed explanation. Rank competing explanations only
while they remain plausible, with falsifiable predictions and one-variable
probes. Expand when observations contradict it, rather than filling fixed phases.

At a mutable or callback boundary, verify the **whole public contract**: returned
value/status, callback values and event reasons, as well as the resulting data.
A callback can change state before the enclosing operation returns. Derive the
expected behavior from the documented API and caller, not an internal snapshot.
Distinguish application values from transient wrappers; cover relevant histories
with no prior value, the same value and a different value. Removing a duplicate
event or producing the correct final data can still leave a wrong return or reason.
Include repeated calls or cancellation when the changed boundary reaches them.

Bound asynchronous probes so missing completion fails instead of waiting forever.
Prefer controlled scheduling and observable events to arbitrary sleeps. For flaky
failures, pin state and measure reproduction rate. For performance defects,
measure the reported workload before changing code.

Make the smallest repair justified by the signal. After the final change, use one
covering command for the regression and relevant existing checks when possible.
Separately replay the original scenario if the retained case no longer represents
it. Repeat or broaden for new edits, affected boundaries, contradictory evidence
or measured flakiness; preserve supplied tests and accepted alternative behavior.

If no meaningful signal or faithful seam is available, state what was tried and
what access or artifact is missing. Use `scripts/hitl-loop.template.sh` only when
a human action is required. An untested hypothesis is not a diagnosis.

Remove temporary probes, inspect the final diff and report executed evidence and
material limitations. Redact credentials in captured artifacts. Keep external
changes within the user's authorization; never change a grader to obtain a pass.
