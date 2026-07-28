# Publishing Releases to Nexus Mods

For release managers: this describes what happens automatically when a stable
Vortex release goes out, and what still has to be done by hand.

## The Release Flow

1. **Package** (`package.yml`) builds and signs the installer, creates a
   **draft pre-release** on GitHub and on `Vortex-Staging`, and **uploads the
   installer to R2**. The file is staged in R2 from this point on, but it is
   not yet the live download. Each of those is a separate dispatch input
   (`release`, `staging-release`, `upload-to-r2`), all on by default.

2. **Undraft the release** on GitHub. Clear the draft flag and clear the
   pre-release flag - only a non-pre-release fires the `released` event.

After the undraft, two **independent** things make the release public. Neither
depends on the other:

- **The R2 download**. The installer is already in
  R2 from step 1; it goes live when the **download tag in the website repo** is
  pointed at the new version.
- **The Nexus Mods mod page.** `publish-release.yml` runs automatically on the
  `released` event: it downloads the installer from the release, builds the
  changelog from `CHANGELOG.md`, and uploads both via the Upload API.

**Stable releases only.** Betas and alphas are distributed via GitHub Releases
and the Vortex auto-update channel; they are never uploaded to Nexus Mods.
Undrafting a pre-release fires `prereleased`, not `released`, so beta releases
never reach the Upload API.

## Running It Manually

**Actions → Publish Release to Nexus Mods → Run workflow.** Use this to
re-publish, to publish a release that predates the automation, or to upload to
the test mod page.

- **Release tag**: the tag to publish (e.g. `v2.4.0`). Required - there is no
  "latest release" fallback, so a mistyped tag fails rather than publishing
  something unintended.
- **Dry run?**: `true` (default) validates the release and prints the changelog
  without uploading. Set to `false` to actually upload.
- **File ID** / **Mod ID**: override the repository variables below to upload to
  the test mod page instead of the live one. **Pass both or neither** - they
  address the same mod page, and the workflow rejects a half-applied override
  that would put the file on one page and the changelog on another.

Prefer these inputs over temporarily editing the repository variables: the
automatic `released` path always reads the variables, so a forgotten revert
would misdirect the next real release. A per-run input cannot leak.

## Nexus Identifiers

The workflow needs two identifiers, both read from repository variables:

| Variable               | Meaning                                    |
| ---------------------- | ------------------------------------------ |
| `NEXUS_VORTEX_FILE_ID` | The Nexus file the new version is added to |
| `NEXUS_VORTEX_MOD_ID`  | The mod the changelog entry is attached to |

The file ID is on the mod page's Files tab under **API Info**, or in the edit
menu of **Manage Files**. The mod ID comes from
`GET https://api.nexusmods.com/v3/games/site/mods/1` - use the `id` field, not
the `1` from the URL. The workflow fails fast with a clear error if either
variable is unset.

## The Changelog

The Upload API takes plain text, so the workflow flattens `CHANGELOG.md` into
one bullet per line:

```text
Health check page: Bulk mod install (#23642)
Reworked the Recently Managed dashlet for portrait game tiles (#23680)
Restored the system tray icon (#23689)
```

A stable entry (`## [2.4.0]`) only points at the beta entries below it, so the
workflow collects the release's own entry **plus every pre-release entry below
it, stopping at the previous stable release**. For `2.4.0` that means `2.4.0`,
`2.4.0-beta.2`, and `2.4.0-beta.1`, but nothing from `2.3.0`. The collected
bullets are then regrouped into Keep-a-Changelog section order (Added,
Changed, Deprecated, Removed, Fixed, Security), newest entry first within each
section, with markdown links collapsed to `(#1234)` and code spans stripped.

Changelog uploads are **additive**: publishing the same version twice appends
the text again rather than replacing it.

## What Gets Uploaded

Only the installer `.exe` (e.g. `vortex-setup-2.4.0.exe`). The `.yml` metadata
files (`latest.yml`, `alpha.yml`, `beta.yml`) serve the Vortex auto-updater and
stay on GitHub Releases.

## Safety Guardrails

| Guardrail                      | Description                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------- |
| **Stable releases only**       | The `released` event does not fire for pre-releases.                         |
| **Draft/prerelease rejection** | The script re-checks the release and refuses drafts and pre-releases.        |
| **Changelog required**         | Publishing fails if `CHANGELOG.md` has no entry for the version.             |
| **Identifiers required**       | Publishing fails if the Nexus file/mod ID variables are unset.               |
| **Paired overrides**           | A file-id/mod-id override must set both, keeping them on one mod page.       |
| **Concurrency control**        | Only one publish run executes at a time (`publish-nexus` concurrency group). |
| **Dry-run default**            | Manual runs skip the upload unless `dry-run` is set to `false`.              |

## Troubleshooting

- **"No CHANGELOG.md entry found for version X"**: add a `## [X]` section to
  `CHANGELOG.md`. Note the workflow reads `CHANGELOG.md` **as of the release
  tag**, so the entry has to exist in the commit that was packaged.
- **"No Nexus file ID / mod ID"**: set the repository variables above.
- **"Release X is a draft"**: undraft the release first.
- **"Release X is marked as a prerelease"**: betas are never published to Nexus
  Mods. Check the tag.
- **"No .exe installer asset found"**: check that the Package workflow
  completed and attached the installer.
- **Dry-run looks correct but upload fails**: verify `NEXUS_API_KEY` is valid
  and check the upload-action error in the run logs.
- **Installer missing from R2**: re-run **Upload Release to R2** manually with
  the release tag; it is kept as a fallback for exactly this.

## The Action

The preparation step is a bundled JS action at
[`.github/actions/prepare-nexusmods-release/`](../.github/actions/prepare-nexusmods-release/).
It is an ordinary package in the Vortex pnpm workspace and uses the shared
toolchain - rolldown to bundle, `tsconfig.strict.json` for typechecking, the
shared oxlint and vitest configs - so the workflow itself needs no toolchain
setup or install step.

GitHub runs the committed `dist/index.js` directly and never builds it, so
**after editing `src/` you must rebuild and commit the bundle**:

```bash
pnpm nx run-many -t typecheck test lint build \
  --projects @vortex/prepare-nexusmods-release-action
```

`pnpm run build` at the repo root rebuilds it too, along with every other
package. A stale bundle therefore shows up as an uncommitted `dist/index.js`
after a build.

To dry-run the preparation locally, set the inputs as `INPUT_*` environment
variables (how `@actions/core` reads them) and run the built bundle. Note the
hyphenated names need `env` rather than a `VAR=value` prefix. It needs `gh` CLI
repo auth:

```bash
cd .github/actions/prepare-nexusmods-release
env "INPUT_TAG=v2.4.0" \
    "INPUT_DRY-RUN=true" \
    "INPUT_CHANGELOG-PATH=../../../CHANGELOG.md" \
    "INPUT_DOWNLOAD-DIR=./release-assets" \
  node dist/index.js
```

`INPUT_TAG` is required.

## Advanced: Archive Behaviour

`archive_existing_version` is `false`, so the workflow **replaces the previous
file on the mod page** instead of archiving it. To archive the old file,
contact the Nexus Mods team before running the workflow.
