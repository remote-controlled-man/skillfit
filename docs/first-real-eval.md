# Your first real evaluation

The offline `bench check` proves that a task's verifier rejects the untouched fixture. When an
oracle is registered, it also checks that the reference solution passes; without one, it warns that
the task's winnability is unverified. It does not measure an agent. A paired `eval` calls your agent on both arms
and records what actually happened. This guide applies to macOS, Linux, and Windows; use the native
`node dist/cli.js` commands from a built source checkout in either Bash or PowerShell.

## 1. Choose a claim and a bench

Choose one Skill, rules file, or MCP setup and one task family where it should help. Prefer tasks
frozen from failures you actually encountered. For a Skill, use the directory that contains its
`SKILL.md`; for rules or MCP, use the experiment directory described in
[config-experiments.md](config-experiments.md). Do not select or write tasks by reading the Skill
under test: that can make the result look good because the test matches its wording.

The bundled `debugging` bench has 8 tasks; `code-review` has 5. They are examples, not a substitute
for your own work. The predeclared scale bar is **8 distinct tasks × 5 trials per condition**. On an
8-task bench, that is **80 agent executions** before any optional judge calls. Five repetitions are a
starting point, not a guarantee of enough statistical power. More independent, representative tasks
usually improve the scope of a claim more than repeating one narrow fixture again. A 20-task bench
at the default would make 200 agent executions, so inspect the plan before starting.
Fix the task list and trial count before viewing results. If an exploratory run is too noisy, design
a separate confirmatory run with a predeclared size; repeatedly adding trials until p < 0.05 makes
the final p-value misleading.

## 2. Check the bench and the environment

```bash
node dist/cli.js bench check <bench-dir>
node dist/cli.js eval <skill-dir> --bench <bench-dir> --agent codex --dry-run
```

Replace `<skill-dir>` and `<bench-dir>` with real paths and `codex` with your agent ID. The dry run
prints task count, target and bench hashes, executor, estimated prompt size, and the total execution
count. It does not call an agent or create `runs/`. The estimate is not a price quote: replies,
tool calls, and retries can add substantial time and tokens. An optional judge also calls a model.

Before paying for a run, check whether the target Skill is already available globally to your
agent, or whether global rules/MCP settings supply the same treatment in both arms. If so, the
baseline may already be exposed to the configuration, making the comparison uninterpretable. Use
a controlled agent profile for the experiment and record its relevant global configuration; skillfit
does not automatically remove the user's configuration. `doctor` and `report` are read-only aids,
but neither proves that an agent actually ignored a globally installed Skill during an eval.

For Codex CLI, skillfit explicitly starts both paired and trigger trials with
`--sandbox workspace-write`. The agent can edit its disposable trial directory, which command-graded
tasks require. Check any extra writable roots in your Codex configuration before a run. Codex still
takes its model, reasoning level, and other settings from the active CLI configuration. Record those
settings alongside the manifest when comparing runs, and use the same configuration for both arms.

## 3. Run, inspect, and share

```bash
node dist/cli.js eval <skill-dir> --bench <bench-dir> --agent codex --trials 5
node dist/cli.js report eval <manifest-path>
```

The first command creates a new directory under `runs/` and prints its `Manifest:` path. Use that
exact path for the second command; the report command is read-only. Each task and trial has an
`_output.md`, `_verifier.txt`, and `_result.json` beside the summary manifest. Keep the manifest and
the pinned target and bench hashes so another person can inspect the same result. Review those files
for private paths or content before sharing.

Read the **errors** first: a pair with an executor or verifier error was not graded, and neither arm
gets a failure for it. Then inspect baseline ceiling/floor warnings, the number and direction of
discordant pairs, the exact McNemar p-value, and the paired confidence interval. The verdict is a
statistical statement about this bench. If the run is below 8 tasks × 5 trials, the report labels
its scale *indicative* even when its exact-test verdict is `effective` or `ineffective`; do not turn
that into a broad efficacy claim. The [metrics protocol](metrics.md) defines the full interpretation.

When the paired result is useful, run `--mode trigger` separately to ask whether the agent would
load the Skill on its own. Trigger mode has one arm and uses 5 trials per task by default. It does
not yet reproduce competition from the user's whole installed Skill set, so its recall is an
optimistic estimate. Share the paired and trigger manifests separately; `report eval` currently
renders paired schema-v4 manifests only.
