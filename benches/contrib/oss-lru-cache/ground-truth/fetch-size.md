# fetch-size contract

Source requirement: https://github.com/isaacs/node-lru-cache/issues/269

Preimage: `f33a3e42b89c019a4a934ede39da44793b2c3f21`. Reference fix: `c8cae78cdbdce74cbccaaa88d422dfe38ad55810`. The reference solution copies only the primary implementation module from that fix and adds an executable regression; helper modules, smoke tests, metadata, loader and license are protected. Source hashes and extraction details are in `provenance.json`.

The deterministic verifier checks the issue contract, ordinary LRU behavior, concurrent fetch deduplication, unchanged protected assets, and a new regression that passes the submitted code and fails when the original primary source is restored. Added tests must execute real unskipped Node tests. Async checks use a setImmediate turn barrier, not elapsed-time thresholds. One lifecycle probe leaves the original synchronous fetch pending and checks its observed settlement state without waiting indefinitely.

A score is passed checks / all checks; full pass requires every check. The task is not a replay of upstream CI, and implementation extraction excludes package release/types/browser compatibility. Calibrate before interpreting difficulty or Skill benefit.
