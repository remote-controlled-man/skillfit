# Completed debugging Skill development: v3 rejected, v4 still experimental

**Compact v3 tied correctness and increased costs. Compact v4 repaired one
public return-value failure, but these four-task development comparisons do not
establish stable improvement.** Neither candidate is promoted. The final v4
bytes are frozen for known regression controls and an independent comparison
against the original Skill; no validation outcome was used to choose them.

## Version changes and complete resources

The baseline source is the MIT-licensed Matt Pocock
[`diagnosing-bugs`](https://github.com/mattpocock/skills/blob/d81f3a183412e71a5b1e84ca21bc1a35eea03a60/skills/engineering/diagnosing-bugs/SKILL.md).
These are local instruction revisions, not upstream releases or trained models.
Only `SKILL.md` changed. Frontmatter, UI metadata, license and the human-loop
helper remain identical. Full resource fingerprints are retained:

| Version | Full Skill SHA-256 |
|---|---|
| Original | `3cf6b2fea38acbdebfbaca564f7a2f10cd7d12dfcad0442756a6842db96eccc1` |
| Compact v2 | `2df457fa462c9d2b082a26364d53047e5612e195099c90c818e597a274eaf0ba` |
| [Compact v3](inputs/diagnosing-bugs-compact-v3/SKILL.md) | `5b1a96e60e0dea59ca9f43ae09ff20bb04f7fa0c49c7f6f1699d1e932976c082` |
| [Compact v4](inputs/diagnosing-bugs-compact-v4/SKILL.md) | `db5e96d06d52f3c1fbfe4a10b12c999c6191dc6a42f889e074931730ff6eafa9` |

V3 reduced repeated inspection and verification instructions while preserving
application-value history for `onInsert` and bounded asynchronous probes. This
cost hypothesis failed in its completed development batch. V4 additionally
explicitly checks public return/status observables and callback-driven state
changes before an operation returns. This follows the unchanged task prompt,
pinned public README and the concrete development failure; it does not insert a
maintainer patch or hidden assertion into the Skill. Candidate rationale is in
the artifact package. All candidates passed the dedicated offline Skill validator
using the isolated PyYAML environment; that validates packaging, not efficacy.

## Fixed development comparisons

Both batches retain all four independently sourced historical
[minipass defects](../benches/contrib/oss-minipass/README.md), one adjacent pair
per task, balanced order and the same **1200-second deadline in both arms**.
The pipeline task was first in both; fixtures, outcome verifiers and maintainer
oracles stayed unchanged. Earlier [600-second timeouts](2026-10-13-debugging-development-stops.md)
remain stopped observations in separate cohorts, never replaced or pooled.

| Setting | Recorded value |
|---|---|
| Cohort 6 / 7 | v2 versus v3 / v3 versus v4 |
| Planned / started / settled | 8 / 8 / 8 in each cohort |
| Configured model / reasoning / tier | `gpt-6.1-sol` / `xhigh` / `default` |
| CLI / Node | `codex-cli 0.162.0-alpha.17.2` / `v24.21.0` |
| Served model / sampling | Unattested / unpinned |
| Input / delivery | Workspace, complete installed Skills, identical prompts |
| Development bench SHA-256, reordered copy | `fb1170a7f0d5f0443d4a8d6443c492e10de2d4b8f62e6110993d9f2006f070fb` |
| Compiled runner SHA-256 | `4728cf7c1934aca09081186f0b4203b31802b7e68f70870863a6b5a097ff97ad` |
| Executor/configuration errors | None |
| Recorded final usage | 8/8 in each cohort |

Temporary macOS idle-sleep assertions were verified, alive through completion
and released afterward. Every recorded invocation has normal timing diagnostics.
Inherited configuration is not fully isolated; server-side identity is not
independently attested. All decisions remain scoped to these recorded conditions.

## Correctness and concrete observables

| Task | Cohort 6 v2 / v3 checks | Cohort 7 v3 / v4 checks |
|---|---:|---:|
| pipeline-order | 5/6 / 5/6 | 5/6 / **6/6** |
| end-listeners | 6/6 / 6/6 | 6/6 / 6/6 |
| async-end | 6/6 / 6/6 | 6/6 / 6/6 |
| buffered-readable | 6/6 / 6/6 | 6/6 / 6/6 |
| Fully successful tasks | 3/4 / 3/4 | 3/4 / **4/4** |

All prior pipeline deliveries in these two comparisons still failed
`write result reflects flow started during readable notification`. V4 passed
that check while preserving the other five, including the retained regression
test passing both the submitted and maintainer repairs and failing the original.
Neither completed cohort contains an observed paired check, score or pass
regression. This does not prove absence of future harm.

Cohort 6 has zero discordant pairs. Cohort 7 has one improved and zero regressed
pairs: +25 percentage points in task pass rate, +4.17 points in mean facet score,
McNemar p = 1. Both statistical verdicts are **`inconclusive`**. A concrete
development repair is useful evidence for candidate selection, not a stable
quality-lift claim.

## Cost changes and additional development spending

Both completed cohorts have all final usage, so paired and all-invocation
populations coincide. Spending per success retains the failed pipeline work:
v2/v3 have three successes each in cohort 6; v3/v4 have three/four in cohort 7.

| Metric | Cohort 6 v3 versus v2, total / per success | Cohort 7 v4 versus v3, total / per success |
|---|---:|---:|
| Input | +18.6% / +18.6% | −7.6% / −30.7% |
| Cached input | +18.4% / +18.4% | −11.2% / −33.4% |
| Uncached input | **+20.3% / +20.3%** | **+32.5% / −0.6%** |
| Output | +8.5% / +8.5% | **+27.4% / −4.4%** |
| Executor time | +15.1% / +15.1% | **+29.0% / −3.2%** |

The component rejects v3 for increased per-success costs. V4 remains
`inconclusive`: insufficient scale, development purpose and no successful
baseline pipeline denominator for a per-task efficiency interval. Its slight
aggregate uncached-input saving per success depends on the additional success;
it is not evidence of uniform or stable cost reduction. No threshold or grader
was relaxed.

These two cohorts add **16 CLI executions**, 4,641,107 input (including 4,161,920
cached), 479,187 uncached input, 128,396 output and **6111.889 executor seconds**.
Before controls/independent validation, the overall study has 28 executions:
26 development and two readiness. Including the earlier partial failure
supplement, known lower bounds are 7,273,215 input, 6,505,856 cached input,
767,359 uncached input, 199,524 output and 9377.423 recorded seconds. Three final
usages remain missing. This sums study spending only, never quality samples.
Provider-internal requests/retries, dollars, authoring and orchestration are not
fully metered; output already includes its reasoning subset.

## Reproduction and remaining validation

The [compressed artifact package](artifacts/2026-10-13-debugging-completed-development/README.md)
retains all 16 deliveries, installed inputs, available public events, plans,
ledgers, receipts, candidate rationale, frozen source/compiled code, licenses
and exact verifiers. Original local copies pass native audit. Public paths are
normalized and private reasoning excluded, so exports explicitly distinguish
original hashes from derived hashes and cannot claim unchanged native seals.

Fresh extraction regrades all 16 deliveries identically and recomputes both
cohorts' saved McNemar/task-bootstrap statistics and complete recorded costs,
with zero new model calls. The frozen standalone statistical/efficiency/timing
checks pass 23/23; the complete source checkout passed 491/491 at that snapshot.
The later component with partial-failure counters passed 497/497.

The eight p-map/quick-lru validation defects were frozen before development
outcomes. The selected v4 versus original request declares five balanced pairs
per task (80 calls), both 1200-second deadlines and the explicit efficiency policy:
at least 10% uncached-input saving per success supported by the upper 95%
fixed-seed task-block bootstrap bound, at least six of eight tasks improving, no
visible correctness regression, no increase in any token partition/output and
at most 25% elapsed increase. Original quality criteria remain separately
predeclared and are reported without selecting a favorable objective after results.

Known lru-cache controls, including `onInsert`, and normalize-url controls are
separate development evidence (12 and four calls). An observed correctness
regression blocks entry into independent validation. There are no replacement
samples, candidate edits, hidden-grader changes or automatic upgrades. At this
record's freeze, independent validation has made zero calls. Subsequent results
belong in a new dated record; this page does not assert their outcome.
