# Offline readiness record

[`verification.json`](verification.json) records the eight original/full-repair
contrasts with the same registered regression, source and bench SHA-256 values,
all twenty injected-executor budget checks and thirteen bench-integrity checks.
It contains zero real model calls, no model efficacy outcome and no paid-call
authorization. See the [dated report](../../2026-10-15-independent-offline-readiness.md)
for scope, preparation failures, warnings and reproduction commands.

The fixtures, reference repairs, verifiers and pinned license/provenance data are
checked in under `benches/contrib/oss-skill-independent/`; runtime source and
regression tests are checked in under `src/` and `scripts/`. After building, run
`node scripts/check-independent-readiness.mjs` to reconstruct the checks. A new
output path is required when using `--out`; published records are not replaced.
Synthetic timing/timestamps can differ; named gates and unchanged source hashes
must agree. No dependency installation, network or model call is needed by the
reproduction itself.
