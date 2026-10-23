# Bench claims and frozen measurement scope

This contract applies to the current source build (F7). It is not a claim that
these interfaces shipped in npm 0.13.1. Existing request schema 1, policy 1/2,
paired manifest 4 and single-arm summary 1 retain their outer versions.
Availability requires a build implementing bench schema 2 / measurementScope 1;
no minimum published npm release is assigned yet. The eventual release workflow
will name it; checking `--version` alone is insufficient.

## Declaring support

Bench schema 1 keeps its existing loading, selection and execution behavior.
Its tasks have no recorded claims, even if an old file contains an ignored field
with that name. New readers show `legacy-unrecorded`; missing historical metadata
does not create a new adoption requirement or acquire today's declarations.

Schema 2 is explicit opt-in. Every task must declare a nonempty, duplicate-free
`claims` array containing `quality`, `efficiency` or `activation`. `process` is
unsupported. An activation task must also have a boolean `shouldTrigger` label;
both positive and negative controls must declare activation support.

Claims describe the design support of the task. They do not prove that the bench
is valid, discriminative or sufficiently powered, or that any Skill is eligible
for adoption. Quality means the outcomes defined by these fixture/prompt/verifier
and named checks, not general security, performance, design or workflow quality.
Keep the existing NOP/oracle, offline control, independent validation, sample,
cost and regression gates in [metrics](metrics.md) and [policy](eval-component.md).

The [bench schema](schemas/bench.schema.json) documents the file shape. The
loader additionally validates referenced paths/commands, distinct task IDs and
existing file safety rules. No existing bundled or historical bench is upgraded.

## Target selection and refusal

| Entry | Requested claim |
| --- | --- |
| Ordinary paired eval or policy 1 request | `quality` |
| Explicit policy 2 request | `efficiency` |
| Trigger | `activation` |
| Calibration or fixed synthetic self-test | `null` (diagnostic only) |

No `objective` field is added to request schema 1. Policy 2 remains the existing
explicit efficiency policy. Task selection retains bench order, then checks the
intersection of support across every selected task. The harness never removes
an incompatible task automatically. Preview can show `unsupported`; execution
refuses with `BENCH_CLAIM_UNSUPPORTED` before verifier, oracle or executor calls.
Schema 1 keeps its existing unlabeled-trigger skip behavior.

## Frozen scope and evidence

New previews, native plan details and summaries contain an optional
`measurementScope` object validated by [schema 1](schemas/measurement-scope.schema.json):

- `schemaVersion`: `1`; unsupported present versions are errors.
- `benchSchemaVersion`: `1` or `2`.
- `taskClaims`: nonempty ordered `{ taskId, claims }` rows. IDs are distinct;
  schema 1 uses `claims: null`, schema 2 uses the explicit array.
- `requestedClaim`: the table's claim or null.
- `assessment`: `supported`, `unsupported`, `legacy-unrecorded`, or
  `not-applicable` for null targets.

New readers reject malformed or contradictory metadata. Native audits compare
the summary with the native/reviewed plan, selected order and original sealed
bench. Replay uses those frozen inputs and the portable package's pinned runtime;
it does not read a changed external bench to supplement claims. Removing or
changing a new summary's scope while its native plan retains it fails audit.
Old records that lack scope stay unrecorded. A report policy override cannot
rewrite the frozen requested claim; unsupported schema 2 claims block adoption.
Observed quality numbers during an efficiency study remain observations within
the declared scope. They do not authorize an undeclared quality conclusion.

## Authoring and compatibility

`bench init` still defaults to schema 1. Select `--schema-version 2` explicitly;
the teaching task then declares only quality. For a schema 2 destination,
`bench add --freeze` and `--from-commit` require repeated `--claim` values.
Claims are checked before import or drafting. Activation also requires the
existing `--should-trigger yes|no` label. Passing claims to a schema 1 destination
refuses instead of silently upgrading it.

`bench edit --set 'claims=["quality","efficiency"]'` accepts a JSON array only
for schema 2. Required claims cannot be unset; edits remain previewed until
`--yes`, backed up, validated and rolled back on failure. `bench list/show`
display declarations and the legacy state. The normal fixture/import collision,
Git parent/submodule, file count/size and dry-run protections are unchanged.

For a fresh teaching bench, these current-source commands are local and make
no model calls. Replace the teaching inputs before evaluating benefit:

```bash
node dist/cli.js bench init scoped-bench --kind command --schema-version 2 --dry-run
node dist/cli.js bench init scoped-bench --kind command --schema-version 2 --yes
node dist/cli.js bench list scoped-bench --json
```

For known synthetic answers, use a bench with predeclared
[self-test controls](bench-self-test.md), not an inferred expectation from claims.

## Reading difficulty diagnostics

Pass counts and thresholds remain unchanged: ceiling is >=90%, floor <=10%,
and the interval between them describes observed baseline difficulty. Reports
separate `baselineBand`, `qualityHeadroom`, `efficiencyEligibility` and
`activationCoverage`. A ceiling limits observed quality headroom; it does not
discard a task from efficiency measurement. Baseline calibration alone cannot
establish quality equivalence or cost eligibility: compare paired costs,
variance, final counter coverage and named-check regressions separately.

Efficiency cost statistics can pass on a saturated synthetic example while the
existing synthetic gate still forbids adoption. Missing costs or a named-check
regression continue to block it. Activation requires representative positive
and negative labels plus actual detection coverage. These diagnostics are not
MDE estimates, power guarantees or trajectory-level scoring.
