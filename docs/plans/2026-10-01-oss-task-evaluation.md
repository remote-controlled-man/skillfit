# Real OSS task evaluation — implementation plan

Date: 2026-10-01. Owner: the “检查 Codex MCP 和 Skills 配置” session.
Integration and review: the “按审计工单执行各波修复” session.
Base: `628bf69` (includes the five-trial default and Codex writable sandbox).

## Outcome

Turn a pinned real coding task into a repeatable local Skill comparison, with a
report that explains what the observations support and what remains unmeasured.
A single task can inform a decision about that task; it cannot establish general
OSS contribution efficacy. Maintainer acceptance is outside this experiment.

## Work, in order

1. **Preserve real task presentation.** Add `eval --input workspace` for paired
   CLI experiments. Both arms get the same task request and identical copied
   files; they inspect files on disk instead of receiving an inline repository.
   Treatment still force-injects Skill content so activation remains a separate
   measurement. Retain `snapshot` as the compatible default. Reject unsupported
   API and trigger combinations before a run. Record the input mode in receipts
   and the manifest, and expose it in dry-run plans and Markdown reports. Give
   baseline calibration the same option so calibration and evaluation match.
2. **Preserve the issue request when importing a fix.** Honor the existing
   `--prompt` / `--prompt-file` options for `bench add --from-commit`. Do not force
   a fix commit's subject/body into the task when an original issue prompt was
   supplied. Keep the pre-fix fixture and hidden fix tests unchanged.
3. **Make the decision understandable.** Extend `report eval` with recorded facet
   scores and a bounded installation decision: synthetic runs, executor errors,
   saturation, sample size, missing activation and missing token cost must be
   visible. Preserve the frozen statistical verdict protocol and existing v4
   manifests; do not equate an inconclusive result with an ineffective Skill.
4. **Ship a reproducible real case.** Move the previously calibrated mcp-use
   Unicode HTML resource case into a self-contained bench with pinned source,
   license/provenance, a requirements-to-check mapping, a reference repair and
   offline NOP/oracle gates. It is a workflow/regression example, not a new
   difficulty claim. Run one predeclared workspace A/B pair with the pinned Matt
   `diagnosing-bugs` Skill to verify the new path, and write a new dated report.
   Keep the earlier exploratory evidence and raw runs unchanged.
5. **Document and hand off.** Explain the import → check → calibrate → fixed
   paired run → activation → report workflow, including dependency preparation,
   environment caveats and single-task scope. Mirror user-visible flags in all
   five READMEs. Run the full offline suite and bench checks, commit on
   `codex/oss-task-evaluation`, and send the implementation, validation results,
   evidence and open limitations to the integration session for review/merge.

## Acceptance

- A CLI executor sees no fixture source text in a workspace prompt, can edit the
  copied fixture, and is graded afterward; baseline/treatment fixtures match.
- Existing snapshot experiments retain their presentation and scoring semantics.
- Unsupported combinations fail before creating output directories.
- Calibration and paired runs use the same selected input presentation.
- A supplied issue request survives commit import without fix-message hints;
  existing trailing whitespace/newline normalization is retained.
- Real bench: untouched fixture fails; reference solution passes every check;
  regression tests fail again when the original source is restored.
- Reports show per-facet observations, input mode and actionable evidence gaps
  without changing `effective` / `ineffective` / `inconclusive` semantics.
- `npm test` is fully green before commits; tests call no real model or agent CLI.
- One real paired smoke run is separate from tests and clearly labelled indicative.
- The main checkout's three evidence drafts stay intact. This session does not
  merge; the integration session owns conflict resolution and merge.

## Boundaries and deferred work

No global Skill installation, upstream contribution PR, npm publication, new
runtime dependency, automatic network dependency installation or unplanned
80-call experiment. Full installed-Skill competition, verified model identity,
complete environment isolation and a sufficiently varied efficacy benchmark
remain further work. Workspace presentation removes prompt inlining; it does
not make arbitrary repositories dependency-free or prevent a CLI from accessing
resources allowed by its own sandbox.
