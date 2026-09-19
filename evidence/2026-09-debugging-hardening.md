# Bench hardening follow-up: synthetic hard tasks also saturate (2026-09-19)

Follow-up to [2026-09-debugging-bench-exploratory](2026-09-debugging-bench-exploratory.md). Same executor
(Kimi Code CLI v2.0.0), same skill (`diagnosing-bugs`, bundle sha256 `174139ebc836…`), same protocol.

## What we tried

Two new, deliberately harder diagnose-and-fix tasks added to `benches/debugging/`:

- `async-queue` — serial async task queue with three latent races (rejection strands the queue,
  enqueue-during-flight ordering, `onIdle` resolving before the last task settles).
- `chunked-decoder` — `<length>\n<payload>` frame decoder with three boundary bugs (header split across
  chunks, multi-byte UTF-8 split across chunks, unchecked length prefix).

Both verifiers were proven both directions before any model run: they fail on the pristine fixture and
pass on the ground-truth fix. Calibration run: `runs/eval-20260919-194430` (scratch 2-task bench, content
sha256 `ca6e37d01c43…`, 3 trials per condition).

## Result

| Task | Baseline | Treatment | Δ |
|---|---:|---:|---:|
| async-queue | 3/3 | 3/3 | 0pp |
| chunked-decoder | 3/3 | 3/3 | 0pp |

Both saturated. Across both benches built this week, six of seven authored tasks ceiling out for this
model; the only discriminative task is `range-parser` (strict spec compliance), and even it only separates
at 0/3 → 1/3.

## Conclusion

Hand-authored synthetic tasks — including race conditions and chunk-boundary bugs designed to be missed —
do not discriminate current strong models. The discriminative-material bottleneck cannot be solved by
authoring harder tasks; it has to come from **real production failures** (`skillfit bench add --freeze`),
which are non-saturated by construction. The debugging bench stays in the repo as the easy tier / regression
net (the harness warns about ceiling saturation automatically).

## Limitations

- Single model (Kimi Code CLI v2.0.0); a weaker or future model may find these tasks discriminating — the
  bench is kept for exactly that reason.
- 3 trials per cell; indicative only, per docs/metrics.md.
