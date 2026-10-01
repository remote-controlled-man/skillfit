Fixed base64 HTML decoding by converting the decoded bytes through UTF-8 `TextDecoder`.

Retained the Chinese/emoji regression: it failed on the original implementation and passes after the repair. Compatibility tests cover text handling, CSP/permissions metadata, MIME validation, missing content, and invalid base64.

Checks: `node --experimental-strip-types --test` — all 8 tests pass. `git diff --check` passes.
