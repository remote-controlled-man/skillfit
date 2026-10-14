# Rejected reading pilot and post-hoc cost review

The four-call reading-scope development pilot passes its behavior checks but
**increases uncached input 34.35%, output 10.16% and elapsed time 13.60%**. The
v5-reading candidate is **rejected and ineligible**. The subsequent narrowed
v5.1 draft restores batching guidance but has no live behavior or performance
validation. Neither candidate is installed or promoted.

This entry follows the [174-call spending stop](2026-10-14-debugging-spending-stop.md)
without rewriting it. The user subsequently authorized at most four development
calls; exactly four completed, bringing cumulative executor spending to **178**.
No new model, readiness, generator, judge or retry calls were made for the
offline analysis, environment repair or this publication. Separate cohorts
remain separate; their correctness samples are never pooled for adoption.

## Frozen development design and results

The pilot uses one already-observed real repository defect:
`humanize-duration` scientific notation and custom digit replacement. Two
adjacent pairs balance order: v4 → draft, then draft → v4. Both arms receive the
same task and 1,200-second deadline, and both contain the full four-resource
Skill. The declared acceptance policy remains eight tasks × five pairs,
at least 10% uncached-input reduction at the conservative task-bootstrap bound,
and the recorded per-metric cost ceilings. Development on one task cannot
satisfy independent validation or scale requirements.

Recorded settings: Node v24.21.0, Codex CLI 0.162.0-alpha.17.2, requested
`gpt-6.1-sol` / `xhigh` / default service tier. The served model is unattested;
inherited configuration was unchanged but not isolated. The compiled runtime
SHA-256 is `da640a88b07b7daa6621c0e17007b4c929927e7c10801d6fc3dfdb40b7f27509`;
the bench SHA-256 is `99fa56d42eff697865a2b06ac3563d7f3a3adbe2687bc0581f9d3e4c63d5590e`.
The execution declaration pins complete input and policy hashes in the archive.

Both versions pass 2/2 deliveries and all six checks per delivery. There are
no execution failures, timeouts or recorded timing anomalies. All four native
final usages are present. AC power and owned sleep assertions were checked and
the assertions were released after execution.

| All-invocation metric | v4, two calls | v5-reading, two calls | Change |
| --- | ---: | ---: | ---: |
| Input | 399,034 | 462,192 | +15.83% |
| Cached input | 353,792 | 401,408 | +13.46% |
| Uncached input | 45,242 | 60,784 | +34.35% |
| Output | 9,115 | 10,041 | +10.16% |
| Executor seconds | 298.322 | 338.879 | +13.60% |

Uncached input rises **35.49% and 33.24%** in the individual pairs. Batch
totals are 861,226 input (755,200 cached and 106,026 uncached), 19,156 output
and 637.201 summed invocation seconds. Cached and uncached input partition
input; they are not added a second time. The unchanged component decision is
`reject`, `eligibleForUpgrade=false`, `automaticUpgrade=false`.

## What became more expensive

Neither arm requests the whole `index.js`. Exact source bytes returned by the
explicit recorded source ranges fall from 37,744 to 34,691 (−8.09%), but all
command-output bytes rise from 83,714 to 90,974, and commands rise from 25 to 35.
Bytes are not tokens; the smaller source-range subset is not a net saving.
The baseline already reads bounded ranges, so this task provides no contrast
between whole-file and bounded reading.

The first pair has eight → ten observed response segments: one additional
regression response and one closing response, including recovery from empty
filtered diff output. The second pair stays at seven → seven response segments
and twelve → twelve commands. Its input falls 4,582 but cached input falls
12,160, so uncached input rises 7,578. One response after source discovery
accounts for 7,219 of that increase (95.26%). This is an exact accounting
decomposition; it does not diagnose provider cache behavior or prove that a
particular instruction caused the difference.

Post-hoc grouping of the extra 15,542 uncached tokens locates −18 in orientation,
+109 in discovery, +8,252 in reproduction, +4,179 in regression and +3,020 in
repair/closing responses. Inputs include prior accumulated context, so these
are response groupings rather than causal costs of the generated actions.
The additional 926 output tokens comprise +1,187 reasoning-output tokens and
−261 other-output tokens; reasoning is a numerical component of output, not
an additional charge. No hidden reasoning text is included in the review.

The original v5 draft also removed v4's `together where practical` reminder;
this makes it a mixed intervention. The archived v5.1 draft restores the
complete v4 bundle and adds only this sentence:

> For large files, search relevant symbols and read bounded context; expand when evidence requires it.

Removing that sentence restores v4's `SKILL.md` byte-for-byte. The other three
resources are unchanged. Structural validity is not performance evidence;
v5.1 remains an uninstalled, unvalidated draft.

## Correction: empty diff output

The earlier broad local scan counted 50 of 126 completed traces with an
exit-1, empty filtered `git diff --no-index` result. **Only 19 are missing
patch displays; the other 31 contain check-only results that can correctly
be empty.** All 19 patch cases subsequently obtain a raw diff. The broad
historical record is retained; this entry corrects its interpretation.

Direct child-process controls with installed RTK 0.51.0 show a new-file patch
(188 bytes) and a modified-file patch (130 bytes) disappearing from filtered
stdout while native Git and raw passthrough retain the complete patch and
exit 1. Clean `--check` output is correctly empty; whitespace diagnostics and
missing-file stderr are retained. The observed loss happens before Skillfit
or Codex transcript recording. These controls establish the installed binary's
behavior, not an internal RTK source-code diagnosis.

Numeric local-session supplements, matched locally by thread identity, working
directory and public final usage, place 12 recoveries in dedicated later
responses and seven in responses that also do other work. Dedicated recovery
responses have observed uncached input 16,759 (0.843% of the 1,987,001 uncached
tokens in those completed v4 records). All 19 recovery responses together
have 41,675 uncached input tokens. **Neither amount is proven avoidable net
spending**: earlier patch delivery changes later context, cache reuse and model
behavior, and mixed responses cannot be removed wholesale.

The [merged common environment repair](https://github.com/remote-controlled-man/skillfit/pull/14)
supplies a pinned native untracked-file diff helper to both arms of new paired
installed evaluations. Offline tests preserve patch output, native exit status
and errors, enforce helper integrity, and reject fixture collisions before
calls. It leaves global RTK configuration unchanged. Actual Agent adoption and
net savings remain untested. This environment repair is not a Skill upgrade
or new independent quality evidence.

## Broader numeric review, without pooling

The three completed populations have numeric response sums aligned with their
public final usage. A descriptive cache-drop event means cached tokens fall
by at least 4,096 while input does not shrink. This post-hoc definition changes
no acceptance threshold and identifies no provider-side cause.

| Separate population | Calls / pairs | More candidate responses | Fewer candidate responses | Higher uncached input despite no more input | Runs / events with cache drop |
| --- | ---: | ---: | ---: | ---: | ---: |
| Completed independent validation | 80 / 40 | 3 | 30 | 13 | 37 / 44 |
| Routing-stopped completed prefix | 46 / 23 | 4 | 15 | 3 | 12 / 13 |
| Reading development pilot | 4 / 2 | 1 | 0 | 1 | 1 / 1 |

V4 often reduces workflow responses, but cache partition differences can
offset recorded uncached-input savings. Shorter text or fewer tool commands
does not by itself demonstrate stable improvement. The completed independent
result still remains ineligible at its unchanged conservative 10% bound.

## Cumulative cost coverage

| Measure | Native known lower bound, 178 calls | Separate unattested readiness supplement | With that qualified supplement |
| --- | ---: | ---: | ---: |
| Input | 46,482,737 | 16,477 | 46,499,214 |
| Cached input | 40,636,160 | 13,184 | 40,649,344 |
| Uncached input | 5,846,577 | 3,293 | 5,849,870 |
| Output | 1,376,368 | 5 | 1,376,373 |
| Executor seconds | 48,944.902 | Already counted | 48,944.902 |

Seven earlier public final usages remain missing, including partial records;
unknown costs are never zero. The readiness supplement lacks public identity
attestation and does not replace the unknown native receipt. Provider billing,
provider-internal requests and complete authoring/orchestration spending remain
unknown. This lower-bound ledger is not a complete bill.

## Reproduce and remaining work

The [portable archive](artifacts/2026-10-14-debugging-reading-pilot-and-cost-review/README.md)
pins 390 files. Fresh extraction regrades all four submitted workspaces and
reproduces exact quality, costs and acceptance using the frozen runtime. It
also recomputes the 126-trace correction, 130 numeric-final alignments,
response classifications, phase arithmetic, separate cohort summaries, complete
Skill hashes and cumulative cost addition, without a model, agent CLI,
dependency installation or network access. All 1,573 earlier published
evidence files remain byte-identical.

Public metadata paths are normalized. The original native records were audited
before export; the derived package does not assert an unchanged native seal.
Private local-session bodies are omitted: their original identity matching
cannot be independently re-attested from the public numeric supplements alone.
Recorded RTK controls can be checked offline as observations; repeating that
binary behavior needs the pinned RTK/Git environment. Offline replay cannot
guarantee identical behavior in a fresh stochastic model run.

The [ordered delivery plan](../docs/plans/2026-10-14-evidence-and-release-sequence.md)
puts evidence publication and release preparation before another spending
proposal. Live use of the common helper, its added prompt/tool costs and net
savings still need a separately authorized development design. Stable Skill
improvement remains unproven; no new call budget, automatic expansion or
promotion is implied by this publication.
