# benches/contrib — community benches

Drop your bench here as `benches/contrib/<name>/` when you want to submit it. A contrib bench follows the
same contract as the bundled ones ([benches/README.md](../README.md)), plus a few submission rules.

**Read [docs/bench-authoring.md](../../docs/bench-authoring.md) first.** It is the guide this checklist
assumes: the seven steps from "something went wrong" to a task you can measure, why each one is
non-optional, and the ways a bench produces confident wrong numbers. The rules below are the short
form; the guide is what makes them make sense, and rule 2 in particular is easy to satisfy while
missing the point entirely.

## Before you open the PR

1. **Build it from something real.** A task your agent actually failed at (freeze it), a fix from real
   git history (mine it), or a deliberately seeded incident — not a toy.
2. **Pass the offline gate:** `node dist/cli.js bench check benches/contrib/<name>` must report
   **0 failures**, with no missing-oracle warning. This runs both offline gates: the untouched fixture
   must fail (NOP), and the reference solution must pass (oracle). Include the complete output in the PR.
   `node scripts/check-contrib-benches.mjs` checks every contributed directory using the same CLI.
3. **Show the difficulty when available:** `--calibrate --agent <id> --trials 2` makes live agent
   calls and is optional for the first submission. If you ran it, paste the pass-rate bands. If not,
   say difficulty is uncalibrated. A saturated task (baseline ≥ 90%) can still be a regression net,
   but cannot measure lift on that agent.
4. **Keep it self-contained:** fixtures must not need a build step or installed dependencies for the
   verifier to run, must not contain secrets or customer data, and must stay small (inject mode inlines
   fixtures into prompts).
5. **Record the seed answer** in `ground-truth/` — what a correct outcome looks like and why the verifier
   is right.

## What maintainers do

- Re-run `bench check` offline in CI. A passing mock probe tests the output-verifier wiring, not
  agent quality; command verifiers use the NOP and oracle gates.
- Review the calibration when supplied; a live-agent rerun is separate from offline CI.
- Land the bench under `benches/contrib/<name>/` with your name credited in the merge commit, and link it
  from this README below.

## Index

| Bench | Domain | Contributor | Notes |
|---|---|---|---|
| *(none yet — be the first)* | | | |
