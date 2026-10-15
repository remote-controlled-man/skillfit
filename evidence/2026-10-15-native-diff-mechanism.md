# Native diff mechanism: four authorized development calls

Published October 15, 2026. Exactly four real calls completed; no expansion,
retry, readiness, generator or judge call was made. Original and compact v4
both pass 2/2, with no observed check regression or quality gain. V4 uses less
uncached input, output and time in both pairs. Agents actually use the common
native diff helper in 4/4 runs, displaying five nonempty new-file patches.

This is a favorable development signal on one reused task. It cannot establish
stable Skill improvement, fresh independent validation or the helper's causal
net savings. Component acceptance remains `inconclusive`, eligibility is false,
and automatic upgrade is false. No independent comparison has started.

## Fixed scope and execution

The [predeclared proposal](../docs/plans/2026-10-15-native-diff-mechanism.md)
was prepared without live calls. A later direct user instruction authorized at
most four calls under that plan and prohibited automatic expansion. The archive
retains the original protocol, concrete request, preview, authorization summary,
entrypoint, receipt guard, native records and the separate adoption assessment.

| Item | Recorded value |
| --- | --- |
| Task | `duration-large-digits`, the reused HumanizeDuration scientific-notation defect |
| Upstream fix | [e44e0a9d2803cd85506067fa5a6a22e4cd660a02](https://github.com/EvanHahn/HumanizeDuration.js/commit/e44e0a9d2803cd85506067fa5a6a22e4cd660a02) |
| Arms | Complete published original `diagnosing-bugs` / unchanged compact v4; not the rejected reading draft or its narrowed successor |
| Order | Original → v4, then v4 → original; adjacent pairs, same task and six outcome checks |
| Environment | Identical native helper, guidance, fixtures, inherited agent configuration and 1,200-second deadline in both arms |
| Purpose / limit | `development`, two pairs, maximum four invocations; four started and finished |
| Source commit | `9b613521c47c46f014147421a13f43e98b1b0718` |
| Node / agent CLI | `v24.21.0` / `codex-cli 0.162.0-alpha.17.2` |
| Configured settings | `gpt-6.1-sol`, `xhigh`, service tier `default`; served model identity is unattested |

The full bench assets remain byte-pinned; only this one task is scheduled.
No global Skill installation, agent configuration, runtime implementation or
adoption threshold was changed. The builtin executor was used unchanged. A
synchronous guard before each trial checked frozen inputs, AC supply, owned sleep
assertions, and the previous call's final usage, thread binding and timing.
Two offline guard checks passed before execution. Four final usage records are
present; there was no executor failure, timeout or timing anomaly. Maximum
recorded observation gap was 1,010 ms and clock skew 0.7 ms. Owned sleep
assertions were released after the run.

All four calls retain the same nonfatal CLI startup item, typed `error`:
`Under-development features enabled: local_thread_store_compression.` It warns
that the inherited experimental feature may behave unpredictably. Each call
still has a completed turn, CLI exit 0 and final usage. No warning was hidden
and no configuration was changed. This common inherited setting and the lack
of served-model attestation limit generalization.

## Correctness and regressions

Both arms pass every check in both trials, score 1 each:

- Supplied assets remain unchanged and ordinary smoke tests pass.
- Scientific notation retains exponent separators with custom replacement digits.
- Small scientific notation retains the exponent minus sign.
- Default localized digits retain scientific-notation characters.
- Decimal separators and ordinary digit replacement remain intact.
- A retained regression passes the submission and upstream fix, and fails the original.

Observed pass-rate and score deltas are zero; improved and regressed pairs are
both zero. No visible regression on these checks means no regression was found
in these four deliveries, not a guarantee outside this task.

## Every call and its complete recorded usage

Input includes cached input. Uncached input is input minus cached input; do not
add all three columns together. These are final public CLI usage counters, not
provider billing attestations. Elapsed seconds are measured executor durations.

| Execution order | Input | Cached input | Uncached input | Output | Seconds | Outcome |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1 — Original, pair 1 | 410,277 | 377,088 | 33,189 | 6,452 | 156.995 | Pass, 6/6 |
| 2 — V4, pair 1 | 212,245 | 188,032 | 24,213 | 5,417 | 135.625 | Pass, 6/6 |
| 3 — V4, pair 2 | 254,225 | 223,360 | 30,865 | 5,240 | 126.933 | Pass, 6/6 |
| 4 — Original, pair 2 | 281,641 | 238,592 | 43,049 | 6,475 | 155.264 | Pass, 6/6 |
| Whole batch | 1,158,388 | 1,027,072 | 131,316 | 23,584 | 574.817 | 4/4 |

| Cost measure | Original total | V4 total | V4 change | Pair 1 change | Pair 2 change |
| --- | ---: | ---: | ---: | ---: | ---: |
| Input | 691,918 | 466,470 | −32.58% | −48.27% | −9.73% |
| Cached input | 615,680 | 411,392 | −33.18% | −50.14% | −6.38% |
| Uncached input | 76,238 | 55,078 | −27.76% | −27.05% | −28.30% |
| Output | 12,927 | 10,657 | −17.56% | −16.04% | −19.07% |
| Seconds | 312.259 | 262.558 | −15.92% | −13.61% | −18.25% |

Both arms have two successes, so aggregate and per-success percentage changes
are identical. All five cost measures decrease in each pair; no paired cost
increase is omitted. The four-call controller wall time was 576.896 seconds and
includes executor time; those scopes must not be added. Full preparation,
authoring and orchestration usage, hidden provider retries and monetary billing
are unknown. Documentation and offline replay add zero experiment model calls.

## Mechanism and additional context costs

Each run directly executes
`node _skillfit/native-diff.cjs digit-replacements.test.mjs` on its new regression
file. The trace records `?? digit-replacements.test.mjs`, a new-file diff and hunk,
and expected exit 1. No index mutation was observed. Original pair 1 executes
the helper twice; the other runs execute it once each. All five patch displays
are nonempty, with no suspicious empty `--no-index` patch display. Legitimate
empty `--check` output is not counted as a missing patch.

| Trace measure | Original | V4 |
| --- | ---: | ---: |
| Runs with observed helper execution | 2/2 | 2/2 |
| Helper executions | 3 | 2 |
| Helper patch output bytes | 12,022 | 7,746 |
| All shell command executions | 43 | 43 |
| All recorded command output bytes | 124,770 | 93,409 |

The common guidance is 340 bytes and helper source 1,032 bytes, identical in
both arms. V4 pair 1 also reads the helper source inside a compound documentation
read whose total output is 8,391 bytes; that read is not another execution, and
its helper-only output is not separately attributable. Bytes are not tokens.
Whole-call usage above includes prompts, command responses and later context;
these byte counts must not be converted into exact token savings or added to
the final counters.

The helper is present in both arms, and both arms execute 43 shell commands.
This establishes actual use under the repaired environment and favorable
old/new Skill costs. It does not isolate helper-on/helper-off savings, prove
that fewer commands caused the reduction, or turn historical recovery-response
costs into avoidable net costs. Historical broken-environment outcomes are not
used as randomized controls.

## Adoption decision and next gate

The unchanged schema-2 efficiency policy requires at least eight independently
declared tasks with five pairs each, conservative uncached-input savings of at
least 10%, sufficiently broad task improvement, no input/cache/uncached/output
per-success increase, and at most 25% elapsed-time increase, together with all
correctness and evidence gates. This probe has one reused development task and
two pairs. The returned reasons are `INSUFFICIENT_SCALE` and
`VALIDATION_NOT_DECLARED`; acceptance is `inconclusive`, eligibility false and
automatic upgrade false. A one-task resampling interval cannot establish stable
cross-task improvement.

Actual helper adoption and favorable costs justify reviewing whether to fund
an independent comparison. That review must freeze the candidate, select unused
tasks and define a fresh spending envelope before execution. This report does
not schedule that work, approve another call or promote a Skill. The four-call
allowance is exhausted, and no independent cohort has started.

## Cumulative spending and retained failures

The previous 178 actual executor invocations plus these four make **182**.
Seven earlier missing public final usages remain unknown. Earlier stopped,
failed, expensive and rejected work stays in the ledger, and historical quality
results are not pooled with this probe.

| Scope | Input | Cached input | Uncached input | Output | Seconds |
| --- | ---: | ---: | ---: | ---: | ---: |
| Native known lower bound, all cohorts | 47,641,125 | 41,663,232 | 5,977,893 | 1,399,952 | 49,519.719 |
| Separate older unattested readiness supplement | 16,477 | 13,184 | 3,293 | 5 | 0 additional |
| Including that qualified supplement | 47,657,602 | 41,676,416 | 5,981,186 | 1,399,957 | 49,519.719 |

The supplement is not native final usage; its elapsed time was already counted.
Neither row is a complete provider bill. The archive retains the prior ledger
and reproduces the addition without rewriting earlier published evidence.

## Reproduce without a model

The [portable artifact and instructions](artifacts/2026-10-15-native-diff-mechanism/README.md)
pin an 830,563-byte archive, SHA-256
`0662db8ba95ab7a440098a10a48d6ba95a7cf900ee98cc7733aab2d3192c201f`.
A fresh extraction with Node 24.21.0 regrades all four delivered workspaces,
validates 394 indexed files and reproduces final usage, pair arithmetic, helper
counts, startup warnings, cumulative ledger and the unchanged acceptance result.
It uses the frozen compiled runner, no install, network, agent CLI or model call.

The original sealed run was audited and regraded before export, then retained
byte-for-byte privately. The public archive is an explicitly normalized
derivative: private path prefixes use equal-byte-length placeholders, private
global inventory names are omitted, and no hidden reasoning or credential is
exported. Original/export hashes and the native-audit attestation are retained.
The public package index verifies exported bytes; it is not an unchanged native
seal or independent provider attestation. It reproduces the recorded outcomes
and costs, not deterministic future model behavior.

| Pin | SHA-256 |
| --- | --- |
| Compiled runtime | `cd7353afec57d12f12258ccd70972d24481a5cbb80058f01588c98be120f98f5` |
| Original complete Skill | `3cf6b2fea38acbdebfbaca564f7a2f10cd7d12dfcad0442756a6842db96eccc1` |
| V4 complete Skill | `db5e96d06d52f3c1fbfe4a10b12c999c6191dc6a42f889e074931730ff6eafa9` |
| Prepared bench | `76a85bbaeec20413cd6b4b084c4f5192ee53b0b106838859b8e8b728a9c78860` |
| Native helper | `231e245a827bfa0bbf6b0e486d8697fb7becd7b42f24a3d585321055eb7eccb7` |
| Efficiency policy | `e6c0610daccd82f4fa326fb2660ae9f6dc722e1544f1caa006b4143de3da4a5e` |
| Approved preview | `ec568cc339215e02be4b948c908cd3a9ac3afd503d1dca665e567c8359329dba` |

For a future fresh experiment, use the preparation instructions at source commit
`9b613521c47c46f014147421a13f43e98b1b0718` and a new output directory. That
procedure requires a fresh budget and preview; this completed authorization
cannot be reused. This report and archive follow npm 0.9.1 and are not claimed
to be included in that immutable package.
