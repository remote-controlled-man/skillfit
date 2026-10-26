<a id="historical-minipass-stream-defects"></a>

# Stream completion and backpressure defects

Four actual upstream defects exercise asynchronous completion, buffered readable
notifications, slow proxy pipelines, and completion listener lifecycles.

Each fixture retains the pre-fix `index.js`, upstream README, license and package
metadata. `provenance.json` pins parent/fix commits, source hashes, dependency
archives and fixture adaptations. Public upstream fix patches remain outside
the agent's workspace. The offline loader resolves unchanged historical source
against pinned vendored yallist 3.1.1 or 4.0.0; no installation is needed.

Only `index.js` and new `*.test.mjs` files are editable task deliverables. The six
checks cover unchanged assets and smoke behavior, four public outcome groups,
and retained executable regression evidence. The same submitted regression case
must pass against the repair and the maintainer fix, and fail against the
original source. The grader accepts alternative implementations and does not
inspect diagnostic prose, hypotheses or source wording.

```bash
node dist/cli.js bench check benches/contrib/oss-minipass
```

The pipeline fixture preserves the upstream integration seam rather than
replacing it with a direct stream connection. Deterministic event-loop drainage
replaces timing sleeps. Each grader and known-correct oracle runs offline.
Difficulty and baseline saturation require live calibration; none of these
tasks measures negative Skill routing.

Tasks are grouped under `tasks/<id>/`; `bench.json` owns membership and commands.
The upstream ISC notices are retained.
