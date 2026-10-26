<a id="prospective-debugging-skill-followup-tasks"></a>

# Debounce and duration formatting defects

Eight historical defects from p-debounce, debounce and humanize-duration exercise
promise rejection, overlapping calls, receiver preservation, recursive callbacks,
timer boundaries and displayed duration counts. Tasks live under `tasks/<id>/`;
`bench.json` owns commands and `verifiers/` holds shared grading code.

| Task | Independently published repair |
| --- | --- |
| promise-falsy-rejection | [Preserve falsy rejection reasons](https://github.com/sindresorhus/p-debounce/commit/a14c7ac6817248b8db13eb0d30474c1f82588fe6) |
| promise-overlap-results | [Resolve calls made during execution correctly](https://github.com/sindresorhus/p-debounce/commit/bcbea56f7a8b42fdaadcda5724c045c6545a2e58) |
| promise-method-context | [Preserve the method receiver](https://github.com/sindresorhus/p-debounce/commit/cfed83ccf57e71c1bb058e7e16429ec252c1bf69) |
| duration-plural-count | [Choose forms using the displayed count](https://github.com/EvanHahn/HumanizeDuration.js/commit/924c2a183e3a2b7e08fe5fead6bf18bfab0568a6) |
| duration-large-digits | [Preserve scientific notation with replacement digits](https://github.com/EvanHahn/HumanizeDuration.js/commit/e44e0a9d2803cd85506067fa5a6a22e4cd660a02) |
| debounce-context-classes | [Allow different class contexts](https://github.com/sindresorhus/debounce/commit/205fd8fb3ddae14ab2fbb6cbf9767d2042f154a0) |
| debounce-recursive-args | [Retain recursive callback arguments](https://github.com/sindresorhus/debounce/commit/c997759c1be6e895e9b26af740c42744a777675f) |
| debounce-timer-boundary | [Keep the quiet interval at a timer boundary](https://github.com/sindresorhus/debounce/commit/bdb9228b78bca3442b3e5de7224a046154bc0c0a) |

`provenance.json` pins every parent and full maintainer source, Git blob IDs,
source/resource hashes, public URLs and adaptations. Sources and original
documentation remain byte-identical. The single source file is named `index.js`
in each fixture; original package metadata is retained separately while a
minimal package runs dependency-free Node tests. The legacy debounce README
declares MIT and credits Underscore but has no standalone license file. Its
fixture also retains the original implementation's MIT notice, pinned to
Underscore 1.8.3; this additional attribution is identified in provenance.

Each outcome verifier has six checks: immutable assets and ordinary smoke
tests, four public behavior groups, and an executable regression witness.
The submitted regression must have a matching registered test that fails on
the original and passes on both the submission and full maintainer repair.
Import failures, cancellations, timeouts, skipped tests and fabricated output
cannot supply that witness. Maintainer solutions and outcome checks stay
outside agent workspaces.

Promise resolution gates and a deterministic timer queue reproduce overlaps,
reentry and equal-time scheduling without timing sleeps. The clock helper is
immutable and only changes globals inside test processes; the eval runner's
real timing and sleep-anomaly guards stay unchanged. Two larger fixtures retain
their full upstream language tables and documentation. Use workspace delivery
for the real comparison rather than trimming source to satisfy an inject-size
warning. Positive-only task routing does not measure false-trigger rate.

```bash
node dist/cli.js bench check benches/contrib/oss-skill-followup
```

This task mix remains limited to JavaScript async wrappers, callbacks and
duration formatting in three repositories. It cannot establish universal
debugging improvement. Difficulty requires a separately authorized baseline
calibration. A candidate tuned against these cases needs a separate frozen
validation set.
