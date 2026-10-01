# Portable experiment records

Source run: `eval-20261001-141513`, runner revision `b460ed4`. The original local
run is retained untouched. These complete manifests/receipts remove the local
checkout-prefix from path strings; they are **path-relative copies**, not the
original byte streams. `artifact-index.json` records original and portable
SHA-256 values. No metrics, check outcomes, timestamps or verdicts were edited.

Each arm contains `result.json`, `prompt.txt`, `output.md`, `verifier.txt` and a
`workspace/` with the delivered source, tests, package metadata and license.
Harness underscore files and `.git` are outside those deliverable workspaces.
Source/test bytes are unchanged. The original console retains a then-existing
misleading claim about zero-width CI resolution; the corrected renderer does not
make that claim. See the dated report for the reviewed interpretation.

Regrade either saved deliverable offline from the skillfit root:

```bash
node --experimental-strip-types benches/contrib/oss-mcp-use-utf8/verifiers/view-utf8.mjs evidence/artifacts/2026-10-01-oss-workspace-smoke/baseline/workspace
node --experimental-strip-types benches/contrib/oss-mcp-use-utf8/verifiers/view-utf8.mjs evidence/artifacts/2026-10-01-oss-workspace-smoke/treatment/workspace
node dist/cli.js report eval evidence/artifacts/2026-10-01-oss-workspace-smoke/manifest.json
```

Both regrades should exit 0 and emit eight passing checks. They spawn only local
Node tests and create/delete temporary RED→GREEN copies. No model or network is
needed. `report.md` is a regenerated view after the report/planning corrections;
`original-console.txt` records execution-time console output.
