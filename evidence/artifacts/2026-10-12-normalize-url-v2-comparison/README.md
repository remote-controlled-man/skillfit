# Canonical-guard batch: provider connection timeout

This separately frozen batch made one actual original-Skill invocation and
stopped before any treatment invocation. All four receipts are execution errors,
including three pre-call refusals. There are zero graded pairs.

The CLI public stream records 503 Service Unavailable and a TLS disconnection,
then reconnect attempts 2/5, 3/5 and 4/5. It records no agent message or command
execution. This does not establish which requests the provider accepted or billed;
final token usage is unknown, not zero. The harness made no replacement call;
native CLI reconnects occurred within that invocation.

The deadline fired after 600001.623ms, termination took 11.403ms, and the trial
interval was 600.019 monotonic seconds (600.017 wall). Maximum observation gap
was 1003ms and maximum clock discrepancy 1.859ms, with no timing anomaly.
The new canonical-path configuration guard passed; the failure was an executor
connection timeout. Temporary sleep assertions were verified, alive at finish
and released. The recorded power source was AC.

`replay/` retains the compiled code, source, full Skill/bench inputs, declaration
and entry points. `records.tar.gz` retains the error/refusal receipts, unchanged
workspace, public stream, ledger and power record. Source/test/Skill bytes remain
exact; only metadata/public paths are normalized. `export-index.json` verifies
exported bytes; native plan/artifact hashes refer to original bytes.

Run offline here using Node v24.21.0:

```bash
SKILLFIT_CONNECTION_RECORDS=$(mktemp -d)
tar -xzf records.tar.gz -C "$SKILLFIT_CONNECTION_RECORDS"
node replay/scripts/replay-normalize-url-v2-comparison.mjs "$SKILLFIT_CONNECTION_RECORDS/normalize-url-v2-comparison-20261012"
node replay/scripts/analyze-normalize-url-v2-comparison.mjs "$SKILLFIT_CONNECTION_RECORDS"
node replay/dist/cli.js report eval manifest.json
node --test replay/dist/harness/execution-timing.test.js replay/dist/harness/executors/cli.test.js replay/dist/harness/experiment-session.test.js
```

Expected archive regrade: matched 0, excluded 4, invocationCount 1,
costsMatch true and identical analysis. Timing/guard tests use Node fixtures only;
no API, model, agent CLI or dependency installation is needed for offline replay.
This batch is permanently stopped. Any later availability check/comparison needs
its own declaration; never replace its missing observations or pool it with a
later batch. Unknown timeout usage remains in all-study cost coverage.
