# Release procedure

Current source contains unpublished changes beyond npm 0.13.1. The package
version alone does not identify a source checkout. See the [changelog](../../CHANGELOG.md)
and [fixed 0.13.1 record](https://github.com/remote-controlled-man/skillfit/blob/3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850/docs/releases/0.13.1.md)
for published behavior. This guide operates the existing
[npm release workflow](https://github.com/remote-controlled-man/skillfit/actions/workflows/npm-release.yml);
its [definition](https://github.com/remote-controlled-man/skillfit/blob/ed5eaff7d222de1c73874ce022785fbe89291017/.github/workflows/npm-release.yml)
and release tools enforce the steps below. Dispatch only within explicit release
authorization; reading or editing this guide does not start a workflow. Run local
maintainer commands from the reviewed source checkout: release orchestration
tools are source-only; the npm package carries installed verification recipes.

## Prepare the source

1. Choose a new unpublished version. Update package/lockfile/changelog and current
   README/Skill command pins together; retain historical feature minimums. Refresh
   affected standalone Skill/source-reference links to an already delivered full
   commit containing the described behavior; preserve published-version doc links.
   Use relative links only for files that ship together. The source-only current
   plan and release tooling are excluded from npm; do not link them as package files.
2. Review changes and run `npm test` plus relevant local checks. Follow the normal
   repository delivery rules to land the reviewed source on `main`.
3. Require completed full **main push CI for that exact commit**, including its
   three OS test receipts. A local pass, PR run or records-only check cannot replace
   it. The release workflow verifies this existing source proof; it does not run
   another full source suite. A missing proof blocks publication.

The workflow runs only for this repository's `main` branch. Keep the same source
through preview and publication; a changed source/version requires a fresh preview.

## Preview the package

In Actions, open **npm release → Run workflow**, select `main`, and set:

| Input | Preview value |
| --- | --- |
| `dry_run` | `true` |
| `preview_run_id` | Leave empty |
| `preview_run_attempt` | Not used for preview; keep the default |

Wait for completion, then inspect the summary and the
`npm-release-<run-id>-<attempt>` artifact. Review `preview.json`, `pack.json`, the
original tarball, version, source commit, source-CI identity and SHA-256. A preview
builds/checks the package and uploads its review artifact; it does not publish.
Retain the exact preview run ID **and attempt**, rather than following a later rerun.

## Publish the reviewed bytes

After publication is authorized, start a **new** workflow dispatch on the same
`main` source. Set `dry_run=false`, `preview_run_id` to the successful reviewed
preview ID, and `preview_run_attempt` to its reviewed attempt number. Follow the
summary's generated dispatch command or enter these fields in Actions.

The workflow retrieves the original preview tarball, validates its source/CI/hash,
checks that the version is unpublished, and persists a publication intent before
its single npm upload. The formal release uses the reviewed bytes; it does not
repack them. A prior intent for that version or a publication rerun is refused.

## Check acceptance and retain the delivery

Read the workflow summary and `acceptance-state.json`. All six stages must pass,
in order: `registry-install`, `documents`, `examples`, `features`, `provenance`,
`signatures`. They check actual registry installation, Skill/documents, runnable
examples, installed behavior/current portable replay, source provenance and
registry signatures. Registry checks require network access; none calls a model.
A successful upload alone is not completed acceptance.

Successful acceptance creates `records/manifest.json` and hash-linked
`records/receipts/`. Download the complete release artifact, then verify its
standalone `records/` directory:

```bash
node tools/release/release-records.mjs <downloaded-release>/records
```

Replace the placeholder with the actual downloaded path. Keep the reviewed
package and complete verified records with the versioned delivery before the
workflow artifact expires; the workflow currently retains artifacts for 90 days.
Record actual completion and the proof location in the existing plan. Receipt
generation/checking does not write repository pages or import records into source.

## Handle a failed or interrupted attempt

Preserve the complete artifact, `publication-intent.json`, optional
`publication.json`, acceptance state and logs. Check the summary's upload state
and first failed stage. After an upload or ambiguous upload, do not rerun
publication or upload that version again.

The existing `release-acceptance.mjs recover <original-result-dir> <fresh-attempt-dir>`
operation copies original inputs to a fresh external attempt, checks registry
provenance when upload acceptance is unknown, and reruns acceptance without
publishing. Use it only within recovery authorization; it requires the original
result directory and network access. If registry proof is unavailable, acceptance
remains unknown. Preserve the original failed attempt. A new version/source needs
a separately reviewed release; recovery never substitutes newly built bytes.

## Package and receipt contracts

The standalone manifest remains schema 3. Verification protocol 3 requires six
stages; protocol 2 verifies complete older eight-stage bundles read-only. Partial,
mismatched or unknown protocols fail. Repository receipt import and historical-
study restore/rerun are retired.

npm carries the runtime, reusable Bench inputs, current user docs, profiles,
driver Skill and the installed feature recipes actually used by acceptance.
Development fixtures/tooling, the current plan and generated runs stay out.
`tools/verify/check-package.mjs` checks inventory and size without an archive
catalog. See [architecture](architecture.md) for owners and write contracts.
