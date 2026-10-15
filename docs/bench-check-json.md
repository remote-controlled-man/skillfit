# Offline bench checks for Agents

Source-checkout feature, not part of the published npm 0.9.1 archive:

```bash
node dist/cli.js bench check my-bench --json
```

Standard output contains one JSON document, with no human progress text or
calibration suggestions. Without `--json`, the existing human-readable output
and validation rules are unchanged. `--help` and `--version` keep their standard
CLI behavior. No agent executor, judge or model is started.
Checks execute the bench's local verifier/oracle programs on disposable copies,
under the existing offline bench contract; this is not a sandbox for untrusted code.

`--json` cannot be combined with `--calibrate`, including calibration dry runs.
That combination returns an error before loading/executing the bench. Use the
existing human calibration command separately only after choosing a budget.
JSON output is a format option, not spending authorization or Skill adoption.

## Version 1 contract

The [JSON Schema](schemas/bench-check.schema.json) describes all fields. The
stable discriminators are `schemaVersion: 1`, `kind: "skillfit.bench-check"` and
`scope: "offline-integrity"`. Clients should branch on identifiers and statuses,
not parse the English `message` text.

| Field | Meaning |
| --- | --- |
| `status` | `passed` means zero failed integrity gates; `failed` means at least one gate failed; `error` means the check did not complete, such as invalid options or an unexpected local execution error |
| `dir` | Absolute bench directory, or `null` on an error |
| `bench` | Loaded bench name, complete SHA-256 and task count; `null` if loading failed or on an error |
| `checks` | Ordered gate results, including warnings and informational coverage notes |
| `summary` | `total`, `passed`, `warnings`, `failures`, `info`; `null` on an error |
| `error` | `null` for completed validation; otherwise `{code: "INVALID_OR_FAILED_CHECK", message}` with empty `checks` and no summary |

Each check contains `code`, `status` (`PASS`, `WARN`, `FAIL`, `INFO`), `message`,
`taskId`, `location`, `remediation` and `evidence`. Bench-wide checks use a null
`taskId`. `location.path` is relative to `dir`; `location.field` identifies a
`bench.json` field such as `tasks[].oracle`, with `taskId` selecting the task.
Fixture or marker locations use their path and a null field. A loader failure
may only identify `bench.json`; its message retains the exact parsing/path error.

Every warning/failure has a nonempty `remediation`. These are review suggestions,
not commands that the CLI automatically executes. Passing/informational checks
have null remediation.

Process-backed gates include `evidence`: the actual `command`, `exitCode`
(null if it did not produce one), `error`, captured `output`, `outputTruncated`
and parsed named verifier `checks`. The output retains at most the last 8,192
JavaScript string code units; named checks are parsed before truncation. Other
gates have null evidence. For an `ORACLE` gate, evidence comes from the failing
oracle, or from the verifier after applying the oracle; `evidence.command`
identifies which program actually produced it. Output, paths and diagnostics
can contain local project data; review them before sharing.

A failed reference repair can expose a check like this:

```json
{
  "code": "ORACLE",
  "status": "FAIL",
  "message": "example-task: oracle solution does not pass the verifier — the task is unwinnable or the oracle is stale",
  "taskId": "example-task",
  "location": {"path": "bench.json", "field": "tasks[].oracle"},
  "remediation": "Inspect the oracle and verifier output; register a reference repair that passes every check.",
  "evidence": {
    "command": "node verifiers/example-task.mjs",
    "exitCode": 1,
    "error": null,
    "output": "{\"passed\":false,\"checks\":[{\"name\":\"negative-numbers\",\"pass\":false}]}",
    "outputTruncated": false,
    "checks": [{"name": "negative-numbers", "pass": false}]
  }
}
```

This is one illustrative check, not a complete result or a model-quality score.

## Gate identifiers

Only applicable gates emit results. A missing code is not an implicit pass;
inspect coverage notes and warnings before deciding what the bench establishes.

| Code | What is checked |
| --- | --- |
| `BENCH_LOAD` | Manifest schema, referenced files and bench content hash |
| `UNTOUCHED_FIXTURE` | A command verifier must run and fail on the unsolved fixture |
| `MISSING_OUTPUT`, `EMPTY_OUTPUT` | An output verifier must reject absent/empty responses |
| `FACET_COUNT` | The existing 2–8 named-check recommendation |
| `ORACLE` | Reference repair executes and passes the verifier with full named checks, or warns when no oracle is registered |
| `MOCK_COVERAGE` | Why mock probes are unavailable or not applicable |
| `MOCK_MARKER` | A present mock marker must parse |
| `MOCK_BASELINE`, `MOCK_TREATMENT` | Observed mock-arm results, retained as informational checks |
| `FIXTURE_SIZE` | Existing fixture-size check and 64 KiB warning |
| `TRIGGER_LABEL` | An unlabeled task is skipped in trigger mode |
| `NEGATIVE_CONTROLS` | Existing negative-control coverage and 30% target |

A nonzero verifier exit can be a **PASS** for `UNTOUCHED_FIXTURE`, `MISSING_OUTPUT`
or `EMPTY_OUTPUT`: those gates deliberately test unsolved/absent work. Read the
gate status before interpreting process evidence. A verifier that cannot start
never counts as reproducing a failure.

## Exit status and acceptance

- **0:** validation completed without failed gates; warnings may still exist.
- **1:** validation completed with failed gates, including a missing or malformed bench.
- **2:** invalid options, a forbidden calibration combination, or an unexpected execution error; validation did not complete.

Agents should inspect failures first, then warnings and evidence coverage. A
`passed` result does not prove model difficulty, Skill improvement, statistical
significance or eligibility to upgrade. Missing oracles still warn; command
cases still skip text-only mock probes. Partial execution errors cannot be
interpreted as a completed check. See the [authoring guide](bench-authoring.md)
and [metrics protocol](metrics.md).
