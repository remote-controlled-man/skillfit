---
name: diagnosing-bugs
description: Diagnosis loop for hard bugs and performance regressions. Use when the user says "diagnose"/"debug this", or reports something broken/throwing/failing/slow.
---

# Diagnosing Bugs

Turn an observed failure into a reproducible signal, a minimal repair, and a
regression that exercises the real public behavior. Choose the amount of
diagnostic work from the remaining uncertainty.

## Establish the signal

Read repository guidance, the relevant caller/implementation and existing test
commands. Consult GLOSSARY.md and nearby ADRs when they exist. Use the user's
reported behavior to define correctness; an incidental nearby failure is not the
same bug.

Build and run one local, red-capable feedback loop at a seam that reaches the
reported failure. Prefer an executable regression or a minimal replay over
instrumentation that merely reports activity. It should assert the symptom and
preserve existing public behavior. Capture the failing observation before
changing production code. Redact credentials in commands, outputs and artifacts.

For a deterministic bug with an accessible seam, read enough code to choose that
seam and test the strongest evidence-backed explanation. A fixed number of
hypotheses or a separate written checkpoint is unnecessary once the failing
signal localizes the cause. If competing explanations remain, rank them, state
their falsifiable predictions, and test one variable at a time. Expand the
investigation when evidence contradicts the current explanation.

For intermittent failures, prefer controlled inputs, scheduling and observable
events over arbitrary sleeps. Measure reproduction rate and pin relevant state.
For performance defects, measure the reported workload before changing code.
Minimize the reproducer only while preserving the original failure and any
load-bearing caller relationships.

If the environment cannot produce a meaningful signal, report the attempts and
the specific missing access or artifact. Request only what is needed to proceed;
do not turn an untested hypothesis into a claimed diagnosis. Use the bundled
human-feedback template only when a human action is actually required.

## Repair and check

Keep the red-capable reproducer as a regression when a reliable seam exists.
Exercise the real call pattern, including multiple callers or interaction
boundaries when those cause the failure. A passing assertion on a shallow proxy
does not establish that the bug is fixed.

At a shared stateful boundary, distinguish the application state from internal
wrappers or transient bookkeeping. Check the public meaning of callbacks,
events and status values, not only whether the main operation completes. Use a
small scenario matrix for the relevant transitions: no prior application value,
the same value, and a different value. Include cancellation or repeated calls
when the changed boundary reaches them. Assert the observable value and event
reason against that application history; suppressing an internal event alone
does not establish that the remaining event is correct.

Make the smallest repair justified by the observation. Run the regression again,
then replay the original scenario and the relevant existing tests. Keep accepted
alternative behavior intact. Broaden verification when the changed boundary or
new evidence warrants it, rather than repeating already-green checks without a
reason. When no reliable regression seam exists, state that limitation and the
verification actually performed.

Use temporary probes only to distinguish concrete predictions. Tag their output,
remove temporary instrumentation and unrelated prototypes, and inspect the final
diff for scope and remaining failure paths. Preserve supplied test assets and
repository requirements. Do not change a grader to make the repair pass.

Report the observed cause, repair, commands actually run and their results, and
material limitations. A planned check is not executed evidence. Keep commits,
publishing, deployment and external changes within the user's authorization.
