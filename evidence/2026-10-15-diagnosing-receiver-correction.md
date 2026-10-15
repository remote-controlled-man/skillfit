# Receiver correction: offline development after the v4 rejection

The rejected v4 delivery correctly identified an unwanted receiver, but replaced
it with another unverified receiver. Its own regression required the caller's
`globalThis`, so red-to-green confirmed that assumption rather than compatibility.
This entry adds a small **development-only** Skill candidate and deterministic
replay. It does not establish improved model behavior or authorize adoption.

The [published failure report](2026-10-15-independent-comparison-regression-stop.md),
v4 input, original deliveries, cost receipts and archive remain unchanged.
No new model or agent CLI invocation was made. The historical study ledger stays
at **194 actual executor calls**, including seven earlier unknown public final
usage records; those missing records remain unknown.

## What the saved execution establishes

The retained `timeout-custom-timers/treatment/trial-1` delivery is available under
`records/continuation/` in the [unchanged archive](artifacts/2026-10-15-independent-comparison-regression-stop/README.md).
Only recorded commands, delivered files and public-facing output were used for
the diagnosis.

1. The agent inspected the implementation and the documented `customTimers`
   example, which supplies saved timer functions. Property calls such as
   `customTimers.setTimeout(...)` introduce the container as the receiver.
2. It created `custom-timers.test.mjs`. Before the production edit, both fake
   timer methods already asserted `this === globalThis` (lines 12 and 19).
3. Those five tests failed against the original, then passed after both calls
   were changed to `.call(globalThis, ...)`. The saved command results confirm
   this sequence; the production diff has the two receiver substitutions.
4. The original supplied smoke test passed both before and after. It did not
   distinguish the possible receivers. The agent reported compatible timers
   without a probe that could disprove its selected receiver.

“Do not bind to this container” does not establish “bind to this caller's global
object.” The retained fake encoded that second assertion without independent
support. In the offline probes, a strict function expects an unbound receiver;
an ordinary function created in another Node VM context obtains its own default
global receiver when called unbound. Forcing the caller's global object breaks
both. These executable probes explain a compatibility difference; they are not
a claim to have reproduced a particular browser implementation.

The maintainer's saved repair and the original Skill's actual delivery use
`.call(undefined, ...)`. The manual demonstration here instead extracts the two
functions and invokes them unbound. An already bound function retains its
explicit owner in these probes. This supports preserving the supplied function's
call convention, rather than imposing one universal receiver value.

v4 already asked for falsifiable probes, a faithful caller seam and red-to-green
testing. The observed gap was validating the **test double's expected behavior**.
One trace cannot establish that compressing the Skill caused the mistake, or
that adding a sentence will prevent it on future model runs.

## Small Skill change

The new [v4.1 receiver candidate](inputs/diagnosing-bugs-compact-v4.1-receiver/SKILL.md)
copies all four v4 resources and inserts one conditional paragraph after the
hypothesis/probe paragraph:

> For receiver (`this`) failures in callbacks or injected functions, establish the
> call convention from the API and supplied function before encoding it in a test
> double. Check a plausible alternative receiver and preserve explicit bindings;
> a test double that assumes the proposed receiver is not independent evidence.

This adds **47 whitespace-delimited words / 319 UTF-8 bytes**, increasing
`SKILL.md` from 2,755 to 3,074 bytes. Frontmatter, interface metadata, license,
human-interaction template and every existing instruction remain unchanged.
It adds no fixed testing phase, task identifier, timer-specific repair, or rule
that every callback must receive `undefined`.

- Parent complete input SHA-256:
  `db5e96d06d52f3c1fbfe4a10b12c999c6191dc6a42f889e074931730ff6eafa9`
- Candidate complete input SHA-256:
  `c369765671e8cd0ae88af9d34f160c0b5cb48bfb49eef933f6f52812673d8952`

The candidate is stored as an evaluation input. It has not been installed,
promoted, substituted for v4 in the finished experiment or independently tested.
This timer case is now development material for v4.1 and cannot count as fresh
independent evidence for that candidate.

## Offline results

The [replay](artifacts/2026-10-15-diagnosing-receiver-correction/replay.mjs)
checks the unchanged archive hash and exported file fingerprints, replays all
twelve original delivery grades and costs, then operates on disposable copies.
The saved wrong regression remains intact. Its assertions are not weakened in
the old experiment or original record.

The new [receiver probes](artifacts/2026-10-15-diagnosing-receiver-correction/receiver-contract.test.mjs)
retain the five observed paths: input fulfillment, input rejection, timeout and
input cancellation, explicit clear, and abort. Each is checked with strict
unbound, foreign-context and prebound functions. Three additional controls call
the supplied functions directly, independently of `pTimeout`: 15 integration
checks plus 3 controls = 18 registered tests per source variant.

| Source variant | v4's original generated tests | Receiver probes | Unchanged verifier with corrected regression on a copy |
| --- | ---: | ---: | ---: |
| Original buggy source | 0/5 | 8/18 | 3/6 |
| Retained v4 delivery | 5/5 | 8/18 | 3/6 |
| Retained original-Skill delivery | 0/5 | 18/18 | 6/6 |
| Maintainer repair | 0/5 | 18/18 | 6/6 |
| Human-written unbound-call demonstration | 0/5 | 18/18 | 6/6 |

The original generated tests passing only the wrong delivery and rejecting the
maintainer repair expose their invalid compatibility expectation. In the new
tests, the original and v4 each fail all ten strict/foreign-context integration
checks; the three direct-call controls and five prebound integration checks pass.
Each valid repair has ten matching regression witnesses that fail the original
and pass both the submitted repair and maintainer source. No timeout, skipped
test, cancellation or lack of registration is accepted as a witness.

The original twelve-delivery replay still returns `reject`, six completed pairs,
194 historical calls and `automaticUpgrade: false`. The original scoring,
adoption policy and cost totals are unchanged. The new source comparisons above
are post-result diagnostics, not additional scored tasks or model samples.

The Skill Creator structural validator passed using the existing isolated
PyYAML 6.0.3 environment. No package or global environment change was needed.
That check validates Skill packaging, not efficacy. The project check also
passed: `npm test`, 556 tests, zero failures or skips. Preservation and validation
details are in [verification.json](artifacts/2026-10-15-diagnosing-receiver-correction/verification.json).

## Cost and evidence limits

These diagnostic runs made **zero model calls**, so they add no measured model
input, cached input or output to the experiment ledger. The added prompt text
is measured in bytes and whitespace-delimited words; its model-token and runtime
effects are unmeasured. Local replay duration is not a model latency estimate.
Conversational authoring usage and a provider invoice are not measured by this
offline harness and are not claimed to cost zero.

The previous paired result and all five recorded cost dimensions remain
reproducible through the original archive. Its seven unknown historical usage
records are not filled with zero. No saving, stable improvement, regression
rate, or future total cost can be inferred from a manually written repair.

The demonstrated result is narrower: the receiver error and misleading test
expectation are reproducible, a small candidate instruction addresses that
decision point, and a compatible repair passes the retained behavior checks.
Whether the candidate improves model decisions remains untested. Further model
calls or automatic expansion are not authorized by this work.
