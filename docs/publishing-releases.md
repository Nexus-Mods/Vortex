# Publishing Releases to Nexus Mods

For release managers: this describes what happens automatically when a stable
Vortex release goes out, and what still has to be done by hand.

## The Release Flow

1. **Package** (`package.yml`) builds and signs the installer, creates a
   **draft release** on GitHub and on `Vortex-Staging`, and **uploads the
   installer to R2**. The file is staged in R2 from this point on, but it is
   not yet the live download. Each of those is a separate dispatch input
   (`release`, `staging-release`, `upload-to-r2`), all on by default.
   The pre-release flag is set from the version: a suffix like `-beta.1`
   marks the release as a pre-release, a bare version like `2.5.0` marks it
   stable. Don't change the flag by hand.

2. **Undraft the release** on GitHub. This is the go-live action: for a
   stable release, undrafting immediately fires the `released` event - which
   triggers the Nexus Mods upload - and makes the release visible to the
   auto-updater's stable channel. There is no second step.

After the undraft, two **independent** things make the release public. Neither
depends on the other:

- **The R2 download**. The installer is already in
  R2 from step 1; it goes live when the **download tag in the website repo** is
  pointed at the new version.

**Stable releases only.** Betas and alphas are distributed via GitHub Releases
and the Vortex auto-update channel; they are never uploaded to Nexus Mods.
Undrafting a pre-release fires `prereleased`, not `released`, so beta releases
never reach the Upload API.

<<<<<<< HEAD
**Publish order matters on multi-release days.** Vortex installs currently in
the field pick the newest release **by publish date** on the beta channel, not
by version. If a beta and a stable hotfix go out the same day, undraft the
release users should end up on last, or beta users get offered the older one.
This applies until the updater rework reaches most installs.

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

=======
>>>>>>> 192d91778 (Merge pull request #24044 from Nexus-Mods/removed-nm-release)
## What Gets Uploaded

Only the installer `.exe` (e.g. `vortex-setup-2.4.0.exe`). The `latest.yml`
metadata file serves the Vortex auto-updater and stays on GitHub Releases.
(It is the only metadata file the build produces - there are no per-channel
`alpha.yml`/`beta.yml` files; every release, beta or stable, carries a
`latest.yml`.)

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

- **"Release X is a draft"**: undraft the release first.
- **"Release X is marked as a prerelease"**: betas are never published to Nexus
  Mods. Check the tag.
- **"No .exe installer asset found"**: check that the Package workflow
  completed and attached the installer.
- **Installer missing from R2**: re-run **Upload Release to R2** manually with
  the release tag; it is kept as a fallback for exactly this.
