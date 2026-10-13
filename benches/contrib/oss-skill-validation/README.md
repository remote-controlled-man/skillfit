# Independent debugging Skill validation tasks

Eight historical upstream defects from p-map and quick-lru cover asynchronous
input order, concurrency, early termination, iterator cleanup, source errors,
cold thenables and cache lifetime semantics. These tasks are separate from the
minipass development set and were selected before observing its candidate
outcomes. No task or check was generated from a Skill instruction.

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

Freeze the complete bench, Skill resources, execution configuration and trial
count before evaluating a candidate. Eight tasks with five paired trials require
80 calls, excluding any separately declared readiness/development work. Report
every task, pair, regression, failure and spending population. Do not add trials
until a significance threshold is reached or edit a candidate against this set
and continue calling it independent validation.

The task mix is limited to JavaScript asynchronous mapping and cache behavior
in two repositories. Statistical scale alone does not establish broad debugging
improvement or absence of future harm. The bench has no negative routing cases;
it evaluates installed revision outcomes rather than trigger precision.
