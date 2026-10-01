# Pinned evaluation inputs

`diagnosing-bugs/` vendors Matt Pocock's MIT-licensed input from
[`mattpocock/skills`](https://github.com/mattpocock/skills/tree/d81f3a183412e71a5b1e84ca21bc1a35eea03a60/skills/engineering/diagnosing-bugs),
commit `d81f3a183412e71a5b1e84ca21bc1a35eea03a60`, directory
`skills/engineering/diagnosing-bugs`. The upstream license is retained as `LICENSE`.
This directory exists for reproducible experiments and does not install or
recommend the Skill globally.

Inject mode currently collects Markdown/YAML/JSON. Its target bundle consists of
`SKILL.md` and `agents/openai.yaml`, SHA-256
`f19320ddde7601ce58a82fd4cbe3e2f07038e75e7e590fcf65360d668b66d80d`.
The upstream `scripts/hitl-loop.template.sh` is preserved but is not force-injected.
It is outside the injectable bundle hash; the checked-in Git revision pins the
complete input. The mcp-use task needs no human interaction script.
