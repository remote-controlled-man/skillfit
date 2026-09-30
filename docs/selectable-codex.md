# Selectable Codex setup

The public configuration is source-controlled in [`profiles/codex-curated/`](../profiles/codex-curated/profile.json). It contains a short global `AGENTS.md` template, the two skillfit-authored Skills, and a [catalog](../profiles/codex-curated/catalog.json) of 67 installable Skills plus seven retired local names. The 65 third-party installable Skills are fetched directly from their authors' GitHub repositories at the exact commits and file hashes in [`codex-upstream-sources.json`](../profiles/codex-upstream-sources.json). No personal ZIP or copied home directory is required.

Requires Git, Bash, Node.js 22+, npm, and network access for selected upstream Skills. In Git Bash on Windows, use the same commands. The script runs `npm ci --ignore-scripts` on a fresh clone, builds the TypeScript CLI, and invokes `skillfit setup codex`.

```bash
git clone https://github.com/remote-controlled-man/skillfit.git && cd skillfit
bash scripts/setup-codex.sh --list
bash scripts/setup-codex.sh --skill vibe-coding --skill diagnosing-bugs
bash scripts/setup-codex.sh --skill vibe-coding --skill diagnosing-bugs --yes
```

Repeat `--skill NAME` to choose task-relevant Skills. `--starter` preserves the original 13-Skill selection for existing users; it has not been evaluated as a set. `--all` selects all 67 for migration or controlled experiments, not as a default setup. A large installed set can crowd Codex's initial Skill list. `--no-rules` skips the global guidance. Without a selection, setup only lists the catalog. With a selection and no `--yes`, it downloads and verifies the selected upstream files and prints a dry-run plan; it does not change Codex configuration. `--strict` makes a dry-run conflict exit nonzero. `--yes` prints the same plan, then applies it with backups and post-write checks. The global rules go into the managed block of the Codex user-level `AGENTS.md`; other content in that file remains outside the block. The installed Skills go to the shared user Skill directory determined by the [agent matrix](../src/matrix/agents.json). Start a new Codex session after installation.

The 27 Lark Skills come from the official `larksuite/cli` repository. Selecting one also selects `lark-shared`; using them requires a separately installed and authenticated `@larksuite/cli`. Setup does not install that CLI or request credentials. Seven names still present in the author's local directory have been removed by their upstream maintainers. They remain visible under “Retired” with reasons and cannot be installed by this public catalog. In particular, the former `obsidian-vault` Skill hardcodes its author's vault path and is not portable.

Each file is fetched by commit URL and checked against its SHA-256. A missing file, unexpected content, or invocation-policy mismatch aborts before any Codex configuration is written. The script does not call a model. Unmanaged or locally modified same-name Skills produce conflicts rather than silent replacement; previously managed, unchanged Skills can update with a backup. Review the listed paths and decide whether to keep your local edits; the installer never deletes those directories for you. Re-running with the same selection is idempotent.

## What the evidence supports

The 67 entries are a **source and installation catalog**, not a usefulness ranking. Pinning commits, checking hashes, and successfully installing a Skill establish provenance and integrity; they do not establish that the Skill improves an agent's work. Neither the legacy 13-Skill set nor the two skillfit-authored Skills has a paired efficacy result as a set or on the current Codex model.

| Scope | Evidence | Practical reading |
|---|---|---|
| Eight workflow Skills | [July 2026 Codex CLI baseline](../evidence/2026-07-skill-baseline.md): three pairs per Skill; served model identity was unavailable | `diagnosing-bugs` produced valid regression tests in 2/3 treated runs versus 0/3 baseline, with unchanged task quality and higher token use. `code-review` had a small unstable difference. The other six had no measured quality gain on these tasks. None is proven beneficial on today's pinned version/model. |
| Later targeted checks | [September Kimi debugging check](../evidence/2026-09-debugging-bench-exploratory.md) and [Codex trigger capture](../evidence/2026-09-22-codex-trigger-capture.md) | The debugging artifact difference did not recur in the Kimi check. A Skill triggering shows routing, not better outcomes; both arms passed the trigger bench's tasks. |
| Remaining 59 catalog Skills | No paired outcome evaluation in this repository | Their utility is unknown. The 27 Lark Skills are task-specific adapters that also require `@larksuite/cli`; their availability is not evidence of quality gains. |

For a new environment, start with no extra Skills, add one only for a task you actually do, and compare paired runs against the same task without it. Check task outcomes, trigger recall and false triggers, and token use. Use failures that current models do not already solve reliably; saturated benches cannot distinguish an improvement. See [the evaluation protocol](metrics.md) and [OpenAI's Skill testing guidance](https://developers.openai.com/blog/eval-skills). [SkillsBench](https://arxiv.org/abs/2602.12670) found that focused Skills outperformed larger bundles on its benchmark, while [OpenAI's Codex guidance](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra) notes that large overlapping Skill sets can shorten descriptions and confuse selection. Those findings motivate a small starting set; they do not certify any entry in this catalog.

The two local Skills have shorter trigger descriptions; the global guidance stays short and delegates to each Skill's description and invocation metadata without requiring specific Skills for every coding task. `writing-shape` is marked explicit-only. `edit-article` was removed from the author's current tree and remains available from a reviewed historical commit, marked as such in the list. For the source audit and limited prior trigger evidence, see [Codex upstream audit](codex-upstream-audit.md). This follows [OpenAI's guidance on Skill description scope and initial-list limits](https://learn.chatgpt.com/docs/build-skills).

The older [`bundle export`](portable-codex.md) command remains available for someone who deliberately wants a portable snapshot of their own installed configuration. It may contain personal rules and should be reviewed before sharing. The selectable public setup does not read personal home configuration as source material.
