# summarize-s1 ground truth

**Task class: negative trigger control (`shouldTrigger: false`).** This is the code-review bench's second
negative control. It reuses the bench's own fixture shape — `SPEC.md`, `src/`, and a `CHANGES.diff`
that genuinely contains a rounding question — because a negative control that looks nothing like the
positive tasks measures nothing. A review skill firing here is a false trigger.

It is also a behavioural discriminator, not just a label. The task asks for a changelog entry, so an
agent that starts reviewing produces the wrong artefact and fails the `not-a-review` check. That models
the derailment cost `docs/metrics.md` L3 calls `δ_derail`: a false trigger is not merely a wasted
invocation, it changes what the session produces. The mock's treatment arm deliberately slips into
review framing so an offline run shows the penalty.

## What a correct answer looks like

Three bullets, user-facing, describing the merged diff:

1. the bulk-discount threshold moved from 13 to 10 items (5% off);
2. invalid quantities now raise a stable `INVALID_QUANTITY` code instead of a bare `Error`;
3. rounding happens once per line rather than on the intermediate unit price.

## What the grader checks

Three checks: exactly three bullet lines; at least two of the three user-visible changes named; and no
review framing (no `SPEC §` citation, no "violates", "bug", "defect", or "should be"). Exit code 1
unless all three pass.
