# Native diff mechanism: offline preparation and bounded development proposal

Status: prepared without a live call. The authorized live-call budget remains
zero; the earlier four-call allowance is exhausted. This proposal does not
authorize execution, an automatic retry or a later validation cohort.

## Decision before spending

Keep the common helper as a correctness repair. Do not fund an 80-call study
on an assumed 10% saving from this repair. The published
[cost review](../../evidence/2026-10-14-debugging-reading-pilot-and-cost-review.md)
locates 16,759 uncached tokens in 12 dedicated recovery responses, 0.843% of
the reviewed v4 population. All 19 recovery responses account for 41,675 of
1,987,001 uncached tokens (2.097%). These are observed response costs, not
avoidable net savings or causal upper bounds. Changed context, cache reuse,
common guidance and later behavior can outweigh any removed response.

The remaining question is whether real agents use the supplied helper and
whether the current old/new Skill comparison warrants further study. A small
development probe can diagnose that mechanism; it cannot prove stable savings
or isolate the helper's causal contribution. A proper helper-on/helper-off
experiment would change the common environment and requires its own design.
Do not compare a new helper run with historical broken-environment costs as
if they were a randomized pair.

## Fixed proposal

| Item | Frozen choice |
| --- | --- |
| Task | `duration-large-digits`, the existing HumanizeDuration scientific-notation defect |
| Task status | Reused development task; never a fresh holdout |
| Baseline / candidate | Complete published original `diagnosing-bugs` / compact v4 resources; no new Skill text |
| Common environment | Same native diff helper and guidance, fixtures, deadline, executor settings and outcome grader in both arms |
| Calls | One task, two adjacent pairs: original → v4, then v4 → original; at most four invocations |
| Purpose | `development`; no judge, candidate generator, readiness call, replacement or automatic expansion |
| Deadline | 1,200 seconds per invocation in both arms; at most 80 summed executor minutes, excluding offline checks |
| Adoption | Existing eight-task/five-trial floor and conservative 10% efficiency policy unchanged; this probe cannot qualify |

The six historical original/v4 deliveries on this task have uncached input
32,186–57,025 per call. Taking two observations from each arm's historical
minimum/maximum gives a rough four-call envelope of 133,016–203,884 uncached
input, 924,182–1,394,284 total input and 18,916–25,530 output tokens. This is
a budgeting reference, not a cap or forecast guarantee; settings and provider
behavior can change. Cached tokens are part of input, not an extra amount.
Provider billing and complete authoring/orchestration costs remain unknown.

## Reproduce the preparation without a model

Build this checkout, then inspect the read-only preparation plan:

```bash
npm run build
node docs/examples/prepare-native-diff-probe.mjs
```

To prepare inputs, select a fresh directory under `runs`. Preparation prints
the plan, copies and verifies the complete Skills and bench assets, backs up
the copied bench definition, and schedules only the selected task. Existing
directories are refused. No global environment or original evidence changes.

```bash
node docs/examples/prepare-native-diff-probe.mjs --write runs/native-diff-probe-inputs
node dist/cli.js bench check runs/native-diff-probe-inputs/bench
node dist/cli.js eval --request runs/native-diff-probe-inputs/request.json --dry-run
```

The CLI preview freezes the request, complete input hashes, helper descriptor,
compiled runtime and policy. It must report four planned calls, balanced order,
`purpose: development` and ineligible acceptance. Save the preview outside the
eventual sealed result directory. Source or compiled-runtime changes require a
new preview. Do not run the execution command without fresh user authorization
for the concrete plan and spending envelope. Possessing its hash is not consent.

## Evidence and stop rules

For every invocation, retain the command trace and native ledger, final or
partial token usage, elapsed time, outcome checks and helper hash. Record helper
use separately as `observed`, `not-observed` or `unknown`. An installed file,
guidance text, an echo of a command or a search hit does not establish use.
`observed` requires an actual execution of the unchanged helper on an untracked
file and its recorded result; distinguish a displayed patch with exit 1 from
an error, a legitimate empty file and a check-only command. Ambiguous shell
wrappers or missing traces remain `unknown`.

Report patch displays and later recovery responses without treating every empty
diff as a failure. Count prompt guidance and tool output bytes as bytes; do not
call them tokens or subtract an observed recovery response as a proven saving.
Whole-invocation spending includes the common prompt, all commands and later
context. Report every call, failed or excluded work, each cost dimension and
each pair's increase alongside totals. Keep the 178-call historical ledger
separate; a fully executed proposal would bring actual spending to 182 calls.

Before any authorized execution, verify power, the owned sleep assertions,
deadline, frozen inputs and routing without a separate model readiness call.
Stop on an executor, routing, integrity, missing-usage or timing failure; retain
the partial costs and do not replace the sample. Retain an ordinary functional
task failure as an outcome rather than erasing it. Release owned power
assertions in `finally`.

At four calls, stop regardless of result. Visible correctness regressions or
cost increases block a follow-up recommendation. No helper adoption leaves the
mechanism unsupported. Adoption with favorable point costs may justify a new
discussion, but cannot establish stable improvement, net helper savings or
independent validation. A later Skill change needs a new candidate declaration;
any independent validation needs unused tasks and a fresh approved budget.
