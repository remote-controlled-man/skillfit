# Debugging followup interrupted by workspace routing failure

The fixed original/v4 followup stops on its **47th executor invocation** when
Codex exits with `workspace routing discovery failed`. Forty-six completed
deliveries form 23 passing pairs with no observed pass, score or check
regression. The failed invocation is ungraded and its token usage is unknown;
33 declared deliveries remain uninvoked. This incomplete study remains
**inconclusive and ineligible**, with no automatic upgrade or stable gain claim.

The [separate frozen protocol](../docs/plans/2026-10-14-skill-followup.md) requires
eight tasks with five pairs each, final spending coverage and the unchanged
10% conservative reduction bound. Four tasks complete all five pairs, the fifth
completes three, and three tasks receive no executor call. Their missing
observations cannot be replaced by successful prefix results or by another
cohort. This stopped run is sealed without retries or appended samples.

## Observed execution failure

The failed treatment invocation on `duration-large-digits`, trial 4, runs from
2026-10-14 00:59:00.977 UTC to 01:00:52.660 UTC for 111.683 seconds. Public
events contain ten reconnection/error frames and a final `turn.failed` with
the same routing-discovery message. The CLI exits with code 1. The native
manifest records 47 started and 47 settled invocations: 46 finished and one
failed. A progress counter looking only for `finished` events therefore shows
46 rather than all 47 settled attempts.

The 1200-second executor deadline does not fire. Maximum heartbeat observation
gap is 1003.002 ms, maximum wall/monotonic skew is 0.935 ms, and the recorded
timing anomaly is null. AC power remains active, both temporary sleep
assertions are alive at finish and are released. This failure is an execution
connection problem, without an observed timeout, clock anomaly or sleep event;
it is not scored as a Skill behavior regression.

The read-only `codex login status` check reports ChatGPT authentication. That
command checks the active authentication method, as described by the
[official authentication documentation](https://learn.chatgpt.com/docs/auth),
without proving workspace routing recovery. The local CLI includes distinct
routing errors for cancellation, account changes, authorization and invalid
backend origins; this generic error does not identify which transport, account
or service condition failed. The exact cause beyond routing discovery remains
unestablished. No credentials, configuration, environment packages or global
sleep settings are changed during diagnosis.

## Frozen evidence

| Input | SHA-256 |
| --- | --- |
| Complete original Skill | `3cf6b2fea38acbdebfbaca564f7a2f10cd7d12dfcad0442756a6842db96eccc1` |
| Complete compact v4 Skill | `db5e96d06d52f3c1fbfe4a10b12c999c6191dc6a42f889e074931730ff6eafa9` |
| Eight fresh task bench | `9aa68e218a926e08712fd4df1e42e722448401bc111c511394f46176efae374d` |
| Frozen compiled evaluator | `da640a88b07b7daa6621c0e17007b4c929927e7c10801d6fc3dfdb40b7f27509` |
| Unchanged efficiency policy | `e6c0610daccd82f4fa326fb2660ae9f6dc722e1544f1caa006b4143de3da4a5e` |
| Approved component preview | `36dea940588b3f3ceb2a6f5b2b357f0168366816f4b1b971c53fa74ce6fcf626` |
| Native plan | `c23d69f6b304ec5af4d1d8bc751105f256da622bad5715e2fcadbcd50da35533` |
| Native manifest | `f4d83c5d06bb7e06ad35607c84dfe54946bf2e975427913dfc3b9d967160badb` |

The source head is `2671a89b93a8963a365df546778fac53b10b1ae6`, with 507 green
offline tests before commit. Recorded configuration remains Node v24.21.0,
codex-cli 0.162.0-alpha.17.2, `gpt-6.1-sol`, `xhigh`, default service tier and
workspace delivery. The served model remains unattested and inherited
configuration is not isolated. Candidate, original, graders and policy are
unchanged from the declaration; all earlier evidence remains intact.

## Completed prefix and individual costs

Both arms pass 23/23 graded executions, with zero discordant pairs, McNemar
`p=1`, unchanged scores and no observed named-check regression. The quality
verdict remains inconclusive. Uninvoked tasks and the execution error provide
no graded correctness evidence. The primary efficiency interval is unavailable
because the full task set lacks final spending coverage and successes in both
arms; no incomplete task is dropped to manufacture an interval.

The following comparison covers only the 23 completed pairs, with equal
successful denominators. It describes that prefix, without certifying the
declared eight-task objective or the failed invocation's unknown token cost.

| Paired measure | Original total | V4 total | Prefix change |
| --- | ---: | ---: | ---: |
| Input tokens | 5,934,677 | 5,103,758 | −14.00% |
| Cached input tokens | 5,191,808 | 4,416,000 | −14.94% |
| Uncached input tokens | 742,869 | 687,758 | −7.42% |
| Output tokens | 170,400 | 145,849 | −14.41% |
| Executor seconds | 4,734.158 | 3,964.283 | −16.26% |

| Task | Completed pairs | Uncached input change | Output change | Time change |
| --- | ---: | ---: | ---: | ---: |
| promise-falsy-rejection | 5 | −18.81% | −22.65% | −31.80% |
| promise-overlap-results | 5 | −16.24% | −6.86% | −7.86% |
| promise-method-context | 5 | −8.62% | −13.76% | −14.32% |
| duration-plural-count | 5 | −2.16% | −19.12% | −14.01% |
| duration-large-digits | 3 | **+15.86%** | −15.37% | −14.10% |
| debounce-context-classes | 0 | Unobserved | Unobserved | Unobserved |
| debounce-recursive-args | 0 | Unobserved | Unobserved | Unobserved |
| debounce-timer-boundary | 0 | Unobserved | Unobserved | Unobserved |

The large-number task's uncached input increase remains visible. The previously
published [normalize-url and LRU controls](2026-10-13-debugging-controls-and-sleep-stop.md)
retain their own cost increases. None of those observations is pooled into this
prefix or removed by the execution interruption.

## All invocation and cumulative spending

This stopped cohort invokes 23 original and 24 treatment executions. All 47
durations are recorded, including the failed 111.683 seconds. Forty-six final
token usages are present; the failed invocation has no usable public final or
identity-bound numeric counter. Its tokens remain unknown, not zero.

| Measure | Prior 125 calls, known lower bound | Stopped followup, known lower bound | Cumulative known lower bound |
| --- | ---: | ---: | ---: |
| Input tokens | 34,478,021 | 11,038,435 | 45,516,456 |
| Cached input tokens | 30,186,624 | 9,607,808 | 39,794,432 |
| Uncached input tokens | 4,291,397 | 1,430,627 | 5,722,024 |
| Output tokens | 1,039,161 | 316,249 | 1,355,410 |
| Executor seconds | 39,319.625 | 8,810.124 | 48,129.749 |

Cumulative spending is **172 actual task/readiness executor calls**, with five
missing final usages: four earlier partial lower bounds and this unknown
failure. The declared cumulative ceiling is 205, and this stopped cohort has
33 uninvoked entries. Read-only version/authentication queries, preparation and
offline replays make no model call. Internal connection retries are not separate
declared task calls and do not establish provider billing or a zero charge.
Separate unpartitioned platform counters remain incomparable with CLI totals;
complete authoring/orchestration cost and dollar billing remain unmeasured.

## Offline reproduction and next execution

The [archive and instructions](artifacts/2026-10-14-debugging-followup-routing-stop/README.md)
pin 1,595 files. A fresh extraction reproduces all 46 complete grades, 23 paired
outcomes, separate paired/all-invocation spending, original quality statistics,
the unavailable efficiency interval and cumulative arithmetic. The failed
invocation is never regraded. Frozen statistics, efficiency and timing checks
pass 23/23; earlier 1,567 published evidence files remain byte-identical.

This JavaScript task mix measures installed revision effects, without a
no-Skill baseline or false-trigger controls. Its incomplete outcome cannot
establish stable improvement, equivalence or general safety. The CLI connection
must be shown working before another real batch is declared. A later execution
needs its own prospective budget, run group and full frozen declaration; it
cannot resume this cohort, replace the failed sample, pool quality or relax
the old threshold. No subsequent model call is hidden in this archive.
