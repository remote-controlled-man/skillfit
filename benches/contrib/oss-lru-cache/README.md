# Independent historical lru-cache failures

Three real upstream defects, selected from issues and maintainer fixes before consulting any evaluated Skill:

| Task | Original requirement | Preimage | Fix |
|---|---|---|---|
| fetch-size | [issue 269](https://github.com/isaacs/node-lru-cache/issues/269) | `f33a3e42` | `c8cae78c` |
| fetch-abort | [issue 274](https://github.com/isaacs/node-lru-cache/issues/274) | `914ea50a` | `c7e46cdc` |
| fetch-lifecycle | [maintainer lifecycle fix](https://github.com/isaacs/node-lru-cache/commit/451737cf4f82dc268b88530a559f900837261733) | `425dd43e` | `451737cf` |

Full SHAs, byte hashes, source/license files and extraction notes are retained in `provenance.json`, `fixtures/`, and `ground-truth/`. Each historical source is verbatim. The old CJS cases load directly; the TS case uses Node's built-in TypeScript stripping in a temporary directory (the retained namespace contains only types; a capability probe selects transform only for older parsers such as Node 22.13 that cannot strip it), mapping two local `.js` import suffixes to compiled `.mjs`. No third-party runtime dependencies or network. **Node >=22.13 is required for the `fetch-lifecycle` TS replay**, independently of the CLI's Node >=22 requirement. The complete bench gates require Node >=22.13 as the trusted test reporter is also version dependent. The two CJS loaders work on Node 22.0; attempting the TS replay there gives an explicit capability error rather than failing while importing the loader. See [Node's stripping API](https://nodejs.org/api/module.html#modulestriptypescripttypescode-options) and [type-only namespace support](https://nodejs.org/api/typescript.html#typescript-features). Frozen historical evidence retains its original loaders and Node 24.21.0/POSIX replay requirement.

```bash
node dist/cli.js bench check benches/contrib/oss-lru-cache
node dist/cli.js bench check benches/contrib/oss-lru-cache --calibrate --agent codex --input workspace --trials 2 --max-calls 6 --dry-run
```

After reviewing the offline NOP/oracle/counterexample gates, run the same calibration command without `--dry-run`. Calibration is baseline-only, is not Skill evidence, and retains saturation/errors without replacement calls. Declare a separate paired validation set and budget only after inspecting calibration.

The fixtures contain full relevant implementation modules with original ISC licenses and existing smoke checks. The prompts require a new executable regression. Graders are outside trial workspaces, protect existing assets, and verify that a new test fully passes the submitted implementation and contains a uniquely matched test case that fails on the original source and passes on the unmodified upstream reference fix. Hidden behavior probes use deferred providers and event-loop turn barriers; no wall-clock TTL or latency grading.

Scope: one upstream repository, one async cache family, extracted runtime behavior. These tasks do not reproduce upstream CI, type compatibility, browser builds, release preparation, maintainer review or PR acceptance. Difficulty is uncalibrated until a pinned baseline run is retained. They do not establish general OSS contribution quality, and all three are positive bug-fix cases rather than a trigger-negative set.

The case-level third-side gate rejects tests that only assert a new unrelated field/interface. It uses trusted Node reporter events with relative file, complete parent path and name; ambiguous duplicate identities, cancelled/timed-out/import-failed original runs and spoofed stdout cannot supply a witness. The entire submitted suite must pass without skip/todo/cancellation; other tests may expose failures in the imperfect reference fix. This is mechanical corroboration, not a proof of semantic relevance. Independently review test content before calibration.
