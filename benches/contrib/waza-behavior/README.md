# Waza behavior diagnostics

Three single-turn command tasks adapt `explicit-hold` and `verification-reuse` from
[Waza behavior-cases.json](https://github.com/tw93/Waza/blob/6b6c736561eaf24c4d1c5360c3c90767ab470805/tests/behavior-cases.json),
pinned at `6b6c736561eaf24c4d1c5360c3c90767ab470805`. The stale-receipt case is a locally authored counterexample.
The prompts, fixtures, verifier and oracle were authored for skillfit; Waza's MIT notice is retained in LICENSE.upstream.

| Task | Acceptance evidence |
| --- | --- |
| explicit-hold | Local spelling fix, unrelated note preserved, initial Git tree and commit history retained |
| receipt-current | Current tool/input hashes, reuse decision, receipt unchanged, no extra checker receipt |
| receipt-stale | Fresh tool/input hashes, recheck decision, one new checker receipt |

```bash
node dist/cli.js bench check benches/contrib/waza-behavior
```

Tasks live under `tasks/<id>/`. The manifest directly references one shared
`verifiers/behavior.mjs` and oracle; no duplicate per-task grader is needed.
The NOP must fail; each independent oracle must pass every facet. Offline tests also reject committed
fixes, unnecessary rechecks, stale evidence reuse and checker tampering. Ground truth and verifiers
remain outside the task workspace. Only Node built-ins and Git are needed.

## Interpretation limits

- These cases derive from the candidate project's own contracts. They are regression/diagnostic tasks,
  **inadmissible as independent evidence that Waza improves coding performance**. Use unrelated real
  failures and negative controls for an installation decision.
- Explicit instructions may saturate strong baseline models. Retain that result; do not multiply trials
  or relabel a ceiling task as evidence of lift. The hold task is a negative trigger control for `check`.
- A single request cannot establish authorization persistence across interruptions or actual conversations.
- Git state/reflog cannot establish that no push was attempted; no remote is configured. Receipt files
  are observable artifacts, not tamper-proof proof of process execution. Preserve CLI transcripts for review.
- The local checker checks existence of this fixture's local link. It is not a production Markdown checker.
- Each task is an independent copied repository; complete Skill treatment files may also be tracked by
  the runner's initial commit. Verifiers deliberately grade only the relevant files.
