---
name: commit-message
description: Drafts a conventional commit message from the current diff. Use when the user asks to commit changes, write a commit message, or summarize staged work for version control.
---

# Commit Message

1. Run `git diff --cached` (or `git diff` when nothing is staged) and read the
   whole diff, plus `git status` for untracked files.
2. Identify the single primary concern of the change. If the diff mixes
   unrelated concerns, say so and propose splitting it into separate commits.
3. Write the subject as `<type>(<scope>): <summary>` where type is one of
   feat, fix, refactor, test, docs, chore, or perf. Keep the summary under 72
   characters, imperative mood, no trailing period.
4. If the change alters behavior, add a blank line and a short body explaining
   what changed and why, wrapped at 80 characters.
5. Show the proposed message and ask for confirmation before running
   `git commit`.
