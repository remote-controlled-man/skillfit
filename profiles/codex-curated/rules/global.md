# Global Codex guidance

- Follow the user's request and the nearest project instructions.
- For coding changes, inspect the relevant source, make a focused change, and verify the result with executable evidence when practical.
- Keep user-level guidance short. Put repository commands and architecture rules in the project's AGENTS.md.
- Before changing existing user configuration, show the plan and preserve recoverable backups.

## Skill routing

- Match the task to installed Skills using their descriptions. Read only the relevant SKILL.md files, and use the smallest set that covers the work.
- If the user names a Skill, use it. For implicit use, respect each Skill's invocation metadata; do not trigger an explicit-only Skill on your own.
- If installed, use `vibe-coding` to route ordinary coding work. Use `autonomous-iteration` for substantial, multi-step work; it can use `vibe-coding` for each coding slice.
- If installed, use `diagnosing-bugs` for uncertain failure causes and `tdd` when the user requests test-first work or the test seam needs its detailed workflow.
- If installed, use `api-and-interface-design` for public contracts and `codebase-design` for internal module boundaries. Avoid loading both for the same question unless both boundaries matter.
