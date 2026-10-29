# Complete your first evaluation

Build skillfit in its source checkout with `npm ci` and `npm run build`;
[choose your build](../README.md#choose-your-build) explains the version boundary.
Then switch to the project/study workspace that owns the experiment:

```bash
skillfit_source="$PWD"
cd /path/to/your/workspace
```

Capture `skillfit_source` in the built source checkout and replace the workspace
placeholder with an existing directory. Every relative input/output below belongs
to that workspace; the compiled CLI and bundled controls stay in the checkout.
For one-off development validation, use a fresh OS temporary workspace instead.
This first loop uses fixed synthetic controls and makes zero model calls. It
proves that the pipeline can recognize those controls; it cannot establish a real
Skill's benefit or adoption eligibility.

## 1. Preview fixed controls

Choose a fresh run group and an export directory that does not exist:

```bash
node "$skillfit_source/dist/cli.js" bench self-test "$skillfit_source/benches/_self-test/example" --runs-root ./runs/first-study/batches --run-group first-controls --json --dry-run
```

The [outer workspace](experiment-workflow.md#store-process-data-and-analysis) groups
this tutorial's batches and exports under workspace-relative `runs/first-study/`;
exclude generated outputs from that project's Git history. The CLI creates only
the needed output paths. Inspect the control suites and `plan.sha256`.
Preview creates no run directory and executes no verifier, oracle or agent. Copy the returned digest into the
next command, keeping the same inputs and output group:

```bash
node "$skillfit_source/dist/cli.js" bench self-test "$skillfit_source/benches/_self-test/example" --runs-root ./runs/first-study/batches --run-group first-controls --json --plan-sha <plan.sha256>
```

Do not enter the angle-bracket placeholder literally. A changed input needs a
fresh preview. `--yes` cannot replace the digest. Existing output groups,
including empty directories, are refused; choose another group to repeat.

## 2. Inspect the observed result

The wrapper lists the benefit, harm, null and error suites and their expectation
checks. Expected benefit/harm verdicts are effective/ineffective, the null is
inconclusive, and the controlled error is stopped. Read a native suite directory:

```bash
node "$skillfit_source/dist/cli.js" report eval ./runs/first-study/batches/first-controls/known-benefit
node "$skillfit_source/dist/cli.js" report eval ./runs/first-study/batches/first-controls/known-benefit --json
```

The benefit control has six discordant pairs and exact p = 0.03125. Its observed
costs remain unknown and its synthetic origin prevents adoption. A green
expectation check means the declared control was recognized, not that an agent
improved. [Author controls](bench-authoring.md#test-known-controls) when changing
your own verifier; [report fields](../reference/evaluation-reports.md) explains
saved outcomes, unknown usage and errors.

## 3. Export and reproduce without model calls

```bash
node "$skillfit_source/dist/cli.js" report eval ./runs/first-study/batches/first-controls/known-benefit --export ./runs/first-study/exports/first-controls --yes
node ./runs/first-study/exports/first-controls/reproduce.mjs
```

Expect successful integrity checks and the same synthetic verdict. Reproduction
uses the sealed runtime, inputs and outputs; it regrades saved work and makes
no new observation about a model. It can be moved to a different directory and
run again with Node.js. Export the suite, not the self-test wrapper JSON. See
[sharing and recovery](experiment-workflow.md#read-share-and-reproduce) for
privacy, interrupted runs and retention. Save derived analyses outside the sealed
suite; do not delete individual indexed files to save space.

## 4. Prepare a real comparison

Create a fresh teaching case, then replace it with an independent real task:

```bash
node "$skillfit_source/dist/cli.js" bench init ./my-bench --kind command --dry-run
node "$skillfit_source/dist/cli.js" bench init ./my-bench --kind command --yes
node "$skillfit_source/dist/cli.js" bench check ./my-bench --json
node "$skillfit_source/dist/cli.js" eval ./my-skill --bench ./my-bench --mode installed --agent codex --trials 1 --max-calls 2 --runs-root ./runs/first-study/batches --run-group first-real --json --dry-run
```

Replace `./my-skill` with an existing Skill directory. These commands still make
zero model calls. Bench creation writes only the fresh directory; checking runs
local graders. Review those programs before using an unfamiliar bench.

The offline **NOP** gate requires the untouched fixture to fail. An **Oracle**
gate checks that a reference repair passes; without an oracle, winnability is
unverified. Neither proves a real agent can solve the case. Follow
[bench authoring](bench-authoring.md) to freeze failures, write independent
graders, label trigger controls and check the result before spending.

Check whether the target Skill is already available globally or global rules/MCP
supply the treatment to both arms. Use a controlled profile and record inherited
configuration; skillfit does not remove user configuration. Agent readiness
checks do not prove authentication or absence of hidden exposure.

A one-task preview is a smoke test. The adoption scale requirement is
**8 distinct tasks × 5 trials per condition**: **80 agent executions** on an
eight-task bench, before optional judge calls. Five trials are a starting point,
not a power guarantee. Predeclare representative tasks, sample size, claim and
budget before observing results; do not keep adding trials until significant.

With live spending separately authorized, follow
[the evaluation workflow](experiment-workflow.md#plan-before-spending) to bind
and execute the real plan. The [component contract](../reference/eval-component.md)
owns JSON request fields and adoption gates; [metrics](../reference/metrics.md)
owns the statistical meaning and its limits.
