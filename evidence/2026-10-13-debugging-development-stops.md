# Debugging Skill development stops and recorded costs

**Three development cohorts stopped before completion. They provide no stable
improvement claim and cannot authorize a Skill upgrade.** Their retained failures,
successful excluded partners, readiness checks and available costs are reproducible.
No independent validation call belongs to these cohorts.

## Inputs and bounded procedure

The baseline is the complete MIT-licensed Matt Pocock
[`diagnosing-bugs`](https://github.com/mattpocock/skills/blob/d81f3a183412e71a5b1e84ca21bc1a35eea03a60/skills/engineering/diagnosing-bugs/SKILL.md).
The candidate is the unchanged [compact v2](inputs/diagnosing-bugs-compact-v2/SKILL.md).
The four [minipass historical defects](../benches/contrib/oss-minipass/README.md)
are development cases. Fixtures, public contracts, protected assets, outcome
checks and maintainer oracles were frozen before execution. Complete Skill
resources were installed in both arms with identical task prompts.

| Cohort | Versions / order | Planned / actual benchmark CLI executions | Graded pairs | Stop |
|---|---|---:|---:|---|
| 2 | Original / v2, baseline first | 8 / 4 | 1 | Provider 503 followed by selected model at capacity |
| 4 | Original / v2, balanced adjacent pairs | 8 / 5 | 2 | Original pipeline execution timed out |
| 5 | v2 / v3, balanced, pipeline first | 8 / 1 | 0 | v2 pipeline execution timed out; v3 never called |

Each cohort has its own predeclared call ceiling, fingerprints, request, native
plan and ledger. None was resumed, supplied replacement samples or pooled into
another cohort. Two preparation failures made zero model calls and are retained.
Two successful readiness executions count as spending outside task outcomes.

The configured model is `gpt-6.1-sol`, reasoning `xhigh`, service tier `default`,
Codex CLI `0.162.0-alpha.17.2`, Node `v24.21.0`. The served model and sampling
controls are unattested. Inherited global configuration is not isolated.
Each invocation had a 600-second agent deadline; a temporary verified macOS
sleep assertion remained alive and was released after its batch.

## Outcomes and timing

The surviving paired tasks tie at full correctness. The one pair in cohort 2
reduces uncached input 35.4%; the two pairs in cohort 4 increase it 30.8%.
These small, stopped samples cannot establish stable savings, equivalence or
quality improvement. A successful partner excluded after an executor error
remains in all-invocation spending.

The two pipeline deadlines were real: executor intervals were 600.027 and
600.018 seconds. Maximum observed heartbeat gaps were approximately 1.100 and
1.003 seconds; maximum wall/monotonic skew was approximately 89.918 and 1.675
milliseconds. Both recorded no timing anomaly. Increasing the deadline in a
later fresh batch does not replace these observations.

Offline inspection of incomplete timed-out deliveries found a public
write-return behavior still missing. This diagnostic does not turn a timeout
into a graded task or change its original excluded status. Hidden verifier
assertions and maintainer fixes were not weakened to obtain a positive result.

## Spending, including failures

Across the three cohorts and readiness, there were **12 agent CLI executions**:
10 benchmark executions and two readiness executions. This counts CLI processes,
not provider-internal HTTP requests. Original native receipts record the following
lower bounds; three failed executions have no final token receipt.

| Metric | Original receipts | With separate partial-session supplement |
|---|---:|---:|
| Input tokens, including cached input | 1,850,417 | **2,632,108** |
| Cached input | 1,630,848 | 2,343,936 |
| Uncached input | 219,569 | **288,172** |
| Output tokens | 43,625 | **71,128** |
| Recorded executor seconds | 3265.534 | 3265.534 |

The supplement matches each failed CLI's public thread ID, original workdir and
time interval to its latest local cumulative numeric counter. The same reader
matched eight successful executions exactly against their final public counters.
The published sidecar contains numeric metadata and source record hashes; private
session bodies are excluded. Offline replay verifies the saved sidecar, public
identities, interval consistency and arithmetic. It cannot independently attest
the undistributed private source.

Original failed receipts remain unchanged. Supplemental counters are **partial
lower bounds**, not final usage or complete billing. Reasoning output is already
included in output tokens. Pending requests, provider retries, candidate authoring,
orchestration and offline work are not fully metered; no dollar price or complete
optimization bill is inferred.

## Reproduction and evidence boundaries

The [public artifact package](artifacts/2026-10-13-debugging-development-stops/README.md)
contains the archived deliveries, full installed Skills, public transcripts,
receipts, plans, ledgers, timing diagnostics, separate partial counters, frozen
source/compiled replay code and both exact development bench arrangements.
Its README gives dependency-free offline commands.

All three original local copies passed native evidence audit. Public paths are
normalized and private reasoning excluded, so the exported package is explicitly
a derived copy. Its original/export hashes preserve that distinction; it does
not claim an unchanged original native seal or adoption eligibility.

Fresh archive extraction reproduced all **seven completed deliveries** with exact
exit codes, scores and named checks, plus every cohort's paired and all-invocation
costs and the supplemental lower bounds. This made zero model calls. The frozen
standalone statistical, efficiency and timing checks passed **23/23**. The full
source checkout passed **491/491** at the replay snapshot; the later partial-usage
feature passed **497/497** and separately replays the earlier native evidence.

Future live comparisons require a fresh bounded request and preview, immutable
inputs, an explicit deadline and existing spending authorization. The current
[Agent component](../docs/eval-component.md) freezes these settings and refuses
automatic upgrades. Fresh model calls reproduce the method, not identical
stochastic outputs, cache behavior or latency. Stable improvement still requires
a completed independent task set under its predeclared quality or efficiency policy.
