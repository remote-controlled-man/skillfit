# Receiver correction offline replay

This development replay uses the unchanged failed comparison archive, the new
receiver-contract probes and the v4.1 candidate. See the
[dated report](../../2026-10-15-diagnosing-receiver-correction.md).
It does not run or grade a model using the new Skill.

From the repository root, extract into a new directory:

```bash
replay_dir=$(mktemp -d)
tar -xzf evidence/artifacts/2026-10-15-independent-comparison-regression-stop/package.tar.gz -C "$replay_dir"
node evidence/artifacts/2026-10-15-diagnosing-receiver-correction/replay.mjs "$replay_dir"
```

Verified with Node v24.21.0. Only Node built-ins and the saved archive's verifier
code are used. No network, model call, agent CLI or dependency installation is
needed. Replay checks the original archive SHA-256, all indexed exported files,
the original twelve-delivery replay, five source variants, registered test
counts and witnesses, candidate fingerprints and unchanged auxiliary resources.
It compares its deterministic output with [expected.json](expected.json).
Owned temporary copies are removed; the extracted archive is not modified.

The human-written demonstration is generated from the failed source by extracting
the two timer functions and invoking them unbound. Both original and corrected
regressions are tested against the original, failed v4, original-Skill delivery,
maintainer repair and manual demonstration. The corrected regression replaces
the invalid one only inside disposable diagnostic copies. The saved record,
original score, cost receipts and rejection remain unchanged.

`modelCalls: 0` applies to this replay. The nested `originalReplay.newCalls: 11`
describes the already completed historical continuation, not new execution.
`skillBehaviorTested: false`, `independentValidation: false` and
`automaticUpgrade: false` are intentional. Packaging validation and manually
repairing code do not prove a Skill improvement.
