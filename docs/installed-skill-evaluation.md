# Paired evaluation of an installed Skill

skillfit is a TypeScript CLI run by Node.js 22 or newer. `npx skillfit` installs the published package. A source checkout still uses `npm ci`, then `npm run build`.
The core uses only Node built-ins. Shell/Python scripts may be optional resources of
the Skill being evaluated; skillfit neither installs their runtimes nor requires
them for its own CLI. Package publication is separate from local evaluation.

## Choose the measurement

| Mode | Treatment | Question |
| --- | --- | --- |
| `inject` (default) | Markdown/YAML/JSON content appended to the task prompt | Does the supplied content help when presented? |
| `installed` | Complete Skill directory copied into the disposable treatment project | Does native discovery plus the complete Skill help this task? This does not separate a description-catalog hit from a later read of the long body. |
| `trigger` | The Skill under test alone, in single-arm workspaces | Is that one Skill read on relevant and irrelevant requests? Recall is an upper bound. Codex counts a `SKILL.md` read, not a Skill-invocation event. |

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

With `--baseline-skill <previous-dir>`, baseline instead receives the previous
complete version and treatment receives the target version. Both frontmatter names
must match and their complete-resource hashes must differ. This option requires
`--mode installed`; inject and single-arm trigger runs reject it. The source guards,
fixture-contamination checks, paired error exclusions and call budgets remain in
force. See [comparing Skill revisions](skill-revisions.md) for the independent
development/validation workflow and interpretation.

Both arms receive identical natural task prompts. All regular resources, including
scripts, hidden files and binary assets, are copied only into treatment by default,
or from the respective version into both arms with `--baseline-skill`. The
fingerprint includes sorted relative paths and bytes, not permissions or empty
directories. Unsafe install paths, nested source symlinks, destination symlinks,
existing evaluated-Skill fixture destinations in any matrix project search directory
(including a custom installation override) and source drift are rejected.
The copied fingerprint is verified before each affected call. Keep the source
unchanged until the run finishes. As with existing experiments, a fixture copy is
the backup; outputs go to fresh run directories that cannot overwrite prior runs.

Command tasks also require Git. Disposable initialization explicitly enables and
verifies reflog before execution; unavailable Git initialization/reflog is an
environment error, with its pair excluded from statistics. Global Git settings
are not changed.

## Read the evidence

Compatible v4 manifests add `skillDelivery: {mode: "installed", installDir: ...}`.
`target.files` and `target.bundleSha256` describe **all installed resources** in
this mode, rather than the injection-only text bundle. Old manifests without
delivery metadata retain their prior interpretation. Statistics and verdicts are
unchanged; small studies remain indicative.

Revision comparisons add `baselineTarget` with the previous Skill's name, source,
complete-resource file list and SHA-256 hash. `target` continues to identify the
treatment. Each `_result.json` identifies the version actually installed in that
arm. Manifests without `baselineTarget` retain the existing baseline interpretation.

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

New paired installed runs include the identical native diff helper at
`_skillfit/native-diff.cjs` and common usage guidance in both conditions. Use
`node _skillfit/native-diff.cjs <file>` for an untracked-file patch. It runs Git
directly without an output filter; a displayed difference may return exit 1.
Its version/content are frozen in the plan and manifest, with sealed source
`_native-diff.cjs`. Modifications stop further calls. This corrects the shared
environment without changing global RTK, PATH or shell configuration. Delivery
does not attest usage. Do not pool old-environment results into a new validation
cohort; all invocation costs remain included.

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
