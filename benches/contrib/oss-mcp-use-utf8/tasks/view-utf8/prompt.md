# Task: fix garbled Unicode in MCP App HTML resources

Users report that an MCP App view renders Chinese text and emoji incorrectly when its HTML arrives as a base64 `blob`. The same HTML works when supplied as `text`. This fixture contains the relevant `resolveViewResource` implementation from a real pre-fix mcp-use revision, with the external MIME constant stubbed locally.

Reproduce the reported behavior with an executable regression test, repair the implementation, and keep the regression test. Preserve existing text handling, CSP and permission metadata, MIME validation, and missing-content behavior. Use Node built-ins only. Work entirely in this local snapshot; do not access the network or an upstream checkout.

Run the tests with `node --experimental-strip-types --test`. Keep tests in `test/*.test.mjs`.
The retained regression must pass after the repair and fail if the original implementation is restored.
