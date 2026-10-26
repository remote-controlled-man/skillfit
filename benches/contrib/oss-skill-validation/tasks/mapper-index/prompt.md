When pMapIterable consumes promises that settle out of input order, mapper indices no longer match input positions. Diagnose and repair index assignment while retaining output order, skip handling and concurrency.

This is pinned historical upstream source. It has no runtime package dependencies; npm test uses only Node. Change index.js and add a new executable *.test.mjs regression using node:test and the public API. Keep supplied tests, metadata and documentation unchanged. Explain the cause and checks actually run. Do not fetch upstream fixes or use the network.
