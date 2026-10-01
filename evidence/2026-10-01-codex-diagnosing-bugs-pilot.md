# Codex CLI and `diagnosing-bugs`: execution and trigger pilot (2026-10-01)

**Status: exploratory; no efficacy verdict.** This run checked whether the current Codex CLI can execute the debugging bench with Matt Pocock's `diagnosing-bugs` Skill, and whether Codex consults the Skill when installed. Three completed pairs on one synthetic task showed a possible regression-test gain. A subsequent historical `oss-contrib` bug case was too easy for this model. These observations do not establish value for open-source work.

## Pinned inputs

- Skill source: [`mattpocock/skills` at `d81f3a183412e71a5b1e84ca21bc1a35eea03a60`](https://github.com/mattpocock/skills/tree/d81f3a183412e71a5b1e84ca21bc1a35eea03a60/skills/engineering/diagnosing-bugs). The fetched `SKILL.md`, `agents/openai.yaml`, and `scripts/hitl-loop.template.sh` matched the SHA-256 values in `profiles/codex-upstream-sources.json`. The skillfit bundle hash was `f19320ddde76…`.
- Agent: Codex CLI `0.158.0-alpha.2.1`. A direct CLI launch reported `gpt-6-sol`; skillfit manifests record `cli-configured` rather than a model ID, so the exact model served for every benchmark run was not independently captured. The custom trial executor set `model_reasoning_effort="medium"`, `--sandbox workspace-write`, and `--ephemeral`.
- Bench: bundled `benches/debugging` passed offline `bench check` with 36 passes, no warnings or failures (content hash `4ec827c25f6a…`). A two-task scratch subset containing `range-parser` and negative control `feat-slug` passed its offline check with 10 passes (content hash `f93042717b26…`). A later `range-parser`-only subset passed the NOP and oracle gates (content hash `7069681c5bc2…`); its only warning was the absence of a negative control, which matters for trigger mode, not this paired inject-mode probe. Both subsets were made by copying the bundled bench and filtering `bench.json` task entries.
- Harness: skillfit `0.7.0`. `npm test` passed 321 tests at the initial preflight. The working checkout received other changes during the live pilot; the compiled `dist/` files used by the trial were not given a separate immutable hash. Treat these runs as a local diagnostic, not a reproducible published efficacy result.

## Execution findings

The first baseline calibration used the matrix's default `codex exec -`. On `ttl-cache`, Codex identified the defects but explicitly reported that the workspace was read-only and it could not save its patch. That 0/1 was an **executor configuration failure**, not a quality failure. The calibration was stopped.

A scratch executor then invoked Codex directly with a writable workspace, medium reasoning, no shell wrapper, and a 180-second per-run timeout. It used the ordinary `runEval` pairing and verifiers; the Skill was staged under the temporary directory name `skillfit-matt-diagnosing-bugs`, so the injected name did not match the Skill frontmatter name. This naming mistake is another reason not to generalize the result.

| Task | Baseline | Forced-Skill arm | Protocol result |
| --- | --- | --- | --- |
| `range-parser` | Completed; 7/8 facets, missing a real RED→GREEN regression test | Exceeded the 180-second timeout; the remaining files passed 8/8 when graded manually afterward | Pair excluded because the executor did not finish |
| `feat-slug` (negative control) | Completed; 6/6 facets | Exceeded the 180-second timeout; the remaining files passed 6/6 when graded manually afterward | Pair excluded because the executor did not finish |

The post-timeout file checks are observations, **not scored treatment successes**. The inject-mode manifest has zero graded pairs, so its pass-rate delta and McNemar verdict are unavailable. Raw local records: `runs/codex-matt-debug-pilot-20261001-a/manifest.json` and each trial's `_result.json`.

## Completed paired probe

The Skill was restaged under its declared name, `diagnosing-bugs`. A `range-parser`-only bench used the same fixture, prompt, verifier, Codex version, medium reasoning, and writable sandbox in both arms, with a 600-second completion deadline. Three adjacent pairs completed without executor errors, split between run groups `codex-matt-range-pair-20261001-a` (one pair) and `codex-matt-range-pair-20261001-b` (two pairs). Their manifests record identical bench and Skill hashes and executor descriptions.

| Pair | Baseline | Treatment | Baseline / treatment time |
| --- | --- | --- | --- |
| A1 | 7/8 facets; fail | 8/8 facets; pass | 75.7s / 77.2s |
| B1 | 7/8 facets; fail | 8/8 facets; pass | 103.9s / 79.7s |
| B2 | 7/8 facets; fail | 7/8 facets; fail | 72.6s / 89.3s |

In every baseline run, the implementation passed seven behavioral checks but lacked a real RED→GREEN regression test. Treatment supplied that test in two of three runs. Manually pooling these same-configuration manifests gives baseline **0/3**, treatment **2/3**, with two treatment-only wins and no baseline-only wins. The two-sided exact McNemar p-value is **0.5**: this is a candidate artifact signal, not a statistically supported benefit. One task and three trials are below the protocol's 8-task × 5-trial scale; the binary baseline is also at the floor. Token usage was unavailable for these inject-mode CLI runs. Raw local records: `runs/codex-matt-range-pair-20261001-a/manifest.json` and `runs/codex-matt-range-pair-20261001-b/manifest.json`.

## Natural triggering

With the source directory correctly named `diagnosing-bugs`, one installed-Skill trial per task produced:

| Task | Should trigger? | Detected read of `SKILL.md` | Task result |
| --- | --- | --- | --- |
| `range-parser` | yes, per bundled label | no | 7/8 facets, fail |
| `feat-slug` | no | no | 6/6 facets, pass |

The small trigger manifest is `runs/codex-matt-trigger-pilot-20261001-b/manifest.json`. Its 0/1 recall and 0/1 false-trigger counts have very wide uncertainty. `range-parser` presents a specified implementation task rather than an uncertain bug, so its positive trigger label is questionable for this particular Skill.

An earlier incident-style `ttl-cache` trial **did** read `.agents/skills/skillfit-matt-diagnosing-bugs/SKILL.md`, as shown by its saved `_transcript.jsonl`, and its task verifier passed. Because the temporary folder name differed from `diagnosing-bugs`, the detector falsely reported no trigger; that manifest's trigger rate is invalid. A correctly named rerun timed out at 180 seconds before it returned a transcript, so it supplies no formal trigger observation. Local records: `runs/codex-matt-trigger-ttl-20261001-a/` (raw trace; detector mismatch) and `runs/codex-matt-trigger-ttl-20261001-b/` (excluded timeout).

## Historical open-source case calibration

To test whether new PRs are necessary, a separate local bench reconstructed the pre-fix `mcp-use/mcp-use` TypeScript `resolveViewResource()` at public commit [`d90a070`](https://github.com/mcp-use/mcp-use/blob/d90a070615a910b96eaf65f65f9eb4cad0123a90/libraries/typescript/packages/client/src/react/view/resolve-view-resource.ts). Its `atob(blob)` path returned garbled Chinese and emoji because it treated UTF-8 bytes as Latin-1 characters. The local prompt described the symptom without revealing the source change. The 8-facet verifier covered Unicode and ASCII blobs, text precedence, metadata, CSP, missing content, a passing final suite, and a regression test that fails against the original source. The scratch bench passed `bench check`: the untouched fixture failed, and the reference solution passed every facet. The bench is local at `/private/tmp/skillfit-oss-mcp-view`, not a published reusable bench.

One adjacent pair used the same Codex CLI executor and pinned `diagnosing-bugs` bundle as the completed synthetic probe. **Both baseline and treatment passed 8/8 facets**, including the RED→GREEN regression test (63.0s and 74.6s respectively). The run manifest is `runs/codex-matt-oss-view-20261001-a/manifest.json`; the bench hash is `2729a41a55ff…`. The baseline's 100% pass rate means this case has no observed headroom to measure Skill benefit. A single pair also cannot support a statistical conclusion. No GitHub PR or upstream write occurred.

## Interpretation and next gate

The offline bench and pairing machinery are usable, and the completed synthetic probe suggests `diagnosing-bugs` can increase valid regression-test production on one task. The historical OSS case demonstrates that existing fixes can be replayed without making new PRs, but it does not answer whether the Skill improves open-source bug fixing because baseline solved it fully. The default Codex command needs an explicit writable sandbox for command-graded tasks. Live runs also need a controlled completion deadline and a Skill directory whose basename matches its declared name. A future efficacy run should select harder pinned, self-contained cases from real `oss-contrib` fixes, calibrate baseline difficulty against the same model and settings, then collect completed pairs across multiple task shapes. PR acceptance is an external outcome and should not replace local behavioral verification.
