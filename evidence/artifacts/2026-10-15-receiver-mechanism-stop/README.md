# Receiver mechanism probe: reproducible one-call stop

The [dated report](../../2026-10-15-receiver-mechanism-stop.md) records the failed
v4.1 candidate. The conditional control call was never started.

- Archive: [package.tar.gz](package.tar.gz)
- SHA-256: `b520022e2c6250bfa2b20c864e2f63d9436647a05d69b16b312ec636d36a0a43`
- Bytes: 630,986
- Indexed payload files: 284, plus `package-index.json`
- [verification.json](verification.json): successful fresh-extraction replay.
- [checks.json](checks.json): controller/project checks and preservation audit.

From the repository root, use a fresh extraction directory:

```bash
replay_dir=$(mktemp -d)
tar -xzf evidence/artifacts/2026-10-15-receiver-mechanism-stop/package.tar.gz -C "$replay_dir"
node "$replay_dir/replay.mjs"
```

Verified with Node v24.21.0. Replay uses Node built-ins and frozen verifier code;
it needs no network, dependency installation, model, judge or agent CLI.
It regrades the original six checks, all eighteen receiver checks, four source
variants under the new regression, twenty-four injected controller tests, the
one-call native ledger, final counters and before/after budget states.
Owned temporary grading copies are removed.

The model read the complete new Skill, but its production source is identical
to the retained wrong v4 source. The candidate passed 4/6 and 8/18; total input
was 205,272, cached input 182,144, uncached input 23,128, output 6,182 and executor
time 188.158 seconds. No per-success saving or paired change is inferred.

`export-provenance.json` records raw source/export hashes and privacy adaptations.
The source native seal is retained privately; exported hashes attest this
derivative. No complete native component acceptance audit or independent model
efficacy claim is made. Historical launch declarations and controller source
explain what happened; they do not authorize replaying a live call. Run only
`replay.mjs` for offline reproduction.
