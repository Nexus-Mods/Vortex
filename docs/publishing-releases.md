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

**Publish order matters on multi-release days.** Vortex installs currently in
the field pick the newest release **by publish date** on the beta channel, not
by version. If a beta and a stable hotfix go out the same day, undraft the
release users should end up on last, or beta users get offered the older one.
This applies until the updater rework reaches most installs.

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
