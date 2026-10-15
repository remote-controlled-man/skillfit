# Manual npm releases from GitHub Actions

The `npm release` workflow is manual, runs only from `main` in
`remote-controlled-man/skillfit`, and defaults to a dry run. It uses the
`npm-release` GitHub environment and npm OIDC authentication. No model or agent
invocation is part of the workflow.

## Configuration

The environment must allow deployments only from the `main` branch. Configure
the npm trusted publisher with these exact values:

| Field | Value |
| --- | --- |
| Package | `skillfit` |
| Provider | GitHub Actions |
| Repository | `remote-controlled-man/skillfit` |
| Workflow filename | `npm-release.yml` |
| Environment | `npm-release` |
| Allowed action | Direct `npm publish` |

The existing npm CLI can preview this binding without writing it:

```bash
npm trust github skillfit --repo remote-controlled-man/skillfit --file npm-release.yml --env npm-release --allow-publish --dry-run
```

Create the actual binding with the same command without `--dry-run`, using
npm's required two-factor authentication, and verify with `npm trust list
skillfit`. Existing trusted publishers must be inspected before any change.

New bindings need their first successful publish within two days or they expire.
Create a binding when a reviewed new version is ready. Saving a binding or
running a dry run does not verify OIDC publication. See
[npm's trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/).

## Release procedure

1. Prepare and review a new stable version; keep both lockfile version fields
   aligned. An existing version, including 0.9.0, cannot be published again.
2. In Actions, open `npm release`, choose `main`, and run with `dry_run: true`.
   Tests, package inspection and the exact archive preview must pass. The
   archive and pack manifest are retained as workflow artifacts for 14 days.
3. Run with `dry_run: false` for the approved source. This rebuilds and verifies
   the archive, checks that the version is unused and publishes with OIDC.
4. Allow for npm's publication scan. The workflow requires matching version,
   latest and archive integrity, then verifies an isolated registry install,
   every packaged file and CLI version/help/request preview. A failed lookup,
   changed archive or unavailable installation never becomes a successful
   release receipt. Inspect the retained artifact and failure logs.

## Upload accepted but verification timed out

The upload and registry verification are separate workflow steps. A successful
upload does not establish availability: npm can still show the version as
`Validating`. The verification step retains its 20-minute deadline and fails
without a success receipt if the version is unavailable. See
[npm's publication scanning notice](https://github.blog/changelog/2026-07-28-npm-publish-time-malware-scanning-and-dual-use-metadata/).

Do not rerun publication after npm accepts the upload. Preserve the original
logs, `pack.json`, archive and `registry-read-*.json` files. Inspect the package's
Version History for its review status. A pending scan is not a staged release
that needs promotion, and a deadline failure does not authorize another upload.

For an independent, read-only recovery, download the original workflow artifact
into an isolated directory. Copy its `pack.json` and archive to a **new** attempt
directory; verification receipts use exclusive creation and must not overwrite
the failed attempt. Check out the original run's source commit, build with the
same toolchain and run the helper against that attempt's `pack.json`:

```bash
node scripts/npm-release.mjs verify /absolute/path/to/new-attempt/pack.json
```

The helper does not publish. It requires the original archive integrity, matching
version/latest, an isolated install and exact file comparisons. For a local
cross-platform check, use a disposable directory extracted from the original CI
archive as the comparison source, plus the original commit's package lock; this
checks installed bytes against the accepted archive without rebuilding its
generated files. Record this as independent verification, not a successful rerun
of the original workflow. Retain the first failure even if later verification
succeeds. Keep availability, provenance and installation evidence separate from
any Skill quality claim.

This workflow does not change the evaluation acceptance policy or upgrade a
Skill. Package publication success establishes package availability only.
