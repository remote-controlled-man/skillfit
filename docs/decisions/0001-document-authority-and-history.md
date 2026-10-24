# ADR 0001: Document authority and historical boundaries

**Status:** proposed. **Date:** 2026-10-22.
**Scope:** Source documentation governance; no CLI or evidence-format change.
**Supersedes:** none. **Superseded by:** none.

## Context

Current guides, implementation plans, release records and dated evidence answer
different questions. Copying status and contract details between them makes
changes easy to miss. Keeping original evidence is also essential to interpreting
old measurements. When this proposal was written, D1 had delivered a document
registry, topic authority, roles and examples, with production checking assigned
to D3. Current delivery status belongs to the [stage plan](../plans/2026-10-22-documentation-governance-and-architecture.md#当前执行状态).

The [governance rules](../documentation-governance.md) and original repository
instructions already require preserving published evidence and current task
authorization. This ADR proposes the complete long-term maintenance design;
its proposed status does not alter those existing requirements.

## Decision

Give each topic one canonical explanation with explicit source/schema evidence,
maintenance role, applicability and checks. Let entry pages route readers there.
The current task plan owns its checklist; the release record owns publication;
the study index owns cumulative study status. Registration is data for source
maintenance, not a runtime dependency or proof that a check has run.

Keep tutorials, how-to guides, references, explanation, plans, decisions and
records distinct in responsibility. Preserve existing paths/anchors when
reorganizing. Mark historical proposals honestly without inferring completion
or renewing spending authority. Preserve frozen observations and released
recipes/receipts; corrections get new linked records. D3 should enforce
deterministic inventory/reference rules while human review assesses prose.

## Alternatives considered

An index-only cleanup improves navigation but leaves ownership and update
dependencies implicit. A new documentation site changes presentation while
leaving these problems unresolved and adds a toolchain. Duplicating full
contracts in every guide reduces clicking but increases drift. Use the existing
Markdown/JSON tools and link to the one authority instead.

## Consequences

Readers and maintainers gain a clear source of current rules and evidence.
Maintainers must update registration and review dependent summaries when a
contract changes. Extra metadata has a cost, so frozen input collections are
handled narrowly through their existing checks rather than individually edited.
Link or schema checks still cannot establish all factual or translation accuracy.

## Delivery and verification

D1 inventory/rules are existing delivered work. D2 owns content/anchor migration;
D3 owns production parsing, discovery and CI. Verify existing link/readme/release
checks, registry examples and manual topic/source review; preserve frozen bytes.
See the [governance contract](../documentation-governance.md#document-registry),
[D1 examples](../examples/documentation-policy.valid.json),
[documentation tests](../../scripts/check-docs.test.mjs) and
[stage plan](../plans/2026-10-22-documentation-governance-and-architecture.md).
This record does not mark D2/D3 or another plan complete.
