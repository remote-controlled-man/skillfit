# Skill evaluation evidence index

This maintained index describes the debugging Skill study; the linked dated reports
and archives remain append-only. These cases exercise the CLI's evidence gates.
Users should build cases from their own tasks rather than treating this study as
a universal benchmark or an installation recommendation.

## Current status — October 15, 2026

The study has **195 actual executor calls**. Seven historical public final usage
records are still unknown; spending totals are lower bounds. No tested revision
has qualified for adoption. All cohorts are closed, and the remaining live-call
budget is zero. Unused slots in a stopped cohort are not permission to resume.

The latest [receiver mechanism stop](../evidence/2026-10-15-receiver-mechanism-stop.md)
uses one of at most two authorized calls. The v4.1 candidate reads the revised
Skill but reproduces the known wrong production repair: 4/6 functional groups
and 8/18 receiver probes pass. The controller stops before the v4 control.
The report and dependency-free archive reproduce the failure, usage, timing,
controller checks and cumulative ledger without an agent call. This is one
reused development task, not a new independent comparison.

Known measured cumulative costs are 50,459,837 input tokens, including 44,128,896
cached and 6,330,941 uncached; 1,491,244 output tokens; and 52,132.96 executor
seconds. Seven unknown final usages, provider billing and complete authoring /
orchestration costs are unavailable. The separately qualified unattested usage
supplement is not silently added to these totals. See the latest report for the
ledger, coverage and exact replay instructions.

## Earlier cohorts, in order

The paragraphs below retain each cohort's original scope and cumulative count.
Statements about what had not yet run describe that publication's cutoff; the
current status above includes the subsequent stops.

The latest [debugging development record](../evidence/2026-10-13-debugging-completed-development.md) retains a rejected candidate, one concrete repair and increased total costs; [stopped cohorts](../evidence/2026-10-13-debugging-development-stops.md) preserve errors and partial spending. Neither establishes stable improvement or authorizes an upgrade.

[Known regression controls and the first validation interruption](../evidence/2026-10-13-debugging-controls-and-sleep-stop.md) retain LRU point savings, a normalize-url cost regression and a diagnosed sleep gap. All 16 completed deliveries replay offline; the interrupted invocation keeps its partial cost and receives no grade. A fresh fixed validation batch remains separate.

The [completed independent validation](../evidence/2026-10-14-debugging-independent-validation.md) retains 80 real executions: both versions pass 40/40, while compact v4 reduces aggregate uncached input 16.82%, output 16.64% and time 17.48%. Its 95% uncached-input interval supports 7.69%–26.26% savings, below the declared minimum of 10% at the conservative bound. Adoption remains `inconclusive` and ineligible. Individual cost increases, all 125 study calls and a zero-model offline replay remain visible.

The [prospective followup tasks](../benches/contrib/oss-skill-followup/README.md) pin eight different defects in three new repositories, with original failures, complete maintainer passes and protected regression witnesses. The [separate bounded protocol](plans/2026-10-14-skill-followup.md) keeps v4 and the 10% requirement unchanged, caps this followup at 80 calls and cumulative spending at 205, and never pools earlier quality results. Offline integrity checks establish task validity, not Skill improvement.

The [stopped followup record](../evidence/2026-10-14-debugging-followup-routing-stop.md) retains 46 exact offline regrades, a 47th-call CLI routing failure and 33 uninvoked entries. Timing and power are normal, but the failed token cost remains unknown; no completed prefix authorizes adoption. Individual cost increases and all 172 cumulative executor calls remain visible.

The [subsequent spending stop](../evidence/2026-10-14-debugging-spending-stop.md) retains a separate readiness check and one user-interrupted recovery invocation, bringing actual cumulative spending to 174 calls. The remaining 79 entries are uninvoked. Its offline archive reproduces partial-cost lower bounds and keeps the unattested local readiness counter separate; no new quality gain, eligibility or automatic upgrade is claimed.

The [four-call reading pilot and cost review](../evidence/2026-10-14-debugging-reading-pilot-and-cost-review.md) brings cumulative spending to 178 calls. All four deliveries pass, but the reading draft increases uncached input 34.35%, output 10.16% and time 13.60%, so it is rejected. A post-hoc review corrects 50 literal-empty diffs to 19 missing patches and 31 valid check-only results; the merged common diff helper has offline verification, while actual Agent use and net savings remain untested. A narrowed draft remains unvalidated. The [ordered delivery plan](plans/2026-10-14-evidence-and-release-sequence.md) puts evidence and release preparation before any newly authorized experiment.

The [completed four-call mechanism probe](../evidence/2026-10-15-native-diff-mechanism.md) brings cumulative spending to 182 calls. Both versions pass 2/2; v4 reduces uncached input 27.76%, output 17.56% and time 15.92%, with all five cost measures lower in each pair. Agents use the common helper in 4/4 runs, displaying five nonempty patches. This is one reused development task: it establishes observed use and favorable paired costs, while stable improvement and the helper's causal net savings remain unproven. The offline archive retains every call and seven earlier unknown usages; adoption remains `inconclusive`, and that probe starts no independent comparison or extra calls.

The [independent comparison regression stop](../evidence/2026-10-15-independent-comparison-regression-stop.md) brings cumulative spending to 194 calls. Within the original 80-call cap, one retained invocation and eleven continued invocations yield six pairs; the second task passes 6/6 with original and 3/6 with v4, so the no-regression gate rejects adoption and stops the remaining 68 calls. V4's all-spending uncached input per success rises 13.10%. The archive replays all twelve deliveries and costs, preserves the initial power stop/user pause and separate native sessions, and grants no automatic upgrade or complete native-component audit.
