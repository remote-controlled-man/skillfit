# Paired evaluation of an installed Skill

skillfit is a TypeScript CLI distributed through npm and run by Node.js 22 or newer.
The core uses only Node built-ins. Shell/Python scripts may be optional resources of
the Skill being evaluated; skillfit neither installs their runtimes nor requires
them for its own CLI. Package publication is separate from local evaluation.

## Choose the measurement

| Mode | Treatment | Question |
| --- | --- | --- |
| `inject` (default) | Markdown/YAML/JSON content appended to the task prompt | Does the supplied content help when presented? |
| `installed` | Complete Skill directory copied into the disposable treatment project | Does native discovery plus the complete Skill help this task? |
| `trigger` | Complete Skill available in single-arm workspaces | Is it read/invoked on relevant and irrelevant requests? |

```sh
skillfit bench check ./my-bench
skillfit eval ./my-skill --bench ./my-bench --agent codex --mode installed --trials 1 --dry-run
skillfit eval ./my-skill --bench ./my-bench --agent codex --mode installed --trials 1
skillfit report eval ./runs/<run-group>/manifest.json
```

Installed mode requires a Skill with root `SKILL.md`, frontmatter `name` and
`description`, and a CLI executor with filesystem access. It selects workspace
input automatically; explicit snapshot input and API executors are rejected.
The destination comes from the agent capability matrix's first project Skill
directory. No global configuration or global Skill directory is written.

Both arms receive identical natural task prompts. All regular resources, including
scripts, hidden files and binary assets, are copied only into treatment. The
fingerprint includes sorted relative paths and bytes, not permissions or empty
directories. Unsafe install paths, nested source symlinks, destination symlinks,
existing evaluated-Skill fixture destinations and source drift are rejected.
The copied fingerprint is verified before each affected call. Keep the source
unchanged until the run finishes. As with existing experiments, a fixture copy is
the backup; outputs go to fresh run directories that cannot overwrite prior runs.

## Read the evidence

Compatible v4 manifests add `skillDelivery: {mode: "installed", installDir: ...}`.
`target.files` and `target.bundleSha256` describe **all installed resources** in
this mode, rather than the injection-only text bundle. Old manifests without
delivery metadata retain their prior interpretation. Statistics and verdicts are
unchanged; small studies remain indicative.

Per-trial `_result.json` records delivery and nullable `skillTriggered`. When the
executor returns a raw stream, `_transcript.jsonl` preserves it. Built-in installed
execution uses the matrix's JSON stream when available. Read detection is a
mechanical observation, not proof that every instruction/resource was applied;
`null` is unavailable evidence, not non-use. Native discovery does not guarantee
activation. Separate positive and negative trigger cases remain necessary.

The disposable workspace is **not an isolated agent configuration**: inherited
user rules, Skills, MCP tools, model configuration and ancestor paths may apply.
Check baseline contamination and record the effective environment. A Skill name
already installed globally can invalidate the comparison even when fixture checks
pass. No sandbox, network isolation or toolchain-installation guarantee is made.

## Bench selection before installation

Use an unrelated real failure with an independent verifier and reference solution.
Run the offline NOP/oracle gates and baseline difficulty calibration before a
predeclared paired study. A saturated baseline is regression evidence, with no
observed headroom for lift. Add representative tasks before adding repetitions.
Inspect paired errors, facets, token coverage, activation and uncertainty together.

The bundled [Waza behavior diagnostics](../benches/contrib/waza-behavior/README.md)
demonstrate holds and current/stale evidence checks. They derive from Waza's own
contracts, so they cannot independently establish Waza's installation benefit.
The [real UTF-8 replay](../benches/contrib/oss-mcp-use-utf8/README.md) remains a
workflow regression example: its earlier baseline already passed all facets.
