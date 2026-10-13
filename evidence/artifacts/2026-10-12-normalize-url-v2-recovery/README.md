# Timing-repair batch stopped on a trust-path alias

This frozen batch made **one** actual original-Skill invocation and no treatment
invocation. It stopped on a post-call configuration guard. There are no graded
pairs; the retained original delivery remains an execution error. Do not retrofit
it into a quality sample after repairing the guard.

The invocation completed normally in 400.535 monotonic seconds (400.534 wall
seconds), without timing anomaly or timeout. Public final usage is 325088 input,
288512 cached input, 36576 uncached input and 10752 output tokens. These are
additional study costs, not a Skill comparison or billing estimate.

`trust-alias-proof.json` shows that excluding only pure trust registrations for
the physical names of the four declared temporary workspaces exactly restores
the frozen configuration hash. No raw configuration body is published. The
canonical alias guard was repaired in a subsequent, separately declared batch.

The earlier 2178.775-second timeout remains unchanged in its original package.
`prior-timeout-receipt.json` is an exact copy of its published portable receipt;
`prior-timeout-provenance.json` pins the original archive and member.
`prior-sleep-events.txt` contains only the relevant local power-log events.

`replay/` holds the compiled timing runner and source/Skill/bench inputs before
the alias repair. `timing-repair.patch` records the timing change from its
pre-repair workspace state. `records.tar.gz` retains all four receipts, including
three pre-call refusals, public transcript, workspace delivery and power record.
Source/test/Skill bytes are exact; only metadata/public paths are normalized.
The native plan/artifact hashes describe original bytes; `export-index.json`
verifies exported bytes. No credentials, configuration bodies or private
reasoning rollouts are included.

Run offline from this directory with Node v24.21.0:

```bash
SKILLFIT_RECOVERY_RECORDS=$(mktemp -d)
tar -xzf records.tar.gz -C "$SKILLFIT_RECOVERY_RECORDS"
node replay/scripts/replay-normalize-url-v2-recovery.mjs "$SKILLFIT_RECOVERY_RECORDS/normalize-url-v2-recovery-20261012"
node replay/scripts/analyze-normalize-url-v2-recovery.mjs "$SKILLFIT_RECOVERY_RECORDS"
node replay/dist/cli.js report eval manifest.json
```

Expected: matched 0, excluded 4, actual invocations 1, costsMatch true.
`archive-regrade.json` verifies fresh extraction and identical analysis. Replaying
recorded outputs uses no model/API/agent CLI or dependency install. The batch is
permanently stopped; never append to it or replace its missing observations.
