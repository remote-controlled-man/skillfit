# AGENTS.md — skillfit development

## Project and layout

Evidence-driven configuration CLI for Claude Code, Codex CLI, and Kimi Code. Uses TypeScript and Node.js 22+. See `node dist/cli.js --help` for commands.

- `src/cli/` and `src/composition.ts` — parsing, presentation, confirmation and concrete host wiring.
- `src/resources/`, `src/agents/`, `src/bench/`, `src/usage/` — owned resource, execution, task and observation interfaces.
- `src/evaluation/` — application, temporary targets, execution, measurement and records.
- `src/configuration/` — real install/setup/bundle transactions and rollback; `src/shared/` — generic mechanisms.
- `src/commands/` and `src/harness/` — fixed installed-recipe/replay delegates and six retained test entries; add new work under its canonical owner.
- `src/matrix/agents.json` — agent capability matrix.
- `benches/` and `skills/` — public bench format, bundled benches, and the CLI driver skill.
- `docs/` — grouped guides/reference/maintainer contracts; update the sole plan in `docs/work/current.md`.
- `tools/{verify,release}/` — local gates and release proof generation.
- `profiles/` — deny-by-default install manifests; `codex-curated` is the public selectable source profile.
- `runs/` — gitignored local evaluation output; exports and release receipts use explicit external destinations.

## Skill routing

- When using skillfit for Skill/MCP selection, installation, usage analysis, trigger checks, or effectiveness comparisons, read [the skillfit driver](skills/skillfit/SKILL.md) immediately after the applicable project instructions, before browsing source, historical evidence, or run output, or invoking the CLI. Complete that read before choosing further commands; follow its command-selection, spending, and interpretation rules within the current authorization. For these usage tasks, the driver route takes precedence over the generic coding-skill suite.
- For development of skillfit itself, use applicable global coding skills together with this file's development and offline-test requirements. Editing evaluation code or researching evaluation options does not authorize real model evaluations.

## Commands and completion

```bash
npm ci                      # install development dependencies from the lockfile
npm run build               # compile and type-check TypeScript
npm test                    # build + all offline tests
node dist/cli.js doctor     # optional read-only smoke against the real machine
```

- Run `npm test` before delivering code/build changes and before any commit. Documentation-only edits require checking facts, links, and the diff; validate executable examples when changed. No lint or formatter script is currently configured.
- For bench changes, follow [docs/guides/bench-authoring.md](docs/guides/bench-authoring.md) and run `node dist/cli.js bench check <bench-dir>`. See [.github/workflows/ci.yml](.github/workflows/ci.yml) for additional checks relevant to the affected behavior.
- Fix failures caused by the change and rerun affected checks. Report actual results, pre-existing failures, and unavailable checks; do not weaken assertions or claim a skipped check passed. PRs follow [CONTRIBUTING.md](CONTRIBUTING.md), including observable before/after behavior and AI disclosure.

## Code and contracts

- Keep business dependencies and bounded effects enforced by `tools/verify/check-architecture.mjs`; use owner interfaces rather than private Agent adapters. Shared takes explicit process signals; CLI owns OS signal listeners, exit behavior and prompts.
- Generated runs/receipts stay in explicit ignored workspaces. Do not add executable recipes to docs or a repository evidence/archive tree. Release verification never imports repository records or restores old studies.
- **Zero runtime dependencies:** use Node built-ins to keep the shipped CLI self-contained. New devDependencies need a stated reason in the PR; proposals to change the runtime-dependency policy require prior discussion per [CONTRIBUTING.md](CONTRIBUTING.md).
- Use ESM with `module: NodeNext`; relative imports carry `.js` so compiled imports resolve in Node.
- Agent-specific paths and behaviors come from `src/matrix/agents.json`, rather than command-local constants, to avoid divergent agent support. Matrix edits require a `verifiedAt` bump and an official docs link.
- Tests use `node:test` and stay offline: use `MockExecutor`, injected executors, or injected fs roots instead of real model APIs or agent CLIs, keeping runs deterministic and free of live costs or configuration changes.
- Verdict semantics and the statistical protocol are frozen contracts in [docs/reference/metrics.md](docs/reference/metrics.md). When a task changes either, update code and documentation together so historical results remain interpretable.
- User-facing CLI output is English. README.md is the English source of truth; README.zh-CN.md mirrors it section-by-section. Keep badges, code blocks, and the demo console block verbatim; localize text-bearing SVGs per README and share the text-free logo.

## Write scope and protected data

- **CLI configuration writers** (`install`, `setup`, and generated bundle installers): plan before applying, support dry runs, require confirmation or `--yes`, back up existing targets before changing them, and verify after writing. Preserve the installer's rollback on write or validation failure; these safeguards protect users' existing agent configuration.
- **New bench/run/bundle artifacts:** preserve collision checks and existing outputs. A fresh output has no previous content to back up; eval workspaces use disposable fixture copies. Keep these separate from writes to actual user configuration.
- **Repository source and documentation edits:** use Git diffs and relevant checks, preserving unrelated user work. The configuration-writer backup and confirmation flow does not apply to routine repository edits.
- `workspace4skills/` at the repository root is the author's gitignored private lab. Keep it out of commits and CI reads. Do not run `git clean -fdx` in this checkout: it deletes ignored directories, including that lab.
- Published evidence bytes remain immutable at their fixed Git commits; current source does not maintain a historical archive catalog or restorer. Preserve current saved-result readers and portable replay. New retained Bench inputs need a reusable task or current regression consumer; generated runs/reports do not belong in benches. Corrections link the original observation.

## Workflow and authorization

- For complex changes, give a short plan, implement, check, and fix until the relevant checks pass or a concrete blocker remains. Routine reversible edits can proceed directly.
- Ask when unresolved ambiguity materially affects scope or correctness, or when a needed action exceeds existing authorization (for example, real paid evaluations, changing actual user configuration, publishing, or breaking a public CLI/output/manifest contract). Prepare the plan, diff, or dry run first; continue independent local work while awaiting the decision.
