# Independent historical lru-cache failures

Three real upstream defects, selected from issues and maintainer fixes before consulting any evaluated Skill:

| Task | Original requirement | Preimage | Fix |
|---|---|---|---|
| fetch-size | [issue 269](https://github.com/isaacs/node-lru-cache/issues/269) | `f33a3e42` | `c8cae78c` |
| fetch-abort | [issue 274](https://github.com/isaacs/node-lru-cache/issues/274) | `914ea50a` | `c7e46cdc` |
| fetch-lifecycle | [maintainer lifecycle fix](https://github.com/isaacs/node-lru-cache/commit/451737cf4f82dc268b88530a559f900837261733) | `425dd43e` | `451737cf` |

Full SHAs, byte hashes, source/license files and extraction notes are retained in `provenance.json`, `fixtures/`, and `ground-truth/`. Each historical source is verbatim. The old CJS cases load directly; the TS case uses Node's built-in type stripping in a temporary directory, mapping two local `.js` import suffixes to compiled `.mjs`. No third-party runtime dependencies or network. **Node >=22.13 is required for this bench**, independently of the CLI's Node >=22 requirement.

```bash
node dist/cli.js bench check benches/contrib/oss-lru-cache
node dist/cli.js bench check benches/contrib/oss-lru-cache --calibrate --agent codex --input workspace --trials 2 --max-calls 6 --dry-run
```

After reviewing the offline NOP/oracle/counterexample gates, run the same calibration command without `--dry-run`. Calibration is baseline-only, is not Skill evidence, and retains saturation/errors without replacement calls. Declare a separate paired validation set and budget only after inspecting calibration.

The fixtures contain full relevant implementation modules with original ISC licenses and existing smoke checks. The prompts require a new executable regression. Graders are outside trial workspaces, protect existing assets, and verify that a new test passes the submitted implementation but fails when the original primary source is restored. Hidden behavior probes use deferred providers and event-loop turn barriers; no wall-clock TTL or latency grading.

Scope: one upstream repository, one async cache family, extracted runtime behavior. These tasks do not reproduce upstream CI, type compatibility, browser builds, release preparation, maintainer review or PR acceptance. Difficulty is uncalibrated until a pinned baseline run is retained. They do not establish general OSS contribution quality, and all three are positive bug-fix cases rather than a trigger-negative set.
