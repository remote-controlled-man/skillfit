# Global Codex guidance

- Follow the user's request and the nearest project instructions.
- For coding changes, inspect the relevant source, make a focused change, and verify the result with executable evidence when practical.
- Keep user-level guidance short. Put repository commands and architecture rules in the project's AGENTS.md.
- Before changing existing user configuration, show the plan and preserve recoverable backups.

## Skill routing

- Use a Skill when the user names it or its description clearly matches the task. Installed Skills are options, not mandatory steps.
- Read only the relevant SKILL.md files and use the smallest set that covers the work. When descriptions overlap, prefer the more specific Skill; add another only for a distinct need.
- Respect each Skill's invocation metadata. Trigger an explicit-only Skill only when the user invokes it.
