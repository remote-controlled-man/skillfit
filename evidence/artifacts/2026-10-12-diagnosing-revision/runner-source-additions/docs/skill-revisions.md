# Compare two Skill versions

Use a paired installed experiment to check a proposed Skill revision against its
previous version. This is a comparison workflow, not an automatic acceptance gate.
The existing statistical verdict measures the aggregate task effect; an observed
regression still deserves review even when the aggregate favors the new version.

## Prepare independent evidence

Keep the previous and proposed Skill directories outside bench fixtures. Preserve
the same root `SKILL.md` frontmatter `name` in both versions. The complete-resource
fingerprints must differ; changes to scripts, hidden files and binary assets count.
Both versions are copied into the same matrix-defined project Skill location in
their respective disposable workspaces, without changing user-level configuration.

Start from independent issue requirements and real failures. The existing
[lru-cache replay](../benches/contrib/oss-lru-cache/README.md) is one source of
independently sourced tasks; its difficulty and suitability still need calibration.
Add relevant success cases, alternative valid solutions and tasks where the Skill
should not intervene. Retain saturated tasks as regression controls. Use
[bench authoring](bench-authoring.md) to freeze fixtures and keep hidden graders and
reference solutions outside agent workspaces. Run the offline NOP/oracle gates:

```bash
node dist/cli.js bench check ./my-bench
```

Use development cases to propose the revision, then lock a separate validation
task set and trial count before evaluating it. Do not choose successive versions
against the same held-out tasks or add trials until significance appears. Keep
the outcome verifier unchanged between arms. A Skill-derived process checklist
can diagnose behavior; it cannot replace independent task-correctness checks.

## Review the plan and run

```bash
node dist/cli.js eval ./skill-new --baseline-skill ./skill-old --mode installed --bench ./my-bench --agent codex --trials 5 --dry-run
node dist/cli.js eval ./skill-new --baseline-skill ./skill-old --mode installed --bench ./my-bench --agent codex --trials 5
node dist/cli.js report eval ./runs/<run-group>/manifest.json
```

The first command is read-only and does not start an agent. Review the task set,
both fingerprints and declared calls before running the second command. Eight
tasks at five trials per arm need 80 agent calls; enabled judges add two calls per
pair. `--max-calls` rejects an over-budget plan without truncating it. Inject mode
and single-arm trigger mode reject `--baseline-skill`.

Natural prompts and fixtures are identical across arms. Baseline installs the
previous complete Skill; treatment installs the proposed complete Skill. Neither
Skill is force-injected. Check for global copies of the evaluated Skill and
inherited configuration before running; disposable workspaces do not isolate the
agent's full environment. Source/configuration drift stops further actual calls.

## Inspect the change

The v4 manifest retains the treatment identity in `target` and adds the previous
identity in `baselineTarget`, including source directory, file list and full hash.
The frozen plan pins both input directories. Each trial's `_result.json` identifies
the version installed in its arm; available transcripts and mechanical Skill-read
observations remain separate from task results. Old manifests without
`baselineTarget` keep their original interpretation.

Review per-task pass changes, graded checks, errors, token coverage, confidence
intervals and both improved and regressed pairs. The report lists observed task
regressions for real executor results. Read detection does not establish that an
instruction was followed or caused a result. Separate labeled trigger studies are
still needed for positive and negative routing cases.

No acceptance threshold or non-inferiority claim is introduced. An inconclusive
result does not prove equivalence or absence of harm. A positive revision delta
does not establish installation benefit over no Skill, and historical success
does not guarantee behavior on unseen tasks. For installation benefit, declare a
separate installed experiment without `--baseline-skill`. See the frozen
[metrics protocol](metrics.md) and [bounded workflow](experiment-workflow.md).

The motivation follows [Skill-V](https://arxiv.org/abs/2610.11781): skill changes
should be traceable to evidence and checked against existing behavior. This CLI
workflow evaluates independent task outcomes with a fixed agent configuration;
it does not reproduce that paper's reinforcement-learning training or contract
evolution experiments.
