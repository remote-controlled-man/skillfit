# Receiver mechanism probe: candidate failed, stopped after one call

The user authorized the [frozen two-call development proposal](../docs/plans/2026-10-15-receiver-mechanism-proposal.md).
The v4.1 candidate failed the first functional gate, so the controller stopped
after **one actual invocation**. The v4 control was never started. There was no
retry, replacement, readiness call, judge, expansion or upgrade.

The candidate read the complete revised Skill, but delivered **exactly the same
incorrect production source bytes** as the historical v4 delivery: both timer
functions are forced to the caller's `globalThis`. Its tests are more permissive
than the earlier v4 tests, but still cannot distinguish this wrong repair from
the maintainer's compatible repair. This probe does not support advancing v4.1.

All old evidence and both Skill versions remain unchanged. The study ledger is
now **195 actual executor calls**; seven earlier unknown public final usage
records remain unknown. This call has complete final usage and valid timing.

## Frozen execution and actual stop

- One reused `sindresorhus/p-timeout` defect, `timeout-custom-timers`.
- v4.1 first, v4 only after all functional, reserve and mechanism gates passed.
  Native conditions were `treatment` then `baseline`; only `treatment` ran.
- Complete candidate input SHA-256:
  `c369765671e8cd0ae88af9d34f160c0b5cb48bfb49eef933f6f52812673d8952`.
- Runtime SHA-256:
  `1be33d57c3b19896eae2ba0fd68724fddda1aeff12efe0c44e22b11a74646e0e`.
- Requested settings: `gpt-6.1-sol`, `xhigh`, `default`;
  `codex-cli 0.162.0-alpha.17.2`, Node `v24.21.0`. Actual served model identity
  remains unattested. Inherited configuration and unlisted tool/plugin state
  are not claimed to be fully isolated.
- Both proposed calls had a 600-second executor deadline. Absolute stop lines
  were 600,000 input, 500,000 cached input, 100,000 uncached input, 20,000 output
  and 1,200 summed executor seconds. The first-call reserve gates were half
  those amounts. Token lines apply between calls, not as provider hard caps.

Before launching, 24 injected-execution controller tests passed. They covered
the candidate-first order, two-call ceiling, single-use refusal, candidate and
extra-probe failures, missing mechanism evidence, all five reserve equalities,
usage/routing/timing/deadline failures and setup/input guards. The reduced bench
also reproduced original failure at 3/6 and maintainer success at 6/6 offline.

The actual stop reason was **`CANDIDATE_FUNCTIONAL_FAILURE`**, not budget,
timeout, routing, usage or timing trouble. The candidate completed in 188.158
seconds with a maximum execution observation gap of 1,004 ms, maximum clock
skew of 29.778 ms and no recorded timing anomaly. Power observations recorded
no anomaly; owned sleep assertions were released. The native session records
one call started and one finished, out of a two-call maximum.

## What passed and failed

| Original six-check verifier | Result |
| --- | --- |
| Protected assets and ordinary smoke | Pass |
| Custom scheduling receiver | **Fail** |
| Custom clearing receiver | **Fail** |
| Timeout and fallback behavior | Pass |
| Ordinary fulfillment/rejection identity | Pass |
| Submitted regression distinguishes original and accepts maintainer repair | Pass |

The result is **4/6**, with the two central receiver behaviors still failing.
The separately frozen receiver probes return **8/18**: all ten strict/foreign-
context integration checks fail; the three direct-call controls and five
prebound-owner integration checks pass. These are correlated checks on one
development task, not eighteen independent tasks.

The production `index.js` SHA-256 is
`dfab3e342fa631c840eea2322c8da22690c973423202b597c2fdfa7934a08335`,
identical to the [retained wrong v4 delivery](2026-10-15-independent-comparison-regression-stop.md).
The old v4 score was 3/6; the changed regression now accepts the maintainer
repair, which explains this extra passing group without a production repair.
This historical comparison is not a new paired effect or evidence of a
stable improvement.

## Public evidence of the mechanism

The successful command `item_2` returned all 3,074 bytes of `SKILL.md`, exactly
matching the delivered candidate text, including the added receiver paragraph.
This is stronger evidence than file placement or an agent's claim of use.

The new `receiverChecked` fake explicitly accepts both `undefined` and current
`globalThis`, then calls the wrapped timer using `Reflect.apply(timer,
globalThis, args)`. A direct fixture-control test verifies those self-defined
rules; another test preserves an explicitly bound owner. The pre-edit red test
is recorded in `item_13`, green results in `item_15`, and the new regression
diff in `item_17`. These observations document partial changes in the test
approach, but the fake still cannot disprove the forced `globalThis` choice.

A post-stop offline diagnostic runs the **same newly submitted seven tests**
against four source variants:

| Source under the new generated regression | Passing tests |
| --- | ---: |
| Original buggy source | 2/7 |
| Historical wrong v4 source | **7/7** |
| New v4.1 delivery | **7/7** |
| Maintainer repair | **7/7** |

The regression is a valid witness against the original container call, but it
does not discriminate between the wrong global receiver and the maintainer's
repair. No private reasoning was requested or analyzed. The post-stop audit
records `skillRead: observed`, `mechanism: not-observed`; it cannot reopen the
closed cohort or authorize the unused control slot.

One stochastic failure cannot prove that the new sentence caused these test
changes, or that it will always fail. It does establish that the narrow edit
did not prevent this known production failure in the authorized probe.

## Complete measured spending

| Metric | Actual failed candidate | Batch stop line |
| --- | ---: | ---: |
| Total input tokens | 205,272 | 600,000 |
| Cached input, included above | 182,144 | 500,000 |
| Uncached input, included above | **23,128** | 100,000 |
| Output tokens | **6,182** | 20,000 |
| Executor duration | **188.158 seconds** | 1,200 seconds |

All values were below both the first-call admission lines and batch stop
lines; there was no overshoot. The control incurred no executor spending
because it was not invoked. There is no within-batch paired cost change to
calculate. Native and expanded-functional success counts are both zero, so
every per-success cost is `null`, not zero or a fabricated saving.

These counters include the actual failed invocation's input, caching, output
and execution time. Offline preparation, grading and replay made no model
calls. Provider billing, hidden retries and complete conversational authoring
or orchestration costs are not measured. The seven historical unknown usage
records are not filled with zero.

## Reproduction, preservation and disposition

The [reproduction package](artifacts/2026-10-15-receiver-mechanism-stop/README.md)
contains the frozen runtime/source, both Skills, reduced bench and reference,
controller and its 24 offline tests, actual delivery and public transcript,
native call/budget/session records, final usage, receiver probes and regression
diagnostic. A fresh extraction reproduced 4/6, 8/18, the identical wrong code,
all spending and stop lines, and the single-call ledger without calling a model.

Private path prefixes are normalized; private global configuration paths and
Skill inventory names are omitted. Source/export hashes identify a derivative
archive. It does not impersonate unchanged native seals, a completed two-arm
experiment or a complete native eval-component adoption audit. The original
private native seal is retained and verified separately.

Project verification passed: **556 tests**, zero failures or skips. Preservation
checks verified all **2,580** previously tracked source, bench, documentation
and evidence files unchanged. See [checks.json](artifacts/2026-10-15-receiver-mechanism-stop/checks.json).
Only indexed disposable extraction/export copies are eligible for cleanup after
their backing archives are verified; original failures, native receipts and
frozen reproduction inputs are retained.

Disposition: keep v4.1 as a failed development candidate, with **no upgrade**.
The current cohort is closed. There is no authorization for a replacement,
the unused control slot, another Skill revision or independent expansion.
