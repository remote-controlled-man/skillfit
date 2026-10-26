<a id="independent-originalv4-debugging-tasks"></a>

# Async context, timer and command lifecycle defects

Eight historical defects from p-limit, p-timeout, p-throttle and Commander.
The original selection is recorded in the [fixed proposal](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/plans/2026-10-15-independent-comparison-proposal.md).
This is source provenance, not a current efficacy result or authorization to run models.
Tasks live under `tasks/<id>/`; `bench.json` indexes commands and `verifiers/`
contains shared grading code.

| Task | Source fix | Behavior |
| --- | --- | --- |
| limit-async-context | [p-limit ad8afe6](https://github.com/sindresorhus/p-limit/commit/ad8afe6f46429e726b32fdedf063c553ebcb0196) | Queued callers retain their own async context |
| timeout-custom-timers | [p-timeout ed58372](https://github.com/sindresorhus/p-timeout/commit/ed58372c62d3dddfe6f58de37558fb132e1a4e9b) | Compatible timer receivers for scheduling and clearing |
| throttle-sync-throw | [p-throttle bee3f7d](https://github.com/sindresorhus/p-throttle/commit/bee3f7d0b048f251de2f910ddd122c6babf49380) | Delayed synchronous exceptions reject the returned promise |
| commander-output-isolation | [Commander 68199e6](https://github.com/tj/commander.js/commit/68199e64b31851839c03dff1567a81d7714baa08) | Child output settings leave parent and siblings unchanged |
| limit-map-iteration-rejection | [p-limit 9df0d27](https://github.com/sindresorhus/p-limit/commit/9df0d27f82ab3cb6d7e1087f5bda94ce911d33ca) | Iterator failure leaves no unhandled mapper rejection |
| timeout-rejection-listener | [p-timeout fd93994](https://github.com/sindresorhus/p-timeout/commit/fd93994892d0b3cba6da61787ac6b5da3ad3f2d5) | Rejection cleanup releases listeners without an unhandled promise |
| timeout-infinity-abort | [p-timeout 9260b09](https://github.com/sindresorhus/p-timeout/commit/9260b098885d11d53d0cc39884e5cadc8b85f229) | Infinity retains cancellation handling |
| commander-async-listener-order | [Commander 35a028b](https://github.com/tj/commander.js/commit/35a028b6253a38d00c16dca2a36b69c5888c022a) | Legacy events follow async hooks/action and precede postAction |

`provenance.json` pins the before/fix commits, raw Git blobs and SHA-256 hashes,
all fixture/reference files and vendored dependency commits/licenses. Runtime
source is complete: Commander keeps its runtime modules and types. Upstream test
and development tooling remain outside workspaces. Original documentation/types
are retained across arms; full functional maintainer changes are applied to the
reference, including the context task's package imports/files and browser stub.
Effective package scripts use Node's protected smoke test; original package
metadata is retained separately.

For p-limit only, the unchanged `yocto-queue` implementation is vendored under
`vendor/`. One import specifier is mechanically redirected to that local module
in both original and fixed source. Raw/adapted hashes are recorded. No package
installation, build step or network is needed to run a fixture or verifier. This
adds no dependency to skillfit itself. Original upstream MIT notices are retained.

Each task has six outcome checks: protected assets and ordinary smoke behavior,
four public behavior groups, and a retained registered regression that passes on
the submission and complete functional maintainer fix but fails on the original.
The multi-file context fix is restored as a unit for that comparison. Real timing
waits are replaced by a controlled clock. Unhandled rejections are observed in
isolated processes; they cannot silently poison another task. No check scores
Skill narration, an implementation keyword or a preferred repair strategy.

```bash
node dist/cli.js bench check benches/contrib/oss-skill-independent
node --test tools/verify/independent-offline.test.mjs
```

Offline checks also give the original the identical reference regression, so a
failure cannot be explained merely by a missing test. Constant passing tests,
files exiting zero without registered tests, protected vendor tampering and an
incomplete maintainer context patch are rejected. Offline integrity does not
prove model difficulty, Skill benefit or general correctness.

The two Commander fixtures exceed the snapshot-mode size warning because their
runtime context is retained. Use installed workspace comparison; no source is
trimmed to improve token numbers. All eight tasks are positive debugging tasks:
this bench does not measure trigger precision. Related promise libraries and
repeated repositories limit generalization. Offline integrity does not establish independence from a candidate already
tuned against these cases. Freeze a separate validation set for such a candidate.
