# Architecture decision records

This index records consequential architectural choices for skillfit. It is a
decision index, not a task checklist or another description of current runtime
capabilities. Use the [architecture entry](../architecture.md) for the system
and the [governance plan](../plans/2026-10-22-documentation-governance-and-architecture.md)
for authorized work, dependencies and progress.

## Decision index

| ID | Decision | Status | Delivery relationship |
| --- | --- | --- | --- |
| 0001 | [Document authority and historical boundaries](0001-document-authority-and-history.md) | proposed | D1 provides the existing inventory; D2/D3 own migration and continuous enforcement |
| 0002 | [Layering and shared execution mechanisms](0002-layering-and-shared-execution.md) | proposed | A2 shared extraction delivered; A4/A5 authoring and general enforcement pending |
| 0003 | [Plan, confirm and execute separation](0003-plan-confirm-execute-separation.md) | proposed | A3 evaluation/read delivery recorded; A4 authoring prepare/apply remains pending |

These records were written as A1 design deliverables on 2026-10-22. Proposed
status applies to the complete design decision: it does not revoke existing
repository safeguards or the already delivered D1 data/rules. None asserts that
all target services/layers, A5 gates or remote CI have been implemented. F7 is delivered locally.
D3 document gates, A2 shared extraction and A3 evaluation/read extraction are delivered in the current source;
complete decision acceptance remains separate from those partial deliveries.

## Record lifecycle

- Use a stable increasing number and a descriptive filename; never reuse a
  number. Each record contains Status/date/scope, Context, Decision,
  Consequences, alternatives, verification references and replacement links.
- `proposed` describes a decision awaiting the relevant authorized delivery or
  acceptance. Writing its document alone is not an implementation or acceptance.
- `accepted` records an actually accepted decision with its scope and evidence;
  it must not overstate which parts of a staged migration are implemented.
  Record that transition during the relevant authorized stage, without inventing
  a separate approval ceremony for routine repository work.
- `superseded` keeps the old record and links both the replacing and replaced
  decision. Preserve its original reasoning and consequences. No replacement
  relationships are asserted for the first three records.

Register new records and topic/check relationships under
[documentation governance](../documentation-governance.md). Existing plans and
dated evidence retain their recorded facts and authority limits; do not
retrospectively manufacture ADRs for decisions whose rationale is unknown.
