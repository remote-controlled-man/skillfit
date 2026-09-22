# Codex trigger capture + a cross-model trigger divergence (2026-09-22)

**Status: verified mechanism, small-N exploratory numbers.**

## What landed

Trigger capture now covers Codex CLI next to Kimi Code (Claude Code pending — no working auth on the
verification machine). Codex has no skill-invocation event in its `exec --json` stream; detection reads the
`command_execution` item whose command loads the skill's `SKILL.md` (path separators are shell-escaped and
doubled in real output — normalize before matching; the first detector version missed exactly that and was
caught by re-scanning real transcripts, not by unit tests).

Codex session rollouts (`~/.codex/sessions/**/rollout-*.jsonl`) are parsed the same way for
`skillfit report` (`response_item.payload.custom_tool_call.input` path evidence), so receipts now cover
codex too.

## The cross-model result

Same skill (`code-review`, bundle sha256 `0c32f24e572c…`), same bench (`code-review`, content sha256
`dd057adb3fe3…`), same trigger-mode presentation (files on disk, no inline snapshot), 2 trials per task:

| Agent | Trigger recall (should-fire) | False-trigger (negative control) | Run group |
|---|---:|---:|---|
| Kimi Code CLI v2.0.0 | 1/9 (11%) [95% CI 2%–44%] | 0/3 | eval-20260919-123630 |
| Codex CLI 0.153.4 | 6/6 (100%) [95% CI 61%–100%] | 0/2 | eval-20260922-105241 |

Same workload, opposite routing behavior: Codex checked the installed skill on every review task; Kimi Code
almost never did. Both completed every task either way (pass rates 100% on both). Whether the divergence
comes from how prominently each agent lists skills in its system context, or from routing style, is not
established by this data.

## Limitations

- 2–3 trials per cell — indicative only per docs/metrics.md; the comparison is one skill on one bench.
- The Codex runs executed on a machine where many skills are installed user-wide; routing competition
  existed on both agents (deliberate — trigger quality is measured against the real installed set).
