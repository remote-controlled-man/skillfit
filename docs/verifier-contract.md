# Verifier commands and infrastructure errors

Version 0.11.0 fixes quoted command arguments and separates recognized
grader infrastructure errors from normal task failures. Build the current
checkout to use these changes. The bench format remains schema version 1.

## Commands with spaces

`verifier` and `oracle` use the same shell-free argument parser in bench loading,
offline probes, evaluation, calibration, trigger trials and replay. For example:

```json
{
  "verifier": "node \"verifiers/check answer.mjs\" \"two words\"",
  "oracle": "node 'ground-truth/repair answer.mjs'"
}
```

Single/double quotes group arguments and are removed before spawning. Empty
quoted arguments are preserved. Outside quotes, a backslash can escape whitespace
or a quote; inside double quotes it can escape a double quote. Other backslashes,
including Windows drive/UNC separators, are preserved. Single quotes preserve all
backslashes literally; use them for a Windows directory ending in a backslash.
Adjacent quoted/unquoted fragments form one argument. Unclosed quotes, NULs and
empty executables fail before spawning. Quoted relative file paths retain the
same bench-boundary checks; quoting cannot permit `../` traversal.

The first argument is an executable name or a relative path inside the bench;
file-bearing tokens retain the existing relative-path validation. The harness appends the absolute
trial directory as one final argument and sets the bench root as working directory.
It performs no shell expansion: `$VAR`, command substitutions, pipes and control
operators are literal arguments. Use the existing generated `--verifier-cmd`
wrapper when shell behavior is deliberately needed; read trusted bench code
before executing it. This parser does not make untrusted verifiers safe.

## A failure is a grade; an infrastructure error is not

Version 0.12.0 supports optional task field `verifierTimeoutSeconds` (integer 1–3600,
default 120). It bounds each verifier/oracle command in checks, preflight, evaluation, calibration,
trigger mode and offline regrading, using the frozen bench's value during replay. Set it with
`bench add --verifier-timeout-seconds <n>` or
`bench edit <dir> <id> --set verifierTimeoutSeconds=<n> --yes`; use
`--unset verifierTimeoutSeconds` to restore the default. This does not change the model's
`--executor-timeout-seconds`. A timed-out grader remains an infrastructure error with retained
agent usage, not a failed model answer. Old benches keep their previous limit.

For a functioning verifier, exit 0 means pass and a nonzero exit means task
failure. JSON `passed`/named checks remain informational/graded signals; they do
not override that exit-code authority. Legacy exit-only graders and assertion/
test-suite failures retain this behavior.

The shared runner additionally recognizes these infrastructure errors:

| Diagnostic | Meaning |
| --- | --- |
| `VERIFIER_COMMAND_ERROR` | Command tokenization failed before execution |
| `VERIFIER_RUNTIME_ERROR` | Direct Node uncaught load/syntax/runtime exception attributable to bench code |
| `VERIFIER_REPORTED_ERROR` | The verifier explicitly reported an infrastructure failure |
| `VERIFIER_PROTOCOL_ERROR` | An explicit infrastructure-error message was malformed |
| Existing process errors | Cannot spawn, missing exit code, timeout, interruption or output overflow |

Automatic Node classification is conservative: it needs an uncaught Node
diagnostic and a bench-owned source/import/stack location. A candidate workspace
load/syntax/runtime failure remains a task failure. Assertion failures and a
wrapper's final normal JSON grade of a child failure are also preserved. A
summary printed before an uncaught grader exception cannot hide that exception.
Available process exit codes and raw output are retained even for errors.

An arbitrary nonzero exit cannot reliably identify whether any custom runtime
failed to grade or graded an incorrect solution. For other runtimes, caught
exceptions or ambiguous diagnostics, report infrastructure errors explicitly:

```json
{"schemaVersion":1,"kind":"skillfit.verifier-error","message":"Required grader tool could not be started."}
```

Print this as its own JSON line. `message` must contain non-whitespace text; see
the [schema](schemas/verifier-error.schema.json). This declaration makes the
result an error regardless of its exit code or other summaries. Existing normal
summaries such as `{"passed":false,"error":"missing _output.md"}` keep their
legacy meaning. Catch candidate failures and emit a normal verdict; reserve the
explicit error message for failures of the grader/environment itself. Generated
shell-command wrappers now report their own spawn/signal/missing-status errors
through this channel; they still forward ordinary command exit codes.

## Effect on checks, costs and replay

An infrastructure error fails the relevant offline gate, including original,
missing/empty-output, mock and oracle probes. It cannot satisfy a NOP gate just
by exiting nonzero. Live case preflight blocks calls even without an oracle;
absence of an oracle remains a separate unknown, not an automatic failure.
`bench check --json` retains `evidence.error`, raw output and the real numeric
`exitCode` when available, plus the existing gate code and remediation.

After an invoked evaluation, grader errors set the trial's `error`, leave its
grade/checks unavailable and exclude its entire pair from quality statistics.
Trigger errors likewise stay out of trigger rates. Agent tokens, final/partial/
unknown coverage, output and elapsed spending remain in invocation receipts and
all-invocation accounting. Existing spending guards stop further budgeted calls
on such an error. Normal graded failures still count toward rates and costs.
The paired statistics, acceptance thresholds and adoption restrictions do not
change.

Current offline replay rejects a verifier infrastructure error even if its exit
code matches a saved task failure. It does not rewrite original receipts or
backfill historical grades. Portable packages retain their pinned compiled
implementation and its original interpretation; record which implementation
was used when comparing a current audit with an older package.
