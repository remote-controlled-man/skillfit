# Contributing

Thanks for helping make agent configuration evidence-driven.

## The highest-value contributions

1. **A bench from your real workflow.** The fastest paths in: `skillfit bench init` for a scaffold, `skillfit bench add --freeze` to capture a failure you just watched, `skillfit bench add --from-commit` to mine a fix from git history, then `skillfit bench check [--calibrate]` before submitting under `benches/contrib/<name>/`. See [benches/README.md](benches/README.md) for the format and the determinism/self-containment rules.
2. **Reproductions.** Run an existing evidence experiment on your model/agent and report agreement or disagreement (as an issue with your `manifest.json` attached).
3. **Agent matrix corrections.** Vendor config surfaces change fast. If `src/matrix/agents.json` is stale, a PR with the official docs link and a `verifiedAt` bump is always welcome.

## Ground rules

- **Zero runtime dependencies** is a hard rule. Discuss in an issue before proposing one.
- `npm test` must be green. Tests are `node:test`, offline, and never call a real model API or agent CLI — use `MockExecutor`, injected executors, or injected fs roots.
- Verdict semantics and the statistical protocol are frozen in [docs/metrics.md](docs/metrics.md); change the doc and the code together.
- PRs must describe *observable* changes: what the CLI printed/did before and after.
- AI-generated PRs are welcome, but say so, and you are responsible for having run the code. Unverifiable PRs will be closed without review.
- **Never run `git clean -fdx` in your clone** if you keep a local `workspace4skills/` lab directory — it deletes ignored directories.

## Submitting evidence

We do not accept unverifiable numbers ("skill X gave me +20%"). Submit the reproducible configuration instead (use the **Evidence submission** issue template):

1. Your bench (or a reference to an existing one)
2. The skill source pinned to a commit
3. The executor/agent + model identity + trials count

Maintainers re-run it in CI; the published evidence entry credits you. There is also an opt-in scheduled re-run: `.github/workflows/watch.yml` re-executes a pinned eval weekly once the repository has `SKILLFIT_API_KEY` (secret) and `SKILLFIT_WATCH=1` (variable), so evidence gets refreshed as models change — disabled by default.
