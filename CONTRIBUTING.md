# Contributing

Thanks for helping make agent configuration evidence-driven.

## Development setup

Use Node.js 22+, npm and Git. Run these commands from the repository root on
the checkout you want to change; the README's detached snapshot is a reproducible
user walkthrough, not the development branch:

```bash
npm ci
npm run build
node dist/cli.js --help
npm test
```

The build creates `dist/`; `npm test` rebuilds and runs all offline tests,
including documentation and package checks. No agent credentials are needed.
There is no separate lint or formatter script. For module ownership, start with
[architecture and maintenance](docs/maintainers/architecture.md).

For a bug, search [existing issues](https://github.com/remote-controlled-man/skillfit/issues)
and use the bug-report template with a minimal reproduction, expected/actual output
and relevant versions. Use [SECURITY.md](SECURITY.md) for private security reports.

## The highest-value contributions

1. **A bench from your real workflow.** Read the [bench authoring guide](docs/guides/bench-authoring.md) for scaffolding with `bench init`, capturing failures with `bench add --freeze` and importing fixes with `bench add --from-commit`. Run `node dist/cli.js bench check <bench-dir>` offline before submitting a reusable task under `benches/contrib/<name>/`. Follow the [format and self-containment rules](benches/README.md). Calibration is separate: `--calibrate` calls a real agent, can cost money and is not an offline contribution prerequisite. Preview and authorize any live work separately.
2. **Reproductions.** Share a configuration and reviewed saved-run manifest that others can inspect and replay; report agreement, disagreement and unknowns. A new live run is optional and can incur model costs. Use the [experiment workflow](docs/guides/experiment-workflow.md) for execution and retention, and the [report reference](docs/reference/evaluation-reports.md) for portable offline replay.
3. **Agent matrix corrections.** Vendor config surfaces change fast. If `src/matrix/agents.json` is stale, a PR with the official docs link and a `verifiedAt` bump is always welcome.

## Ground rules

- **Zero runtime dependencies** is a hard rule. Discuss in an issue before proposing one.
- Run `npm test` for code/build changes and before any commit. Tests are `node:test`, offline, and never call a real model API or agent CLI — use `MockExecutor`, injected executors, or injected fs roots.
- Verdict semantics and the statistical protocol are frozen in [docs/reference/metrics.md](docs/reference/metrics.md); change the doc and the code together.
- Follow [architecture and maintenance](docs/maintainers/architecture.md) for module boundaries, document ownership and version scope. Update the canonical guide and its affected dependents. Migrate current links when consolidating pages and link the exact historical snapshot for old explanations; preserve bilingual README blocks and frozen evidence bytes. Documentation-only changes need facts, links and diff review; code/build changes require the offline suite.
- PRs must describe *observable* changes: what the CLI printed/did before and after.
- AI-generated PRs are welcome, but say so, and you are responsible for having run the code. Unverifiable PRs will be closed without review.
- **Never run `git clean -fdx` in your clone** if you keep a local `workspace4skills/` lab directory — it deletes ignored directories.

## Before submitting a change

Keep the diff focused on one observable improvement and add a regression check
when behavior changes. Describe the problem, before/after behavior and actual
validation in the PR; state any unavailable checks. Follow the AI disclosure rule
above. Repository edits do not require the CLI configuration installer's backup
or confirmation flow.

For documentation, update the existing page that owns the topic and its affected
links. Keep the English and Chinese READMEs aligned, including identical badges
and command/demo blocks. Run `node tools/verify/check-docs.mjs` for links, anchors,
version-sensitive link pinning, repository layout and bilingual structure; check
facts and execute changed examples too. This gate does not check arbitrary external
URL availability or factual claims.

## Submitting evidence

We do not accept unverifiable numbers ("skill X gave me +20%"). Submit the reproducible configuration instead (use the **Evidence submission** issue template):

1. Your bench with its content hash, negative controls, and the complete offline `bench check` summary (including the NOP and oracle gates)
2. The Skill pinned to a commit and content hash, or the rules/MCP overlay with its hash
3. The exact command, harness commit, agent CLI/version, served model identity when available, and trials per condition
4. The reviewed manifest, result, and limitations (including saturation, errors, and unavailable model identity). Inspect task content, paths and transcripts for private data before sharing.

Keep generated runs and reports outside the tracked Bench inputs; do not add a
repository evidence/archive tree. Retain shared results at an explicit external
destination with their pinned inputs and provenance. Published observations remain
immutable; publish a correction separately and link the original.

PR CI validates bench integrity offline and never calls an agent. A live
reproduction requires separate credentials and cost authorization. The optional
`.github/workflows/watch.yml` runs weekly only when `SKILLFIT_WATCH=1` is enabled
and `SKILLFIT_API_KEY` is configured; it is disabled by default and is not a
contribution check.
