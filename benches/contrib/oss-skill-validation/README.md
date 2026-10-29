<a id="independent-debugging-skill-validation-tasks"></a>

# Asynchronous mapping and cache lifetime defects

Eight historical upstream defects from p-map and quick-lru cover asynchronous
input order, concurrency, early termination, iterator cleanup, source errors,
cold thenables and cache lifetime semantics.

`provenance.json` pins each pre-fix parent and maintainer fix. Source, upstream
documentation and original metadata are retained; minimal Node test scripts
replace the upstream development dependencies. Fixtures have no runtime package
dependencies and run offline. Maintainer patches and solutions remain outside
the agent workspace. Task prompts specify the reported behavior and retained
regression deliverable, without requiring a particular implementation.

Each task has six outcome checks: unchanged supplied assets and smoke behavior,
four public behavior groups, and a submitted regression that passes against the
repair and the upstream fix while failing against the original. Controlled
promise resolution and event-loop turns replace timing sleeps; cache tests use
an explicit simulated clock, restored after each check.

```bash
node dist/cli.js bench check benches/contrib/oss-skill-validation
```

The task mix is limited to JavaScript asynchronous mapping and cache behavior
in two repositories. Statistical scale alone does not establish broad debugging
improvement or absence of future harm. The bench has no negative routing cases;
it evaluates installed revision outcomes rather than trigger precision.

See the [bench directory layout](../../README.md#bench-directory-layout) for task
grouping and manifest ownership. Shared grading code stays in `verifiers/`. MIT
source notices are retained.
