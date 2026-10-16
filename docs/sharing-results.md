# Share an evaluation result

For a complete portable directory of a paired native run without a judge, use
`report eval <run-dir> --export <new-dir> --json` to preview, then add `--yes`.
The [portable package guide](replay-packages.md) covers checksums, matching source
recovery, offline replay, stopped costs and review of private project contents.
The Markdown report below is a shorter summary, without the full replay inputs.
Source after npm 0.10.1 also reads calibration and trigger summaries with separate
states/metrics and JSON kinds; see [report types](evaluation-reports.md#calibration-and-trigger-reports-source-after-npm-0101).
They are descriptive single-arm reports and do not enable paired portable exports.

Try a clearly synthetic schema-v4 example first:

```bash
node dist/cli.js report eval docs/examples/eval-manifest.synthetic.json
```

After a paired `skillfit eval` run, replace the example path with its native run
directory or the printed `Manifest:` path. Since 0.10.1, Markdown and JSON accept
the same manifest/run/package inputs and show audit and acceptance reasons.
Stopped/incomplete runs show retained costs without inventing a completed quality
comparison. See [report inputs and states](evaluation-reports.md). This command is read-only: it does not call an agent,
rerun a verifier, change the manifest, or alter the verdict. Paste its output into a pull request or
issue. The JSON manifest remains the canonical record; attach it when you want someone else to audit
the task-level outcomes and provenance. The Markdown includes target and bench hashes, the executor,
trial counts, error counts, McNemar p-value, paired-bootstrap interval, and all warnings. It omits local
source directories so the short report is easier to share; review the raw manifest and report before
posting either, since names, warnings, and run data can still describe private work.

An example of the output shape from a **synthetic mock run**:

```markdown
# skillfit evaluation: example-skill

> **Synthetic harness run.** These numbers do not measure an agent or Skill effect.

| Task | Baseline | Treatment | Errors B/T | Δpass | Verdict |
|---|---:|---:|---:|---:|---|
| sample-task | 0/2 (0%) | 2/2 (100%) | 0/0 | +100.0pp | inconclusive |

## Statistical readout

- Overall verdict: **inconclusive** — only 2 discordant pairs
- Discordant pairs: 2 improved, 0 regressed; McNemar exact p=0.5000
```

The impressive-looking delta in this synthetic example is **not evidence of benefit**: two discordant
pairs are too few for significance, and the executor is a mock. For a dated real paired-outcome result
with its limitations stated, see the [Kimi debugging experiment](../evidence/2026-09-debugging-bench-exploratory.md).
Its historical manifest is local to that run; `report eval` renders schema-v4 manifests produced by
current paired experiments.

The renderer rejects older manifest schemas and missing or inconsistent fields used by the report
rather than guessing what a field used to mean. It does not compare runs from different model
versions or bench hashes. Use the [metrics protocol](metrics.md) when interpreting a verdict and the
[evidence submission template](../.github/ISSUE_TEMPLATE/evidence_submission.yml) when proposing a
published claim.

New manifests also include [cost accounting](eval-costs.md): separate input,
cache-read input, uncached input, output and elapsed time, each with coverage and
spending per successful task. All invoked agent runs retain failures and partners
excluded from quality pairs. Unknown or partial timeout usage suppresses cost
changes; available totals are labeled as lower bounds. Older manifests explicitly
mark these additions unrecorded. No report estimates a bill or changes a verdict.

## Offline CI recipe

[`examples/bench-check.yml`](examples/bench-check.yml) is an opt-in GitHub Actions workflow you can
copy into a skillfit fork's `.github/workflows/` directory. It checks the bundled benches on
macOS, Linux, and Windows and writes a small workflow summary. Replace the bench paths with your own
before enabling it. It makes no agent or model call, so passing it validates bench integrity, not
Skill efficacy. The repository's normal CI already runs these checks on all three operating systems.
