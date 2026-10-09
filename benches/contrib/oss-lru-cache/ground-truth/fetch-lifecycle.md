# fetch-lifecycle contract

Source requirement: https://github.com/isaacs/node-lru-cache/commit/451737cf4f82dc268b88530a559f900837261733

Preimage: `425dd43e921d1da9761e297ece18631fac831e15`. Reference fix: `451737cf4f82dc268b88530a559f900837261733`. The reference solution copies only the primary implementation module from that fix and adds an executable regression; helper modules, smoke tests, metadata, loader and license are protected. Source hashes and extraction details are in `provenance.json`.

The deterministic verifier checks the issue contract, ordinary LRU behavior, concurrent fetch deduplication, unchanged protected assets, and a new regression that fully passes the submitted code and contains a uniquely matched test case that fails on the original primary source and passes on the unmodified upstream reference fix. Added tests must execute real unskipped Node tests. Async checks use a setImmediate turn barrier, not elapsed-time thresholds. One lifecycle probe leaves the original synchronous fetch pending and checks its observed settlement state without waiting indefinitely.

A score is passed checks / all checks; full pass requires every check. The task is not a replay of upstream CI, and implementation extraction excludes package release/types/browser compatibility. Calibrate before interpreting difficulty or Skill benefit.

The case-level third-side gate rejects tests that only assert a new unrelated field/interface. It uses trusted Node reporter events with relative file, complete parent path and name; ambiguous duplicate identities, cancelled/timed-out/import-failed original runs and spoofed stdout cannot supply a witness. The entire submitted suite must pass without skip/todo/cancellation; other tests may expose failures in the imperfect reference fix. This is mechanical corroboration, not a proof of semantic relevance. Independently review test content before calibration.
