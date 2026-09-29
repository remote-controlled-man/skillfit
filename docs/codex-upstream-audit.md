# Codex portable Skill source audit — 2026-09-29

This audit records the source choice behind [`codex-upstream-sources.json`](../profiles/codex-upstream-sources.json). The lock pins 11 third-party Skills to exact GitHub commits and SHA-256 hashes, and selects two locally authored Skills, `vibe-coding` and `autonomous-iteration`, to copy into the private portable bundle. The bundle also carries the user's global guidance; none of that private content is in this repository.

## Source changes

| Skills | Observed difference from local installation | Selection |
| --- | --- | --- |
| `code-review`, `doubt-driven-development`, `source-driven-development`, `writing-shape` | Selected files match current upstream. | Pin current commits. Keep `writing-shape` user-invoked only, following its `openai.yaml` policy. |
| `api-and-interface-design`, `codebase-design`, `diagnosing-bugs`, `tdd` | Small text changes. The local API and codebase descriptions add a useful division between public and internal design. The local diagnosis and TDD files refer to `CONTEXT.md`; upstream now refers to `GLOSSARY.md`. One codebase reference also changed. | Pin current upstream. Preserve the public/internal and diagnosis/TDD routing distinction in generated `AGENTS.md`. Do not treat these edits as measured quality gains. |
| `frontend-design` | Substantial change to typography, motion, anti-template examples, and design process. | Pin current upstream for new environments. Review against task-specific design benches before claiming it improves output over the local revision. |
| `security-and-hardening` | Large examples moved from the root `SKILL.md` to `references/hardening-patterns.md`; the root is much shorter. | Pin both current files. Progressive disclosure is promising, but quality remains unmeasured. |
| `edit-article` | Removed from the current `mattpocock/skills` tree. The last available revision at `f958fa17c1b62c3f7be38fc09512669acf6b64fc` matches the local file byte for byte. | Pin that historical commit; a moving branch would fail to install it. |

The original repositories are [mattpocock/skills](https://github.com/mattpocock/skills), [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills), and [anthropics/skills](https://github.com/anthropics/skills). Source commits and file hashes are in the lock rather than repeated here.

## What the evidence says

The local `skillfit report --agent codex --json` scan covered 1,372 sessions. It found `vibe-coding` in 33 sessions and `autonomous-iteration` in 15. Those receipts show use, not whether either Skill improved the result. Their scopes fit together: `vibe-coding` routes ordinary engineering work; `autonomous-iteration` governs substantial, multi-step work and calls the smaller workflow for each coding slice. Generated global guidance states this division and loads the smallest relevant specialist Skill. `writing-shape` remains explicit-only.

The current `skillfit doctor --agent codex` smoke found 74 valid user Skills and warned about their routing cost. The portable selection installs 13. This is a smaller, task-focused starting set, not a verdict that the other 61 are ineffective.

The existing debugging bench can measure `diagnosing-bugs` behavior, and the code-review bench can measure `code-review`. They do not measure frontend design quality, security review quality, or the two locally authored workflow Skills. A meaningful preference between old and new text requires suitable tasks and paired runs; file recency and usage counts alone are insufficient. The upstream lock therefore records a reproducible candidate for new environments, not a statistically proven best set.

A one-trial real Codex CLI trigger run of the pinned upstream `diagnosing-bugs` on the eight-task debugging bench observed 3/5 intended triggers and 0/3 false triggers; seven tasks passed their verifiers. The 95% intervals are wide (recall 23%–88%, false-trigger rate 0%–56%). The run did not compare old and new versions, and this machine also has a user-level Skill with the same name, so it cannot establish a quality gain from the upstream revision. The local manifest is under ignored `runs/eval-20260929-231222/manifest.json`; it is not published as evidence.

The current machine has six locally modified Skill directories relative to the pinned upstream versions. A setup dry run reports them as conflicts and preserves them. A clean, isolated home installed all 13 Skills and global `AGENTS.md`; a second run skipped all 14 installed items. To migrate an existing machine, compare and decide on the local edits before replacing any of those six Skills.

This approach follows [OpenAI's current advice to keep Skill descriptions focused and avoid overlapping triggers](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra), as well as its [Codex Skill locations](https://learn.chatgpt.com/docs/build-skills) and [global `AGENTS.md` discovery rules](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

## Update — 2026-09-30

The three upstream repository HEAD commits still match the pinned current commits above. `edit-article` remains the documented historical exception. The public [selectable Codex profile](../profiles/codex-curated/profile.json) now stores generic global routing guidance and the two locally authored Skills in this repository. The 11 third-party Skills remain source references; the setup command downloads only those selected by the new user and verifies each file before the install plan. The private portable export remains a separate option and is not the source of the public profile.

In an isolated empty home, a real network run installed all 13 Skills and global guidance, then repeated the run with all 14 plan items unchanged. The current machine's eight changed directories (six upstream Skills and the two local workflow Skills) were backed up under `~/.agents/skillfit-backups/2026-09-30-curated` before updating ten files; a fresh hash check found zero mismatches against the upstream lock. Its existing personal global `AGENTS.md` was kept intact. These checks establish installation integrity and current-source alignment, not a measured quality gain for any model.

### Full local inventory correction — 2026-09-30

The earlier references on this page to an 11-source lock and a 13-Skill installation describe the first release; that 13-Skill selection is now available as `--starter`. The current source lock and `--all` selection have the expanded counts below.

The first public catalog exposed only the 13-Skill starter set, although this machine had 74 user-level Skills in `~/.agents/skills`. The expanded source catalog now covers 67 installable names: 26 present in the current `mattpocock/skills` tree, 10 in `addyosmani/agent-skills`, 27 in the official `larksuite/cli` tree, one in `anthropics/skills`, two authored in skillfit, and the historical `edit-article`. The remaining seven are shown as retired: `caveman`, `obsidian-vault`, `qa`, `request-refactor-plan`, `resolving-merge-conflicts`, `ubiquitous-language`, and `zoom-out`. Their upstream paths were removed; `obsidian-vault` in particular hardcodes the author's private vault path. They are not silently republished from the author's local directory. The 606 files in the 63 current Matt, Addy, and Lark Skills were checked against those repository trees, including frontmatter and invocation policy; the three remaining files in historical `edit-article` and Anthropic `frontend-design` were downloaded from pinned commits and hash-checked in a dry run. This covers all 609 remote file records. This is an inventory and installation-integrity correction, not evidence that installing 67 Skills improves model behavior.
