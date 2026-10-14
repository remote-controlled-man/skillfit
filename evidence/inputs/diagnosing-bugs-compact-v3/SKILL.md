---
name: diagnosing-bugs
description: Diagnosis loop for hard bugs and performance regressions. Use when the user says "diagnose"/"debug this", or reports something broken/throwing/failing/slow.
---

# Diagnosing Bugs

Produce a minimal repair and an executable regression for the reported public
behavior. Let remaining uncertainty determine the diagnostic work.

## Find the failing seam

Inspect the relevant caller, implementation, test command and repository guidance
together where practical. Consult a glossary or nearby ADR when a term or design
decision is unclear, or repository rules require it; avoid repeatedly scanning
the same files once the seam is known.

Run a small regression or replay that asserts the user's actual symptom before
changing production code. A nearby failure or absence of an exception is not
enough. Preserve this red-capable case as a regression when a reliable seam
exists. Redact credentials in commands, output and captured artifacts.

Test the strongest explanation supported by that failure. Rank competing
explanations only while they remain plausible, with falsifiable predictions and
one-variable probes. Expand when observations contradict the explanation, not
to fill a fixed number of hypotheses or debugging phases.

For intermittent failures, pin state and measure reproduction rate using
controlled scheduling or observable events. Bound asynchronous probes so a
missing completion becomes a failure rather than an indefinite wait. For
performance defects, measure the reported workload first. Minimize only while
preserving the failure and its load-bearing caller relationships.

If no meaningful signal is available, state what was tried and the specific
missing access or artifact. Use `scripts/hitl-loop.template.sh` only when a human
action is required. An untested hypothesis is not a diagnosis.

## Repair the public behavior

Make the smallest change justified by the observation. Exercise the real call
pattern, including interacting callers when they cause the failure; a shallow
proxy can miss it. Preserve accepted alternative behavior and supplied tests.

At a shared stateful boundary, distinguish the application state from internal
wrappers. Check callback values and event reasons against application history:
no prior value, the same value and a different value. Include cancellation or
repeated calls when the changed boundary reaches them. Suppressing an internal
event alone does not establish that the remaining public event is correct.

After the final change, run the regression and relevant existing checks. Use one
covering command when it includes both; separately replay the original scenario
only if the regression no longer represents it. Repeat or broaden checks for
new edits, contradictory evidence, affected boundaries or measured flakiness.
If the real regression seam is unavailable, state that limitation.

Remove temporary probes and unrelated prototypes, then inspect the final diff
for scope and remaining failure paths. Never alter a grader to obtain a pass.

Report the observed cause, repair, executed checks and material limitations.
Keep commits, publishing and external changes within the user's authorization.
