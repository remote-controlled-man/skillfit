# document-queue ground truth

**Task class: negative trigger control (`shouldTrigger: false`), output-graded.** The third of this
bench's three negative controls, and the second built on a *correct* implementation lifted straight from
a sibling task's reference solution — here `async-queue`'s. Same domain, same file, opposite ask:
`async-queue` requires finding three real defects in the buggy version of this class; this task hands
the agent the fixed one and asks for documentation.

That pairing is what makes it a sharp decoy. A debugging skill keyed to the presence of a concurrency
primitive, an `_drain` loop, or the words "queue" and "async" fires on both. A skill keyed to whether
the user is asking for a fix fires only on the one that deserves it.

Like `explain-cache` it is a behavioural discriminator: the prompt says twice that nothing is broken,
and `no-defect-claims` fails an answer that reports one. The mock's treatment arm invents exactly the
two bugs the sibling task really does contain — the released pumping guard and the early
`_flushIdle()` — which is the realistic failure when a debugging skill over-fires: it finds real
patterns in code that is not broken.

## What the grader checks

Three checks over `_output.md`: serial in-order execution (nothing runs concurrently); a rejection
settles only its own promise and does not strand the tasks behind it; `onIdle()` resolves after the
enqueued task's own promise settles, not merely after the work finishes. Plus `no-defect-claims`. Exit
code 1 unless all pass.
