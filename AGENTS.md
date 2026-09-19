# AGENTS.md — skillfit development

## What this is

Evidence-driven configuration CLI for AI coding agents. Four commands: `doctor` (read-only health check), `eval` (paired A/B experiment harness + trigger mode), `bench` (scaffold + offline validation), `install` (idempotent, dry-run-first writer). Supports Claude Code, Codex CLI, Kimi Code.

## Commands

```bash
npm test          # build (tsc) + all tests — must be green before any commit
npm run build     # compile only
node dist/cli.js doctor    # smoke against the real machine (read-only)
```

## Hard rules

- **Zero runtime dependencies.** Node built-ins only. New devDependencies need a stated reason in the PR.
- ESM + `module: NodeNext`: relative imports carry the `.js` suffix.
- All agent-specific paths/behaviors come from `src/matrix/agents.json` — never hardcode a path in command code. Matrix edits require a `verifiedAt` bump and a docs link.
- Every write operation: dry-run plan first, backup before write, verify after write. No exceptions.
- Tests are `node:test`, offline, and must never call a real model API or agent CLI — use `MockExecutor` / injected fs roots.
- Verdict semantics and the statistical protocol are frozen in `docs/metrics.md` — change the doc and the code together.
- User-facing CLI output is English. README/docs are multilingual: README.md is the English source of truth; README.zh-CN.md, README.ja.md, README.ko.md, README.es.md mirror it section-by-section (badges, code blocks, and the demo console block stay verbatim in every language).

## Layout

- `src/commands/` — doctor / eval / install / bench entry points (thin shells over testable functions)
- `src/harness/` — eval experiment engine (executors, bench loading, judge, runner, trigger mode, stats)
- `src/matrix/agents.json` — agent capability matrix (the data-driven core)
- `benches/` — public bench format + bundled benches
- `docs/` — design contracts (`metrics.md` freezes the metrics and verdict protocol)
- `profiles/` — installable profiles (deny-by-default manifests)
- `evidence/` — published experiment reports, dated and pinned
- `runs/` — local eval output, gitignored

## Boundaries

- `/workspace4skills/` (gitignored) is the author's private lab. Never commit it, never read it in CI, never run `git clean -fdx` — it would delete that directory.
- Evidence pages are append-only once published; corrections go in new dated entries.
