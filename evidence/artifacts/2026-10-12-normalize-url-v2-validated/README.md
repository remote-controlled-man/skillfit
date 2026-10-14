# Completed normalize-url v2 comparison: reproducibility package

See [the dated report](../../2026-10-13-normalize-url-v2-validation.md).
The frozen final batch completed two pairs: original 2/2 and compact v2 2/2,
all four deliveries 8/8. No checks improved/regressed; the verdict remains
inconclusive. V2 input/output/aggregate elapsed fell, while uncached input rose
29.3%. Per-pair increases remain visible in `analysis.json`.

## Contents and boundaries

- `replay/`: frozen compiled timing/alias harness, full source, package/license,
  both complete Skills, normalize-url and code-review fixtures, declaration,
  live/regrade/analysis entry points and prior package index fingerprints.
- `records.tar.gz`: all four workspaces, installed resources, prompts,
  receipts/public streams, native plan/call/session records, successful readiness
  copy and released temporary power assertion record.
- `export-index.json`: original/exported hashes; only metadata/public local
  paths are normalized. Source/test/Skill/license bytes are exact. Native
  plan/artifact hashes describe original bytes; export hashes describe this copy.
- `manifest.json`, `native-report.md`, `analysis.json`, `regrade.json`,
  `archive-regrade.json`: unchanged protocol, complete scores/costs and verified
  fresh archive replay. The native cohort has four invocations; analysis counts
  the separate readiness invocation too (five total in this final batch).
- `readiness-replay.json`, `power.json`, `environment-verification.json`:
  public readiness usage/message checks, power lifecycle and endpoint hashes.
- `all-recovery-costs.json`: all eight CLI invocations across this request,
  including preparation/failed stages, with missing usage kept unknown.
- Test logs, `replay-index.json` and `artifact-index.json`: validation/integrity.

Git internals, auth/configuration bodies, private lab data and hidden rollout
reasoning are excluded. `replay/src` is the frozen source tree; the full project
fixture/profile/doc set is not bundled, so use the specified frozen test subset
below rather than claiming this slice runs all 460 tests.

## Offline replay: no model/API/agent CLI/dependency installation

Run here with Node v24.21.0:

```bash
SKILLFIT_VALIDATED_RECORDS=$(mktemp -d)
tar -xzf records.tar.gz -C "$SKILLFIT_VALIDATED_RECORDS"
node replay/scripts/replay-normalize-url-v2-validated.mjs "$SKILLFIT_VALIDATED_RECORDS/normalize-url-v2-validated-20261012"
node replay/scripts/analyze-normalize-url-v2-validated.mjs "$SKILLFIT_VALIDATED_RECORDS"
node replay/dist/cli.js report eval manifest.json
node --test replay/dist/harness/execution-timing.test.js replay/dist/harness/executors/cli.test.js replay/dist/harness/experiment-session.test.js
```

Expected: matched 4/excluded 0, benchmark invocationCount 4, costsMatch true;
analysis actualInvocations/declaredInvocations 5/5 including readiness. All four
deliveries are 8/8. Frozen tests pass 54/54. `archive-regrade.json` verifies fresh
extraction, exported file hashes and exact analysis equality.

For all additional recovery spending, retain the three sibling stopped-stage
packages beside this one and run:

```bash
node replay/scripts/analyze-normalize-url-recovery-spending.mjs ..
```

Expected: eight CLI invocations, input >=1563610, output >=45239 and 2283.206s
of recorded monotonic intervals. Outside the comparison: four invocations,
input >=341775/output >=10757, with two missing usage receipts. This is recorded
spending, not a dollar bill or comparison effect. All timing/quality/cost replay
uses only saved files and Node built-ins.

The separately preserved stages are:

- [Trust-alias stop](../2026-10-12-normalize-url-v2-recovery/README.md): one
  normal completed CLI output, post-call false guard, zero graded pairs.
- [Provider timeout](../2026-10-12-normalize-url-v2-comparison/README.md): one
  503/TLS reconnect timeout, zero graded pairs, unknown token usage.
- [Local readiness rejection](../2026-10-12-normalize-url-v2-available/README.md):
  one CLI refused for missing Git initialization; no paired call.
- [Original v2 failure package](../2026-10-12-diagnosing-v2/README.md): unchanged
  2178.775s wall anomaly and earlier completed controls/partial transfer cohort.

## Fresh live procedure

The declaration pins the model settings, CLI/Node, input hashes, compiled code
and entry point. Preview its plan from a compatible environment:

```bash
node replay/scripts/run-normalize-url-v2-validated.mjs --phase plan --runs-root /private/tmp/skillfit-normalize-url-v2-fresh
```

The live phase permits one readiness call (90s) and, only if it returns READY,
four paired calls (600s each), using the recorded configured model/effort/tier
and inherited environment:

```bash
node replay/scripts/run-normalize-url-v2-validated.mjs --phase run --runs-root /private/tmp/skillfit-normalize-url-v2-fresh
```

The disposable readiness repository is initialized/reflog-verified first. macOS
temporary sleep assertions are verified and released; forced sleep is still
detected rather than prevented. Native sessions guard inputs/configuration and
frozen workspace aliases around each benchmark invocation; extra RTK/CLI checks
are at phase endpoints. Served model identity remains unrecorded. A readiness
check can warm caches and cannot guarantee later connectivity.

Never reuse/append any retained group or replace its missing observations. A
changed input, model, configuration, runtime or procedure requires a new bounded
declaration. New model execution reproduces the method, not identical samples,
usage or latency. No installation recommendation follows from this saturated
one-bug/two-pair sample.
