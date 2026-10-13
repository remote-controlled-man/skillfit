# Repair path-like query parameters

Users of normalize-url report that a URL such as `https://example.com/index.php?/catalog/item` acquires an extra `=` after normalization. The defect occurs with default query sorting; disabling sorting preserves the original shape. Bare query parameters and parameters with explicitly empty values are different public inputs and should retain that distinction.

Reproduce the reported failure with an executable regression, repair it, and retain the regression. Keep sorting enabled by default and preserve normal query sorting, the sorting opt-out, mixed bare/assigned parameters, similar parameter names, explicit empty values, ordinary URL normalization, fragments, encoded path backslashes, and Unicode parameter values. Work entirely in this local pre-fix snapshot; do not access an upstream checkout or the network.

Change `index.js` and add uniquely named `*.test.mjs` files using Node built-ins. Keep every supplied test, type declaration, package file, README and license unchanged. Run local tests with `node --test test.mjs *.test.mjs`. The whole added suite must pass, and a unique public behavior test must fail on the original implementation and pass on the pinned maintainer repair. The supplied AVA test.js is upstream context; its external development tools are not installed in this replay.
