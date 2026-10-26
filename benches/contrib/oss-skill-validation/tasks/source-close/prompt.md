When pMap rejects because a mapper fails or an AbortSignal aborts, its source iterator is left open and does not release resources. Diagnose and repair source cleanup, preserving the original rejection and normal completion semantics.

This is pinned historical upstream source. It has no runtime package dependencies; npm test uses only Node. Change index.js and add a new executable *.test.mjs regression using node:test and the public API. Keep supplied tests, metadata and documentation unchanged. Explain the cause and checks actually run. Do not fetch upstream fixes or use the network.
