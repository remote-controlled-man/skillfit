# Independent comparison regression-stop archive

[`package.tar.gz`](package.tar.gz) contains the privacy-normalized initial and
continuation records: 1 retained + 11 new actual invocations, six pairs, all
twelve deliveries and final token counters, the original eight-task bench,
both unchanged Skills, frozen runtime/source and offline replay. Remaining
68 declared calls were not executed. See the [dated report](../../2026-10-15-independent-comparison-regression-stop.md).

- SHA-256: `6a4d29e55a1b48b7e8cd4e790eb057341b08e92ede7e6fe903a015a6edfe3ed6`
- Bytes: 1,214,300
- [`verification.json`](verification.json) records a successful fresh extraction.
- [`checks.json`](checks.json) records offline tests, unchanged input/evidence
  fingerprints and the exact 1 + 11 call accounting.
- `package-index.json` seals exported files; `export-provenance.json` records
  source/export hashes and privacy adaptations. This derivative does not
  impersonate the unchanged original native seal or a complete component audit.

Use a new extraction directory:

```bash
replay_dir=$(mktemp -d)
tar -xzf evidence/artifacts/2026-10-15-independent-comparison-regression-stop/package.tar.gz -C "$replay_dir"
node "$replay_dir/replay.mjs"
```

Node v24.21.0 was verified. Replay needs only Node built-ins, reads saved data,
uses owned temporary copies for grading and removes only those copies. It adds
zero model calls and requires no network, dependency installation or agent CLI.
It reproduces twelve delivery grades, six paired outcomes, all five cost
dimensions and their per-success denominators, cumulative budget/order checks,
the 194-call historical ledger and the additional receiver diagnostic.
The adoption decision is `reject`, with `automaticUpgrade: false`.
