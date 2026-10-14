# Real normalize-url query-shape replay

This task replays [issue #193](https://github.com/sindresorhus/normalize-url/issues/193)
from `sindresorhus/normalize-url`: default query sorting adds an equals sign to
bare path-like parameters. Baseline source is commit
`0d866eb2fd3f96fba7dfbc2687cefe001cdc96ad`; the reference is the
[maintainer's fix](https://github.com/sindresorhus/normalize-url/commit/92eb7034f4c01c2075926a53261080a7fb2a93a7).
The runtime source, declarations, metadata, README, AVA tests and MIT license
retain exact upstream bytes. `provenance.json` records Git blobs and SHA-256.

The local fixture adds a Node-only smoke test. The prompt, hidden public behavior
checks, test-case evidence gate and reference regression are local adaptations.
Eight checks cover bare/assigned parameter semantics, sorting and its opt-out,
similar names, ordinary normalization, fragments, encoded backslashes, Unicode,
protected assets and executable regression evidence. The entire new suite must
pass, without skipped/cancelled cases; a unique case must assert-fail on original
source and pass on the maintained reference. Structured Node reporter evidence
prevents test stdout from impersonating a pass. Runtime behavior is probed in a
subprocess so an implementation cannot terminate the grader with a successful exit.

```bash
node dist/cli.js bench check benches/contrib/oss-normalize-url
```

The offline gate needs Node 22+ and no dependencies, network or model. AVA,
coverage, lint, type declarations and the upstream full CI are not executed.
This is one historical task from a second repository, not general efficacy
evidence. Difficulty was not calibrated before the declared v2 transfer pilot.
