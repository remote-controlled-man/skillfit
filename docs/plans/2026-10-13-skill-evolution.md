# Debugging Skill evidence and evaluator delivery

Complete a meaningful real-task comparison of the original debugging Skill and
compact v2, improve a candidate only from development evidence, and deliver the
Agent evaluation component with reproducible artifacts and updated documentation
on the main branch. A positive result must be supported by independent validation;
building the component or passing offline tests cannot establish Skill efficacy.

## Development and validation

The development set is four independently sourced minipass defects. The first
comparison uses unchanged original/v2 complete resources and one adjacent pair
per task. Its role is difficulty calibration and diagnosis, with at most eight
benchmark calls and one separate readiness check. Preserve preparation failures
even when they made no model call. Any later development comparison gets a new
bounded declaration; previous samples remain unchanged.

The validation set is eight pinned p-map and quick-lru defects, selected from
upstream history before new development outcomes. Its outcome verifiers remain
outside agent workspaces. Offline gates verify direct original failures and
full maintainer-oracle success. Freeze the complete bench before choosing the
final candidate, then freeze that candidate, its baseline, the executor and
implementation before starting the fixed five-pair-per-task validation batch.
Use balanced adjacent pairs in the new validation batch, alternating the first
arm across task positions and trial numbers. Preserve baseline-first development
records with their own order and do not pool them into validation.

The initial study ceiling is 128 invocations: at most two readiness checks,
30 calibration/development calls, 80 validation calls and 16 known regression
control calls. Readiness is spending, not a task. An executor or configuration
failure stops that batch; neither replacement samples nor outcome-driven extra
trials are allowed. Functional task failures remain observations.

## Evidence for improvement

Apply the existing frozen statistical protocol and separate component adoption
policy. The predeclared validation policy requires eight tasks with five graded
pairs each, a positive `effective` verdict, no observed pass/score/check regression,
verified native evidence, complete recorded usage and at most 25% increases in
all-invocation uncached input, output and elapsed time per successful task.

A stability claim additionally requires a positive lower task-bootstrap
confidence bound and improved outcomes on at least three distinct defects.
Report pass rates, reliability over repeated attempts, named-check changes,
saturated tasks, confidence intervals and individual cost increases. Bound any
claim to the evaluated JavaScript mapping/cache task mix and configuration.
Two repositories and eight tasks do not prove universal debugging improvement.

On 2026-10-13, before any independent validation call, the user additionally
accepted no visible correctness regression with stable cost reduction as a
valuable improvement. Preserve the original quality declaration above. The new
efficiency objective uses an explicitly frozen version-2 policy: at least 10%
less all-invocation uncached input per success supported by the upper 95%
10,000-resample task-block bootstrap bound (seed 20261013), and at least six of
eight tasks individually reducing that measure. Permit no per-success increase
in input, cached/uncached input or output; the explicit elapsed cap remains 25%.
Use balanced order and all existing evidence/non-regression gates. An all-pass
tie can meet this separate objective but cannot establish a quality gain or
equivalence. Report both objectives without choosing the favorable one after
seeing validation outcomes. Two repositories still limit generalization.

Missing receipts, incomplete experiments, synthetic executors and
post-hoc policy changes cannot authorize adoption. If optimization uses results
from a validation set, that set becomes development; a new candidate requires a
fresh independent validation declaration. Never change the grader or threshold
to obtain an accepted result. The component never upgrades a Skill automatically.

## Reproduction and delivery

Retain complete inputs, native plans, every invocation receipt, available public
transcripts, both deliveries, ledgers, timing diagnostics and failed attempts.
Report paired spending separately from all invocation spending and additional
readiness/development work. Missing usage remains unknown or a lower bound;
provider internal retries, dollar billing and orchestration costs cannot be
inferred from CLI tokens. Fresh model calls reproduce the procedure rather than
identical stochastic outcomes. Offline replay must reproduce recorded quality
and measured costs without calling a model or changing retained evidence.

Before delivery, run the full offline project suite, all contributed bench gates,
the dedicated Skill validator, documentation consistency checks and a clean
packaged CLI smoke. Preserve previously published evidence byte-for-byte.
Update English and mirrored Chinese documentation, publish dated evidence with
honest conclusions and reproduction commands, and merge the verified change to
the main branch. The goal remains incomplete while independent efficacy evidence,
usable component delivery, documentation or main-branch integration is missing.
