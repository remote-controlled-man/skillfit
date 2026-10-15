# Four-call native diff mechanism replay

See the [result and limitations](../../2026-10-15-native-diff-mechanism.md).
Exactly four real development calls completed. Both versions pass 2/2, helper
use is observed in 4/4, and acceptance remains inconclusive. No additional
experiment call or independent comparison has started.

Archive: [package.tar.gz](package.tar.gz), 830,563 bytes.
SHA-256: `0662db8ba95ab7a440098a10a48d6ba95a7cf900ee98cc7733aab2d3192c201f`.

From the repository root, use a fresh directory and Node 24.21.0:

```bash
shasum -a 256 evidence/artifacts/2026-10-15-native-diff-mechanism/package.tar.gz
mkdir /tmp/skillfit-native-diff-replay
tar -xzf evidence/artifacts/2026-10-15-native-diff-mechanism/package.tar.gz -C /tmp/skillfit-native-diff-replay
node /tmp/skillfit-native-diff-replay/replay.mjs
```

No dependency installation, network, agent CLI or model call is used. The
replay checks 394 indexed files, frozen inputs/runtime, all four outcome grades,
final usage counters and paired costs, observed helper executions and patch
displays, four common startup warnings, the 182-call cumulative ledger with
seven earlier unknown usages, and the unchanged inconclusive adoption decision.
Expected final JSON includes `modelCalls: 0`, `regraded: 4`,
`qualityCostsAcceptanceMatch: true`, `observedHelperUseRuns: 4`,
`helperExecutions: 5`, `suspiciousEmptyPatches: 0`, `cumulativeCalls: 182`,
`missingPublicFinalUsage: 7`, `decision: "inconclusive"`, and
`automaticUpgrade: false`.

Contents include `runner/` source and compiled files, complete `skills/`, full
`bench/` assets with one task scheduled, four delivered workspaces under
`records/`, command/final-usage transcripts, the frozen protocol and request,
execution guard and assessment under `execution/`, and the prior ledger under
`review/`. No other bench task was called by this probe.

This is a normalized public derivative of an audited native run. Private path
prefixes use padded placeholders that preserve command-output byte lengths;
private global configuration inventory names are omitted. Hidden reasoning and
credentials are not exported. `export-provenance.json` distinguishes original
and exported hashes and final annotations; `package-index.json` verifies public
bytes. Native audit and regrade attestations describe the retained original,
not a byte-identical public native seal or provider billing verification.

Offline replay reproduces recorded evidence, not future model responses.
Provider billing, hidden retries and full authoring/orchestration costs remain
unknown. Any new model experiment requires a fresh decision and budget; this
archive does not grant authorization.
