# benches/contrib — community benches

Drop your bench here as `benches/contrib/<name>/` when you want to submit it. For a measured result, open an Evidence submission issue instead of pasting an unverifiable percentage. A contrib bench follows the
same contract as the bundled ones ([benches/README.md](../README.md)), plus a few submission rules.

**Read [docs/guides/bench-authoring.md](../../docs/guides/bench-authoring.md) first.** It is the guide this checklist
assumes: the path from a real failure to checked fixtures, graders and controls, why each is
non-optional, and the ways a bench produces confident wrong numbers. The rules below are the short
form; the guide is what makes them make sense, and rule 2 in particular is easy to satisfy while
missing the point entirely.

## Before you open the PR

1. **Build it from something real.** A task your agent actually failed at (freeze it), a fix from real
   git history (mine it), or a deliberately seeded incident — not a toy.
2. **Pass the offline gate:** `node dist/cli.js bench check benches/contrib/<name>` must report
   **0 failures**, with no missing-oracle warning. This runs both offline gates: the untouched fixture
   must fail (NOP), and the reference solution must pass (oracle). Include the complete output in the PR.
   `node tools/verify/check-contrib-benches.mjs` checks every contributed directory using the same CLI.
3. **Show the difficulty when available:** `--calibrate --agent <id> --trials 2` makes live agent
   calls and is optional for the first submission. If you ran it, paste the pass-rate bands. If not,
   say difficulty is uncalibrated. A saturated task (baseline ≥ 90%) can still be a regression net,
   but has limited observed quality headroom. Paired efficiency remains a separate
   question; baseline calibration alone proves neither equivalence nor benefit.
4. **Keep it self-contained:** fixtures must not need a build step or installed dependencies for the
   verifier to run, must not contain secrets or customer data, and must stay small. Default snapshot
   input inlines fixtures into prompts; `--input workspace` presents them on disk to a CLI instead.
5. **Record the seed answer** in `tasks/<id>/reference/` — what a correct outcome looks like and why the verifier
   is right.

## What maintainers do

- Re-run `bench check` offline in CI. A passing mock probe tests the output-verifier wiring, not
  agent quality; command verifiers use the NOP and oracle gates.
- Review the calibration when supplied; a live-agent rerun is separate from offline CI.
- Land the bench under `benches/contrib/<name>/` with your name credited in the merge commit, and link it
  from this README below.

## Index

These are reusable inputs, not a history of published results. Defect datasets
exercise real source behavior; diagnostic controls exercise specific harness or
instruction behavior. The personal-study names on older directories do not imply
independence, efficacy or a promotion sequence. Future names should describe the
workload/domain. Keep generated run output outside this tree.

For additions, keep `tasks/<id>/{prompt.md,fixture/,reference/}` together, with
an optional task-specific `verify.mjs`; genuinely shared graders stay under
`verifiers/`. The existing manifest is the only executable membership list.
Keep one short root card, source provenance and licenses; generated runs,
process logs, reports and replay exports belong in their explicit workspaces.
The [workflow](../../docs/guides/experiment-workflow.md#store-process-data-and-analysis)
owns retention and manual cleanup. Existing public directory names are retained
for callers; their cards describe workloads rather than a study sequence.

### Defect datasets

| Bench | Domain | Contributor | Notes |
|---|---|---|---|
| [oss-mcp-use-utf8](oss-mcp-use-utf8/README.md) | MCP App HTML decoding | skillfit replay of MIT-licensed mcp-use source | Pinned real-source workflow/regression example; earlier baselines saturated; no general Skill efficacy claim |
| [oss-normalize-url](oss-normalize-url/README.md) | URL query normalization | skillfit replay of MIT-licensed normalize-url source | Pinned issue #193 and maintainer fix; Node-only evidence gates; offline gates do not establish difficulty or benefit |
| [oss-minipass](oss-minipass/README.md) | Stream completion and backpressure | skillfit replay of ISC-licensed minipass source | Four pinned historical defects; public behavior and regression replay gates |
| [oss-skill-validation](oss-skill-validation/README.md) | Asynchronous mapping and cache lifetime | skillfit replay of MIT-licensed p-map and quick-lru source | Eight independently sourced defects in two repositories; no efficacy result implied by offline gates |
| [oss-skill-independent](oss-skill-independent/README.md) | Async context, timers, errors and command lifecycle | skillfit replay of MIT-licensed p-limit, p-timeout, p-throttle and Commander source | Eight pinned defects; identical-regression original/fix gates and protected assets; difficulty uncalibrated, zero new model calls |
| [oss-lru-cache](oss-lru-cache/README.md) | Asynchronous cache fetch lifecycle | skillfit replay of ISC-licensed lru-cache source | Three pinned real-source defects; offline third-side gates, live difficulty uncalibrated |
| [oss-skill-followup](oss-skill-followup/README.md) | Debounce and duration formatting | skillfit replay of independently sourced defects | Eight pinned defects with deterministic clock and regression gates |


### Diagnostic controls

| Bench | Purpose | Limits |
| --- | --- | --- |
| [waza-behavior](waza-behavior/README.md) | Hold instructions and verification receipts, adapted from MIT-licensed Waza contracts | Regression/diagnostic controls; inadmissible as independent evidence of Waza benefit |
