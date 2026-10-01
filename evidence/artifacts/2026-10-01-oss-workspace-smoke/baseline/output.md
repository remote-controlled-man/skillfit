Fixed base64 HTML decoding by converting `atob()` bytes to UTF-8 with `TextDecoder`.

Retained a regression test that failed on the original implementation and passes after the fix. Tests also verify text handling, CSP and permission metadata, MIME validation, and missing-content behavior.

All 6 tests pass with `node --experimental-strip-types --test`. `git diff --check` passes.
