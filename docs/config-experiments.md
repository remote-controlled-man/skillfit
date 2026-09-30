# Rules and MCP experiments

`skillfit eval` accepts either a Skill directory or a workspace-configuration experiment. A
configuration experiment changes real project files between paired runs while keeping the task
prompt and fixture snapshot identical. Use it to measure rules files such as `AGENTS.md` and MCP
project configuration such as `.codex/config.toml`.

## 1. Preflight an MCP server

Create a local JSON file describing a stdio server. The optional `env` object is passed only to the
child process. Keep credentials in inherited environment variables whenever possible; do not commit
secrets in the spec.

```json
{
  "schemaVersion": 1,
  "name": "my-server",
  "transport": "stdio",
  "command": "node",
  "args": ["/absolute/path/to/server.mjs"],
  "env": {},
  "timeoutMs": 10000
}
```

Inspect the plan, then run the read-only discovery check:

```bash
skillfit mcp check ./my-server.probe.json --dry-run
skillfit mcp check ./my-server.probe.json
```

The check starts the server, performs the MCP initialization handshake, requests `tools/list`, and
audits unique tool names, descriptions, input schemas, and annotations. It never calls a tool. This
separates protocol or catalog defects from model behavior.

The built-in probe currently supports newline-delimited stdio MCP servers compatible with the
2025-11-25 initialization lifecycle. Streamable HTTP and the 2026 stateless lifecycle remain future
work.

## 2. Build the paired experiment

Create a directory with this shape:

```text
context7-experiment/
├── skillfit-experiment.json
├── baseline/                 # optional
│   └── .codex/config.toml
└── treatment/
    └── .codex/config.toml
```

`skillfit-experiment.json`:

```json
{
  "schemaVersion": 1,
  "name": "context7",
  "kind": "mcp",
  "baseline": "baseline",
  "treatment": "treatment"
}
```

Valid kinds are `mcp` and `rules`. `baseline` is optional; omit it to compare against the untouched
bench fixture. `treatment` is required and must contain at least one file. Both paths must stay inside
the experiment directory.

The treatment must use the selected agent's project path from
[`src/matrix/agents.json`](../src/matrix/agents.json):

| Agent | Rules path | MCP path |
|---|---|---|
| Codex CLI | `AGENTS.md` | `.codex/config.toml` |
| Claude Code | `CLAUDE.md` | `.mcp.json` |
| Kimi Code | `AGENTS.md` | `.kimi-code/mcp.json` |

Each overlay may contain only the selected agent's matrix-defined project configuration files.
skillfit rejects source code, tests, fixtures, and other files in an overlay so the treatment cannot
smuggle a solution into the task workspace.

Do not store tokens in an overlay. Reference environment variables from the agent's configuration
format and provide them only in the local process environment.

## 3. Measure task lift

```bash
skillfit eval ./context7-experiment --bench ./my-context7-bench --agent codex --trials 5 --dry-run
skillfit eval ./context7-experiment --bench ./my-context7-bench --agent codex --trials 5
```

For every task and trial, skillfit copies the same fixture into both arms. It snapshots the fixture
for the task prompt, then applies the arm's overlay. Configuration contents are therefore absent from
the prompt snapshot. The local agent CLI discovers rules or MCP through its normal project loader.

The resulting schema-v4 manifest records target kind, name, content hash, overlay file list, bench
hash, executor, tokens, per-task outcomes, confidence intervals, and verdict. The same verifier and
statistical protocol used for Skill experiments applies.

## What a useful MCP bench measures

- task success, with and without the server;
- whether the model selected the right MCP tool;
- false tool selection on same-domain negative controls;
- tool and authentication errors;
- token and latency cost when those values are observable;
- read/write confirmation behavior for tools with side effects.

Keep live systems read-only during early experiments. Prefer a local fixture server or a disposable
account when a deterministic oracle is possible.
