# benches/contrib — community benches

Drop your bench here as `benches/contrib/<name>/` when you want to submit it. A contrib bench follows the
same contract as the bundled ones ([benches/README.md](../README.md)), plus a few submission rules:

## Before you open the PR

1. **Build it from something real.** A task your agent actually failed at (freeze it), a fix from real
   git history (mine it), or a deliberately seeded incident — not a toy.
2. **Pass the offline gate:** `node dist/cli.js bench check benches/contrib/<name>` must report
   **0 failures** (verifier rejects missing/empty output; command verifiers must reproduce the failure
   on the pristine fixture).
3. **Show the difficulty read:** run `node dist/cli.js bench check benches/contrib/<name> --calibrate --agent <id> --trials 2`
   and paste the band output into the PR body. A bench that saturates (baseline ≥ 90%) is still welcome
   as a regression net — just say so.
4. **Keep it self-contained:** fixtures must not need a build step or installed dependencies for the
   verifier to run, must not contain secrets or customer data, and must stay small (inject mode inlines
   fixtures into prompts).
5. **Record the seed answer** in `ground-truth/` — what a correct outcome looks like and why the verifier
   is right.

## What maintainers do

- Re-run `bench check` and a mock-executor eval in CI.
- Re-run your calibration on a second agent when possible.
- Land the bench under `benches/contrib/<name>/` with your name credited in the merge commit, and link it
  from this README below.

## Index

| Bench | Domain | Contributor | Notes |
|---|---|---|---|
| *(none yet — be the first)* | | | |
