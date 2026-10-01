# Real OSS workflow example: mcp-use HTML resource UTF-8

This is a real source defect replayed in a small, offline fixture. It is a
**workflow and regression example**, not a claim that this case is difficult or
that any Skill helps. Earlier snapshot pilots passed in both arms.

## Source and adaptation

- Repository: [`mcp-use/mcp-use`](https://github.com/mcp-use/mcp-use).
- Pre-fix commit: `d90a070615a910b96eaf65f65f9eb4cad0123a90`.
- Original path: `libraries/typescript/packages/client/src/react/view/resolve-view-resource.ts`.
- Original Git blob: `160f426753aaac5bd89bc4c01564b8d975c1815b`. The fixture's
  `src/resolve-view-resource.ts` retains those exact bytes.
- Upstream MIT notice is retained in `LICENSE.upstream` and the fixture `LICENSE`.
- `ext-apps-bridge.js` replaces the external runtime import with its MIME constant.
  Type-only dependencies are erased by Node's built-in TypeScript stripping.
  The fixture does not exercise React rendering, the full package or its build.
- The prompt, visible sanity test, verifier and reference repair were authored for
  this replay. The reference is not represented as an upstream merged patch.
- Requires Node **22.6+** for `--experimental-strip-types`; no installed package,
  network, model or agent is needed for the offline gate.

## Request-to-check contract

The request names the Unicode blob symptom, existing behaviors to preserve, and
an executable retained regression. It does not disclose the repair. Eight checks
grade observable results, including tests that are rerun on the original source:

| Request requirement | Hidden check |
|---|---|
| Repair Chinese text/emoji in base64 HTML | Unicode blob round-trip |
| Preserve existing blob behavior | ASCII blob unchanged |
| Preserve text handling | text content takes precedence |
| Preserve CSP and permission metadata | content-level metadata merges over listing |
| Preserve permissive CSP behavior | permissive CSP stays unenforced |
| Preserve MIME validation and missing-content behavior | MIME validation and missing-content behavior |
| Repair and retain executable tests | final test suite passes |
| Regression catches the original reported defect | regression test is red on original source |

The checker does not grade debugging narration, the order of edits or whether a
particular algorithm was used. The eight checks are frozen by the bench hash.
This adapted fixture narrows the claim to this function and its local tests.

## Replay from a built skillfit checkout

```bash
node dist/cli.js bench check benches/contrib/oss-mcp-use-utf8
node dist/cli.js eval evidence/inputs/diagnosing-bugs --bench benches/contrib/oss-mcp-use-utf8 --input workspace --agent codex --trials 1 --dry-run
node dist/cli.js eval evidence/inputs/diagnosing-bugs --bench benches/contrib/oss-mcp-use-utf8 --input workspace --agent codex --trials 1
node dist/cli.js report eval <manifest-path-printed-by-eval>
```

The real pair makes **two agent calls**. It checks the workflow; one task × one
pair is indicative. The target is a vendored, pinned evaluation input, not an
installed Skill. Source details are in `evidence/inputs/README.md`. Use
`docs/oss-task-evaluation.md` to prepare your own task and a fixed validation run.
