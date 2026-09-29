# Portable Codex setup

`skillfit bundle export` captures user-level Skills that Codex has used in at least two distinct local sessions and the active global guidance. It writes a self-contained profile directory with a Node.js installer. The export is a local copy of the files currently installed, so their contents stay fixed when upstream repositories change.

```bash
skillfit bundle export ./personal-codex --dry-run
skillfit bundle export ./personal-codex --yes
# transfer the personal-codex directory to the new machine
node ./personal-codex/setup.mjs --dry-run
node ./personal-codex/setup.mjs --yes
```

The export includes `profile.json`, `rules/global.md`, each selected Skill directory with its scripts, references, licenses, and other regular files, plus `setup.mjs` and the dependency-free installer runtime. Installer backup and recovery files are omitted. The destination needs Node.js 22 or newer; skillfit does not need to be installed there. Running `node setup.mjs` without flags prints a plan and asks before writing. To choose a specific set instead of usage-based selection, repeat `--skill <name>`. To change the usage threshold, pass `--min-sessions <n>`. A dry run writes nothing. Export refuses an existing destination directory; choose a new name to keep previous snapshots intact. Skills with `agents/openai.yaml` policy `allow_implicit_invocation: false` stay in the bundle and are identified as user-invoked-only in the generated guidance.

## Fetch reviewed upstream Skills on the new machine

Pass `--upstream-lock` to select all GitHub Skills in that lock as commit-pinned source references, plus the lock's `localSkills`. The GitHub Skills need not already be installed on the exporting machine; local Skills are copied from it. Repeated `--skill <name>` flags add further local Skills. The lock lists every upstream file and its SHA-256; setup downloads directly from `raw.githubusercontent.com`, verifies each file and its invocation policy, prepares an isolated local profile, then runs the normal install planner. A missing file, policy conflict, or hash mismatch stops setup before any target file is changed. Setup supports `--dry-run`, `--strict`, and `--yes`. The dry run fetches and verifies upstream files but does not write to the Codex configuration.

```bash
skillfit bundle export ./personal-codex --upstream-lock ./profiles/codex-upstream-sources.json --dry-run
skillfit bundle export ./personal-codex --upstream-lock ./profiles/codex-upstream-sources.json --yes
# transfer the personal-codex directory to the new machine
node ./personal-codex/setup.mjs --dry-run
node ./personal-codex/setup.mjs --yes
```

The included [Codex source lock](../profiles/codex-upstream-sources.json) identifies 65 public Skills from their authors' GitHub repositories and two locally authored Skills. `edit-article` is pinned to its last available revision because it is absent from the current `mattpocock/skills` tree. The source lock is a reviewed version selection, not a request to follow a moving branch. Refreshing it requires checking the new files and hashes and evaluating affected Skills against suitable benches. For a smaller selection, use [selectable setup](selectable-codex.md). The portable profile still contains personal global guidance and locally authored Skills; review it before sharing.

On installation, skillfit copies Skills to the Codex user skills directory from the [capability matrix](../src/matrix/agents.json) and writes a managed block to the global `AGENTS.md`. It honors `CODEX_HOME` for global guidance and session history. An active `AGENTS.override.md` would shadow the result, so installation reports a conflict before writing. Existing content outside the managed block is preserved, and modified or extra Skill files cause a conflict instead of being overwritten or silently retained. Re-running the same install skips unchanged content.

The bundle contains a copy of personal global instructions. Review `rules/global.md` and the Skill files before sharing or storing it in a public repository. The command exports regular user-level Skill directories in `~/.agents/skills`; it refuses symlinked Skills and files so the bundle cannot follow links outside the selected directory. It does not transfer plugin installations, plugin authentication, MCP connections, or system-bundled Skills. Install those through their own supported setup paths on the destination machine. A new Codex session is needed to check that the installed configuration is loaded.
