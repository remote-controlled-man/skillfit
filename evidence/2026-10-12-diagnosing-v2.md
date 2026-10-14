# Diagnosing Bugs compact v2: repaired event semantics, bounded transfer pilot

The known v1 `onInsert` regression did not recur in either fresh v2 regression
trial: both v2 deliveries passed all nine checks, including application-level
add/update/replace reasons. The original Skill also passed both trials. The
independent normalize-url cohort completed one passing pair before its second
baseline invocation timed out; its last treatment was refused by the stop guard.
This is **seven actual agent invocations**, six graded deliveries and three
surviving pairs from an eight-invocation declaration. The transfer study is
**stopped**, not a completed two-pair validation.

No graded pair improved or regressed in pass/fail or any named check. Both
cohort verdicts remain **inconclusive** (McNemar exact p=1). There is no general
quality improvement, equivalence, non-inferiority or installation claim.

## What changed in the Skill

The previous compact v1 compared an internal fetch Promise with a resolved
application value and reported `replace` for both a first value and a same-value
refresh. Two historical v1 deliveries failed the same frozen public check.
Both unchanged counterexamples are retained and still reproduce 8/9.

V2 adds one conditional paragraph: at a shared stateful boundary, distinguish
application history from wrappers/transient bookkeeping and check public
callbacks/events/status for absent, same and changed application values. It
adds no repository name, task ID, concrete repair, expected output or grader
instruction. The routing description, UI metadata, helper and MIT license are
unchanged. Full-file whitespace counts are original 1402 words/8530 bytes,
v1 493/3466, v2 581/4068; these are not model-token measurements.

A separate **manual development repair control** fixes a copy of the saved v1
trial-3 source. Its newly added public regression is red before and green after.
One v1-authored test had asserted the incorrect fresh-fetch `replace` behavior;
its expectation is corrected to the documented `add` behavior in that copy.
The original v1 delivery, supplied canonical tests and frozen grader remain
unchanged. The corrected copy passes 9/9. This control is not a model trial or
Skill-efficacy result.

## Fixed inputs and procedure

- Baseline: original Matt Pocock `diagnosing-bugs`, commit
  `d81f3a183412e71a5b1e84ca21bc1a35eea03a60`; complete-resource SHA-256
  `3cf6b2fea38acbdebfbaca564f7a2f10cd7d12dfcad0442756a6842db96eccc1`.
- Treatment: local compact v2; complete-resource SHA-256
  `2df457fa462c9d2b082a26364d53047e5612e195099c90c818e597a274eaf0ba`.
- Known regression: one-task view of the unchanged lru-cache fetch-lifecycle
  fixture, prompt, reference and nine-check grader; SHA-256
  `e2fea611458e794a0a4d8b423e850fd400f1df0616e1b3ab83284f7cad78639d`.
- Independent repository: [normalize-url issue #193's maintainer fix](https://github.com/sindresorhus/normalize-url/commit/92eb7034f4c01c2075926a53261080a7fb2a93a7),
  parent `0d866eb2fd3f96fba7dfbc2687cefe001cdc96ad`. Runtime source, types,
  metadata, README, upstream AVA tests and MIT license retain exact Git blobs.
  Bench SHA-256 `73ebfa8b2e00513e991df75f9bafdccdaf333dd7517e23ae74604685cca157af`.
- Same configured `gpt-6.1-sol / xhigh / default` with Codex CLI
  `0.162.0-alpha.17.2`, Node `v24.21.0`, workspace-write, complete resources
  installed at the same matrix project slot, workspace inputs, no judge and
  nominal 600s executor timeout. Sampling controls are unexposed; served model
  identity is unrecorded, so this is configured-model consistency, not attestation.
- Two adjacent baseline-first pairs per cohort; regression then transfer.
  Eight declared invocations total; no retries, replacements or trial additions.
  No live calibration was added. Cohorts remain separate and do not pool with
  earlier v1 studies. Skill revision effects are relative to the original Skill,
  not relative to no Skill.

The [candidate freeze](plans/2026-10-12-diagnosing-v2-candidate.json) predates the
normalize-url selection and research. The author then inspected the maintainer
fix and built a local deterministic grader; actors receive only pre-fix fixture
files and the natural request. This is a new repository transfer control, not
an independently blinded benchmark or a guarantee that historical public cases
were absent from model training. The lru-cache control is deliberately known.
The [full declaration](plans/2026-10-12-diagnosing-v2.json) pins all inputs and
compiled runner before calls. The original Skill remains the profile default;
this experiment does not change a global installation.

## Quality and paired costs

Paired costs below include every graded failure; here all six graded deliveries
passed, so per-success changes equal total changes within each cohort. Token
partitions are complete on the surviving pairs. They are descriptive observations
without cost confidence intervals, significance or dollar pricing.

| Cohort | Original passes | V2 passes | Session | Input | Cached input | Uncached input | Output | Elapsed |
|---|---:|---:|---|---:|---:|---:|---:|---:|
| regression | 2/2 | 2/2 | completed | -22.3% | -24.9% | +4.9% | +5.8% | -14.8% |
| transfer | 1/1 | 1/1 | stopped | -6.6% | -0.8% | -34.1% | -23.2% | -24.6% |

The regression control saves cumulative input and elapsed time, while uncached
input per success rises **4.9%** and output per success rises **5.8%**. In its
first pair uncached input rises 12.6%; in its second it falls 2.7%. Output rises
in both pairs. The independent cohort's one observed pair lowers all recorded
cost measures, but cannot establish a stable effect. Every graded delivery has
an observed Skill-body read; read detection does not prove that a particular
instruction caused the result.

Baseline saturation and one task per cohort prevent a lift claim. Bootstrap
quality intervals collapse to [0,0] on the observed tasks; this does not mean
zero uncertainty. Neither cohort approaches the eight-task/five-trial scale
bar or six discordant pairs. These samples do not certify non-regression on
unseen tasks, broad OSS quality or trigger precision/recall.

## Failure, coverage and extra spending

`transfer-v2-20261012/query-shape/baseline/trial-2` records
`"codex" timed out after 600000ms`, no graded score and unknown final token
usage. Its paired treatment receipt records a guard refusal with
`executorInvoked: false`; it did not make a model call. The quality denominator
therefore remains one pair. Neither receipt is treated as a functional failure.

The timeout's measured elapsed time is **2178.775 seconds**, despite a configured
600s timer. The cause of the delayed timer is not independently attested; this
wall measurement cannot be interpreted as active model computation or a
billing duration. The native all-invocation table retains this time and labels
its missing usage unknown. Do not read the unmatched all-invocation time delta
as v2 speedup. The full attempted-study token cost is incomplete; the available
input total is at least **2,553,085**, output at least **64,900**, across seven
actual invocations. No private rollout reasoning or session usage was used to
fill that gap. This accounting excludes orchestration chat, research, offline
validation and any earlier experiment.

Both Skills, both benches and the compiled implementation still match their
frozen fingerprints. All eight prepared installed resource copies match the
expected version, including the refused trial's unused copy. Global guidance,
RTK and CLI version match; after transfer, the regression configuration hash
matches when only pure trust entries for the other predeclared cohort's
workspaces are excluded. Other configuration bytes remain covered. The native
sessions guard their own declared workspaces per call; the extra RTK include is
checked only around each cohort. Inherited plugins, toolchains, server-side
models, host scheduling and unlisted state remain uncontrolled.

## Reproduce the recorded result

The [artifact package](artifacts/2026-10-12-diagnosing-v2/README.md) includes
frozen compiled code, complete Skill/bench inputs, source changes, portable
workspaces, native call ledgers, receipts/public transcripts, both error/refusal
receipts, export hashes, native reports and analysis. Offline regrade matches
all **six** graded deliveries and cost aggregation; two error receipts are
excluded. Archives are tested after a fresh extraction, not only against their
original local workspaces.

Fresh model execution can repeat the procedure, not guarantee identical answers,
usage or latency. The stopped transfer run is retained permanently; a new
validation would need a new declaration after addressing the execution/time
measurement problem, rather than replacing the missing pair here.

Validation: `npm test` **449 passed**, all contributed benches **0 failures**,
syntax checks on the live/replay/analysis entry points, and exact upstream blob
checks. Remaining bench warnings are explicit: no negative trigger controls;
the known regression has nine facets and a 105KB fixture (workspace delivery).
The standalone Skill Creator validator was unavailable because PyYAML is absent;
project frontmatter/resource validation and actual native Skill reads passed.
The prior 170-file evidence package remains unchanged. No commit, PR, upstream
write or global Skill replacement is part of this experiment.
