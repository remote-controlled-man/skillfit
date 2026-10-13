# Diagnosing bugs Skill revision on historical cache failures

**The compact local candidate reduced cumulative input, but failed two replayed
behavior checks and timed out on the final attempt. Keep it experimental.**
Thirty real Codex agent invocations were attempted. After the timeout pair was
excluded, the previous Skill passed 14/14 paired tasks and the candidate passed
12/14. Both regressions involved `onInsert` event classification. The statistical
verdict remains `inconclusive`; these observations do not establish an expected
quality difference or general non-regression.

## Inputs and method

The baseline is the real MIT-licensed Matt Pocock
[`diagnosing-bugs`](https://github.com/mattpocock/skills/blob/d81f3a183412e71a5b1e84ca21bc1a35eea03a60/skills/engineering/diagnosing-bugs/SKILL.md).
The treatment is a manually written [local compact candidate](inputs/diagnosing-bugs-compact-v1/SKILL.md),
not an upstream release or a trained model. Only its `SKILL.md` body changed.
Frontmatter, UI metadata, HITL helper and license stayed identical. Full-file
whitespace word counts were 1,402 and 493; file sizes were 8,530 and 3,466 bytes.
The candidate makes diagnostic stages conditional on the evidence instead of
requiring several hypotheses and a written checkpoint for every localized defect.

The three [historical lru-cache tasks](../benches/contrib/oss-lru-cache/README.md)
were already in the repository before this revision. They replay issue 269, issue
274 and a maintainer lifecycle fix using pinned source and reference fixes.
They were not generated from the Skill. The author inspected their prompts and
graders before writing the candidate, so this is **not a blinded unseen holdout**.
All three existing cases were retained without post-result selection.

| Setting | Recorded value |
|---|---|
| Comparison | Same configured model, previous versus candidate Skill |
| Agent / CLI | Codex; `codex-cli 0.162.0-alpha.17.2` |
| Configured model / reasoning / tier | `gpt-6.1-sol` / `xhigh` / `default` |
| Served model / sampling | Not independently attested; `sampling: null` |
| Delivery | Complete four-file Skill installed in both arms; identical task prompts; workspace input |
| Sandbox / timeout | Matrix-defined `workspace-write`; 600 seconds per invocation |
| Validation | 3 tasks × 5 trials × 2 arms; adjacent old-first pairs; no judge |
| Runtime | Node `v24.21.0`; this bench requires Node >=22.13 |
| Runner | HEAD `d09ac7aaf5dfb990b4251d8c3758ed3f9cb8f809`, dirty build preserved |
| Compiled runner SHA-256 | `e8c6d5f8b163847163c007e1187a587c142d695e9bc2035cd6942929b430614a` |
| Previous full Skill SHA-256 | `3cf6b2fea38acbdebfbaca564f7a2f10cd7d12dfcad0442756a6842db96eccc1` |
| Candidate full Skill SHA-256 | `f7bc79f291af75091fa0a7ec0abc6f384bb5a5287a63236c800904057f9528b8` |
| Bench SHA-256 | `b276606b5d00bdd98a65d8fa8944ba38b73efc7429e73b5dc56d83b8937950b2` |

The [initial declaration](plans/2026-10-12-diagnosing-revision.json) was saved
before model calls. Six no-evaluated-Skill calibration runs all passed in the
earlier environment. Initial validation then stopped after three invocations
because global instructions/configuration changed during RTK setup. Its one
valid pair and one guarded invocation are retained separately.

The [fresh declaration](plans/2026-10-12-diagnosing-revision-rtk.json) fixed a new
30-invocation cohort under the new environment. Earlier runs were not pooled,
resumed or used as replacement samples. Skill, bench and compiled runner stayed
unchanged. The final candidate invocation hit the declared timeout; there was
no retry. Native session status is `stopped`, with 30 started and 30 settled.
Here an invocation means one `codex exec` process, not one HTTP request.

## Quality and replayed regressions

| Task | Previous paired passes | Candidate paired passes | Valid pairs |
|---|---:|---:|---:|
| fetch-size | 5/5 | 5/5 | 5 |
| fetch-abort | 5/5 | 5/5 | 5 |
| fetch-lifecycle | 4/4 | 2/4 | 4 |
| Overall | 14/14 | 12/14 | 14 |

Raw attempts were 15/15 successful for the previous Skill, and 12 successful,
two graded failures and one executor timeout for the candidate. The previous
trial paired with that timeout passed, but is excluded from paired rates and
paired costs under the [frozen protocol](../docs/metrics.md). A timeout is an
ungraded error, not a third functional regression.

Candidate lifecycle trials 3 and 4 each passed 8/9 checks. Both failed
`onInsert hides placeholder and classifies resolved application values`.
The [offline counterexample](artifacts/2026-10-12-diagnosing-revision/onInsert-counterexample.json)
confirms that trial 3 emits `replace` for a newly fetched value where `add` is
required, and emits `replace` for an unchanged refreshed value where `update`
is required. The corresponding previous-version delivery passes the same check.
Representative first-trial regression tests in the completed task families were
also inspected for meaningful public API assertions.

Observed Δpass is −14.3 percentage points; discordant pairs are 0 improved / 2
regressed; McNemar exact p = 0.5. Mean facet score is 100% → 98.41%, with
Δscore = −1.59 percentage points. The native task-bootstrap 95% intervals are
[−50pp, 0pp] for Δpass and [−5.56pp, 0pp] for Δscore. These small-sample intervals
and the `inconclusive` verdict do not erase the concrete replay failures.

Both arms have an observed Skill read in all 14 graded pairs. File access does
not establish adherence to every instruction. All 30 installed copies retained
their declared resource hashes after execution.

## Costs and additional consumption

Costs below include successful and failed **graded pairs**, with both members
of the timeout pair excluded. Input totals include cached input. Output already
includes the reported reasoning subset; it is not added again.

| Metric, 14 pairs | Previous total | Candidate total | Change | Change per successful task |
|---|---:|---:|---:|---:|
| Input tokens | 5,257,320 | 3,890,644 | −26.0% | −13.7% |
| Cached input | 4,630,144 | 3,318,016 | −28.3% | −16.4% |
| Uncached input | 627,176 | 572,628 | −8.7% | **+6.5%** |
| Output tokens | 137,810 | 124,487 | −9.7% | **+5.4%** |
| Executor seconds | 5,196.504 | 4,654.029 | −10.4% | **+4.5%** |

Per-success cost divides each arm's graded-pair total by its successful tasks:
14 previous successes versus 12 candidate successes. Within the 14 pairs,
candidate input increased in 2, uncached input in 4, output in 4 and duration
in 4. The task breakdown shows why a single aggregate is insufficient:

| Task | Input change | Uncached input change | Output change | Duration change |
|---|---:|---:|---:|---:|
| fetch-size, 5 pairs | −42.9% | −32.8% | −22.9% | −24.2% |
| fetch-abort, 5 pairs | −19.6% | −15.3% | −8.5% | −12.1% |
| fetch-lifecycle, 4 pairs | −9.2% | **+35.7%** | **+4.9%** | **+4.6%** |

All 15 attempts per arm consumed 5,587.338 previous executor seconds and
5,254.051 candidate seconds, including the 600.022-second timeout. Across those
attempts, candidate executor time per successful task was **17.5% higher**.
Its final token usage is unavailable. The last saved
[partial usage record](artifacts/2026-10-12-diagnosing-revision/timeout-partial-usage.json)
observed at least 169,118 input and 6,740 output tokens before timeout;
in-flight or later unrecorded consumption is unknown. It is not included in
paired cost statistics.

The separate [study overhead](artifacts/2026-10-12-diagnosing-revision/study-overhead.json)
contains six calibration and three interrupted invocations: 2,668,904 input,
85,155 output tokens and 3,321.642 executor seconds. Total study volume was 39
agent invocations. These overhead runs are not candidate-versus-previous
efficacy evidence. Executor durations exclude grading and preparation time.

The [cost analysis](artifacts/2026-10-12-diagnosing-revision/cost-analysis.json)
also provides exploratory task-bootstrap intervals, seed 20261012 and 2,000
resamples. Only cumulative and cached input intervals exclude zero; output,
uncached input and duration intervals cross zero. Three related tasks provide
limited uncertainty coverage. Fixed old-first order and provider/cache behavior
can affect costs. **No monetary or billing inference is made.**

## Reproduction and limits

[Artifact instructions](artifacts/2026-10-12-diagnosing-revision/README.md) include
the compiled runner, source patch/additions, both full Skills, independent bench,
declarations, manifests, receipts, public CLI events, verifier logs and delivered
workspaces. All 29 graded deliveries were regraded with matching exits, scores
and facets; the timeout was skipped. The same check is rerun after archive
extraction. Offline replay reproduces the observed scores without a model.
New live calls reproduce the procedure, not identical stochastic samples.

Recorded input files, normalized matrix configurations, RTK rules and CLI version
were verified after the timeout. Private configuration bodies are not published;
complete isolation, unrecorded plugin/toolchain stability and served-model
attestation are not claimed. The source tasks are public historical cases from
one repository and one async-cache family. They do not replay full upstream CI,
type compatibility, browser builds, release work or maintainer acceptance.
All tasks are positive cases, so false-trigger rate is unmeasured. Baseline
saturation gives no quality-lift headroom. Offline bench health was 11 pass /
3 warning / 0 fail; the 9-facet lifecycle and other original warnings remain.

The comparison implementation passed 434 offline tests before the frozen build.
The optional Skill creator validator was unavailable because PyYAML was absent;
frontmatter/resource identity checks and native delivery were verified instead.
After timeout, the separate cost analyzer was extended to review stopped records
explicitly and tolerate the missing timeout transcript. Its original version is
preserved; the compiled runner, quality protocol and experiment inputs were not
edited, and no additional model samples were collected.

For skillfit, this supports retaining complete version hashes, environment drift
guards, reproducible behavior counterexamples and costs per successful task as
upgrade evidence. The compact candidate needs a further revision and fresh
validation before promotion.
