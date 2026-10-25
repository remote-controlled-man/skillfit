# Your first real evaluation

The offline `bench check` proves that a task's verifier rejects the untouched fixture. When an
oracle is registered, it also checks that the reference solution passes; without one, it warns that
the task's winnability is unverified. It does not measure an agent. A paired `eval` calls your agent on both arms
and records what actually happened. This guide applies to macOS, Linux, and Windows; use the native
`node dist/cli.js` commands from a built source checkout in either Bash or PowerShell.
For features included in the installed release, replace that command prefix with
`npx skillfit@0.13.1`; no source checkout is required for your own cases.
The [current source capability table](experiment-workflow.md)
separates released behavior from unpublished trigger/model-identity corrections,
and lists adapter-specific budget limits. Use a built checkout for those source additions.
The [source-only bench self-test](bench-self-test.md) and [schema 2 claims](../reference/bench-claims.md)
require builds implementing self-test protocol 1 and bench schema 2 / measurementScope 1
respectively; replacing their prefix with npm 0.13.1 will not add these features.

## Start with the installed CLI

From your project directory, create and check a fresh teaching case, then preview
your own Skill directory (replace `./my-skill` with an existing `SKILL.md` parent):

```bash
npx skillfit@0.13.1 bench init my-bench --kind command --dry-run
npx skillfit@0.13.1 bench init my-bench --kind command --yes
npx skillfit@0.13.1 bench check ./my-bench --json
npx skillfit@0.13.1 eval ./my-skill --bench ./my-bench --mode installed --agent codex --trials 1 --max-calls 2 --runs-root ./runs --run-group first-eval --json --dry-run
```

These commands make zero model calls; `--yes` creates only the fresh bench.
Replace its teaching files with an independent real task and rerun checking before
interpreting Skill benefit. Read the environment checks even if preview exits 0.
Keep inputs and runs as siblings. Continue below to declare the claim, inspect the
plan and authorize execution; do not remove `--dry-run` just to try the example.

Since 0.12.0, bundled names such as `code-review` and
`debugging` resolve consistently in eval, `bench check/list/show` and calibration preview.
A local bench wins; explicit or existing local paths never silently fall back to
a bundled example. Write operations still require your own local directory.
Those source fixes are not present in the immutable 0.11.0 package.

## 1. Choose a claim and a bench

For a concrete OSS issue, follow [real OSS task evaluation](bench-authoring.md).
CLI coding runs can add `--input workspace` to work from files on disk without an
inline repository; use the same option for baseline calibration. Snapshot input
remains the compatible default.

For a new code-editing case, use `bench init my-bench --kind command`.
It creates a synthetic teaching fixture, independent verifier and reference
repair; this template is included in npm 0.10.0 and newer. Follow the
[starter walkthrough](bench-authoring.md#choose-a-starter), replace it with your
real task, and preview `--trials 1 --max-calls 2` before deciding to spend.

Choose one Skill, rules file, or MCP setup and one task family where it should help. Prefer tasks
frozen from failures you actually encountered. For a Skill, use the directory that contains its
`SKILL.md`; for rules or MCP, use the experiment directory described in
[config-experiments.md](config-experiments.md). Do not select or write tasks by reading the Skill
under test: that can make the result look good because the test matches its wording.

Default bench schema 1 remains compatible and has no recorded supported claims.
Current source offers explicit [schema 2 claims](../reference/bench-claims.md#authoring-and-compatibility);
select it when authoring a new bench, rather than silently upgrading old inputs.
For schema 2, every selected task must support the requested quality, efficiency
or activation target; execution refuses unsupported targets before any probes
or calls. Preview may still describe an unsupported plan. Calibration and fixed
self-test controls have no efficacy target. Neither a declaration nor the request's
policy proves validity, power or workflow-process measurement; see the
[measurement limits](../reference/metrics.md#non-goals-and-known-limitations).

The bundled `debugging` bench has 8 tasks; `code-review` has 5. They are examples, not a substitute
for your own work. The predeclared scale bar is **8 distinct tasks × 5 trials per condition**. On an
8-task bench, that is **80 agent executions** before any optional judge calls. Five repetitions are a
starting point, not a guarantee of enough statistical power. More independent, representative tasks
usually improve the scope of a claim more than repeating one narrow fixture again. A 20-task bench
at the default would make 200 agent executions, so inspect the plan before starting.
The 8×5 bar is an adoption/scale requirement, not the minimum for every
within-bench exact-test verdict. It does not guarantee power; no validated MDE
planner is available. Under a predeclared efficiency policy, tasks with little
quality headroom may still inform costs if coverage and regression gates pass.
Fix the task list and trial count before viewing results. If an exploratory run is too noisy, design
a separate confirmatory run with a predeclared size; repeatedly adding trials until p < 0.05 makes
the final p-value misleading.

`--trials` accepts integers from 1 to 20 in both eval and baseline calibration. Fractional, malformed,
or out-of-range values fail before a run or bench check starts; they are never rounded or truncated.

## 2. Check the bench and the environment

```bash
node dist/cli.js bench check <bench-dir>
node dist/cli.js eval <skill-dir> --bench <bench-dir> --agent codex --dry-run
```

Replace `<skill-dir>` and `<bench-dir>` with real paths and `codex` with your agent ID. The dry run
prints task count, target and bench hashes, executor, estimated prompt size, and the total execution
count. It does not call an agent or create `runs/`. The estimate is not a price quote: replies,
tool calls, and retries can add substantial time and tokens. An optional judge also calls a model.

With a current source build and predeclared controls, follow
[bench self-test](bench-self-test.md#preview-and-run) before live spending. It
checks known benefit/harm/null/error arms through the full paired pipeline and
keeps synthetic evidence ineligible. Ordinary `bench check` mock markers remain
informational verifier probes; neither route proves that a real agent will
discover the Skill or that your task mixture has enough statistical power.

Before paying for a run, check whether the target Skill is already available globally to your
agent, or whether global rules/MCP settings supply the same treatment in both arms. If so, the
baseline may already be exposed to the configuration, making the comparison uninterpretable. Use
a controlled agent profile for the experiment and record its relevant global configuration; skillfit
does not automatically remove the user's configuration. `doctor` and `report` are read-only aids,
but neither proves that an agent actually ignored a globally installed Skill during an eval.

Version 0.11.0 makes [Agent environment checks](experiment-workflow.md)
part of eval/calibration preview and the live gate. CLI absence, incompatible matrix capabilities
and global same-name Skills are explicit failures; login stays unknown without
network/authentication probes. Inspect the nested environment status even when a
dry run successfully generated a plan. Reports retain the original checks.

For Codex CLI, skillfit explicitly starts both paired and trigger trials with
`--sandbox workspace-write`. The agent can edit its disposable trial directory, which command-graded
tasks require. Check any extra writable roots in your Codex configuration before a run. Codex still
takes its model, reasoning level, and other settings from the active CLI configuration. Record those
settings alongside the manifest when comparing runs, and use the same configuration for both arms.

Version 0.11.0 supports an ordinary `--json --dry-run` plan and shared
budget, deadline, pair-order and output-group settings. For complete Skill
delivery use `--mode installed`; omitting `--baseline-skill` installs the Skill
only in treatment, matching an Agent request's explicit `baselineSkill: null`.
Use an explicit fresh `--run-group`, inspect `plan.sha256`, then pass that hash
with `--plan-sha` to execute JSON plans. See the [two-call budget example and
stop rules](experiment-workflow.md). A preview does not authorize spending, and a
no-Skill comparison cannot authorize revision adoption.

The same source supports a bounded baseline calibration before a paired study.
It measures task difficulty, not Skill benefit. For example, preview one selected
task with one call, without running the verifier, oracle or agent:

```bash
node dist/cli.js bench check <bench-dir> --calibrate --agent codex --task <task-id> --input workspace --trials 1 --max-calls 1 --run-group calibration-001 --json --dry-run
```

Inspect `plan.agentPreflight`, then confirm `plan.planSha256` with `--plan-sha`
and the same settings/group only after spending is authorized. Live calibration
runs the offline case gates first: hard failures block, unknown winnability and
warnings remain distinct. `--spending-budget` and
`--executor-timeout-seconds` also apply; see [shared planning](experiment-workflow.md).
The spending object is optional; once supplied, all five limits are mandatory.
Known missing token/cache readers block it before calls; runtime unknown/partial
usage stops subsequent calls, and one in-flight call can exceed a line.

## 3. Run, inspect, and share

```bash
node dist/cli.js eval <skill-dir> --bench <bench-dir> --agent codex --trials 5
node dist/cli.js report eval <manifest-path>
```

The first command creates a new directory under `runs/` and prints its `Manifest:` path. Use that
exact path for the second command; the report command is read-only. Each task and trial has an
`_output.md`, `_verifier.txt`, and `_result.json` beside the summary manifest. Keep the manifest and
the pinned target and bench hashes so another person can inspect the same result. Review those files
for private paths or content before sharing. In 0.10.1, the report also accepts
the native run directory or a portable package directory, with the same audit
and acceptance result as `--json`. Stopped runs retain their available costs and
stay ineligible. See [report formats](../reference/evaluation-reports.md).

Read the **errors** first: a pair with an executor or verifier error was not graded, and neither arm
gets a failure for it. Then inspect baseline ceiling/floor warnings, the number and direction of
discordant pairs, the exact McNemar p-value, and the paired confidence interval. The verdict is a
statistical statement about this bench. If the run is below 8 tasks × 5 trials, the report labels
its scale *indicative* even when its exact-test verdict is `effective` or `ineffective`; do not turn
that into a broad efficacy claim. The [metrics protocol](../reference/metrics.md) defines the full interpretation.

When the paired result is useful, run `--mode trigger` separately to ask whether the agent would
load the Skill on its own. Trigger mode has one arm and defaults to five trials per task.
Other installed Skills are excluded by default, so recall is an optimistic estimate. Add
`--compete-installed` to copy other user-level Skills from the matrix directories;
system Skills and plugins outside those directories remain excluded. Share paired and
trigger results separately. Version 0.11.0 reads both through `report eval`, with distinct JSON kinds and metrics;
calibration directories or `_calibration.json` also work. See [report types](../reference/evaluation-reports.md#calibration-and-trigger-reports-source-after-npm-0101).
Single-arm reports do not enter the paired acceptance policy or authorize upgrades.
Trigger recall is a mechanical observation, not a paired comparison of loading
versus not loading the Skill. The current protocol retains unknown/incomplete
streams explicitly; historical counts keep their recorded detection protocol.

Version 0.11.0 also supports `--json --dry-run`, repeated `--task`,
spending lines and a per-call deadline. Confirm its ordinary `plan.sha256` and
explicit fresh `--run-group` for JSON execution. Only selected labeled tasks
count toward calls; retain negative controls. Trigger already presents files on
disk, so omit `--input`. Calibration/trigger native runs can be audited through
`report eval`, replayed with `--replay` and exported to a fresh directory. This
reuses saved observations and trusted verifier code; it does not make the study
independent or query an agent again. Historical summaries or runtimes without
the required evidence/replay support cannot be upgraded by rendering them.

If you enable a judge for a paired inject experiment, the source records both
judge orders and separate Agent/judge/total invocation costs. Its calls consume
the same whole-batch spending lines. An explicitly enabled API judge with
missing credentials fails before calls; login validity remains unknown offline.
Read [cost coverage](../reference/evaluation-reports.md) before treating a known total as complete.

New trigger manifests record both the injectable-text hash and a separate full installed-file hash,
including scripts and binary resources. Keep the Skill directory unchanged while the experiment runs;
every installed copy is verified before the agent starts. Nested symbolic links are unsupported: copy
their resources into the Skill directory first. Older trigger manifests did not record the full
installed hash; their injectable hash alone cannot identify all resources used by the agent.

Previous source documentation: [fixed snapshot](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/first-real-eval.md).
