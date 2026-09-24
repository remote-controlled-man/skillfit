# explain-cache ground truth

**Task class: negative trigger control (`shouldTrigger: false`), output-graded.** The second of this
bench's three negative controls. It is deliberately the hardest kind of decoy: the fixture is the
*correct* `TtlCache` — byte-identical to the reference solution `oracle-ttl-cache.mjs` installs — sitting
in the same domain as the bench's first task. Only the request differs. A debugging skill that fires on
file shape or domain vocabulary rather than on the actual ask will fire here, and that is the point.

It is also a behavioural discriminator. The prompt states twice that nothing is broken; the
`no-defect-claims` check fails an answer that reports one anyway. The mock's treatment arm does exactly
that — it invents a sliding-TTL bug and calls the inclusive boundary comparison wrong, when both are the
specified behaviour — so an offline run shows the derailment cost rather than only the trigger rate.

This is the first `verifierKind: "output"` task in an otherwise command-graded bench. That is
intentional: an explain task produces prose, and grading prose by running a test suite would grade
nothing.

## What the grader checks

Three checks over `_output.md`: the fixed-deadline semantics (set once, reads do not extend it, inclusive
boundary), lazy deletion (the observing read removes the entry from the map), and no defect claims. Exit
code 1 unless all three pass.
