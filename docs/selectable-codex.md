# Selectable Codex setup

The public configuration is source-controlled in [`profiles/codex-curated/`](../profiles/codex-curated/profile.json). It contains a short global `AGENTS.md` template and the two skillfit-authored Skills. The other 11 Skills are fetched directly from their authors' GitHub repositories at the exact commits and file hashes in [`codex-upstream-sources.json`](../profiles/codex-upstream-sources.json). No personal ZIP or copied home directory is required.

Requires Git, Bash, Node.js 22+, npm, and network access for selected upstream Skills. In Git Bash on Windows, use the same commands. The script runs `npm ci --ignore-scripts` on a fresh clone, builds the TypeScript CLI, and invokes `skillfit setup codex`.

```bash
git clone https://github.com/remote-controlled-man/skillfit.git && cd skillfit
bash scripts/setup-codex.sh --list
bash scripts/setup-codex.sh --skill vibe-coding --skill diagnosing-bugs
bash scripts/setup-codex.sh --skill vibe-coding --skill diagnosing-bugs --yes
```

Use `--all` for all 13 Skills, or repeat `--skill NAME` to choose. `--no-rules` skips the global guidance. Without a selection, setup only lists the catalog. With a selection and no `--yes`, it downloads and verifies the selected upstream files and prints a dry-run plan; it does not change Codex configuration. `--strict` makes a dry-run conflict exit nonzero. `--yes` prints the same plan, then applies it with backups and post-write checks. The global rules go into the managed block of the Codex user-level `AGENTS.md`; other content in that file remains outside the block. The installed Skills go to the shared user Skill directory determined by the [agent matrix](../src/matrix/agents.json). Start a new Codex session after installation.

Each file is fetched by commit URL and checked against its SHA-256. A missing file, unexpected content, or invocation-policy mismatch aborts before any Codex configuration is written. The script does not call a model. Existing same-name Skills with different content produce conflicts rather than silent replacement. Review the listed paths and decide whether to keep your local edits; the installer never deletes those directories for you. Re-running with the same selection is idempotent.

The selected set is a source catalog, not a claim that all 13 improve every model or task. The two local Skills have shorter trigger descriptions; the global guidance stays short and delegates to each Skill's description and invocation metadata. `writing-shape` is marked explicit-only. `edit-article` was removed from the author's current tree and remains available from a reviewed historical commit. For the source audit and limited prior trigger evidence, see [Codex upstream audit](codex-upstream-audit.md).

The older [`bundle export`](portable-codex.md) command remains available for someone who deliberately wants a portable snapshot of their own installed configuration. It may contain personal rules and should be reviewed before sharing. The selectable public setup does not read personal home configuration as source material.
