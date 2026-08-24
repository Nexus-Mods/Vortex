# Packaging Guide

Read this before building Windows installers or touching the release pipeline.

## The one command

```bash
pnpm package:nosign
```

Run it from the **repo root**. It runs the full production build and writes an
unsigned installer to the repo-root `dist/` (`vortex-setup-<version>.exe`,
its `.exe.blockmap`, `latest.yml`, `win-unpacked/`). Takes several minutes.

- **Never run the `package`/`package:nosign` scripts inside `src/main`
  directly**: they fail standalone ("cannot find the path"); only the root
  pipeline creates the `src/main/dist` deploy directory they need.
- Signed builds (`pnpm package`) are CI-only; the signing secrets don't exist
  locally.

## Versioning

`src/main/package.json` holds the placeholder `1.0.0`. Inject a version
before packaging, restore after:

```bash
pnpm -F "@vortex/main" version 9.0.1 --no-git-tag-version --no-git-checks --allow-same-version
pnpm package:nosign
git restore src/main/package.json
```

## After building

Run `node scripts/verify-packaged-asar.mjs`. It fails if nested
`node_modules` dependency versions were mangled during packaging (this has
shipped a broken build before; electron-builder is pinned to 24.13.3 because
of it).

## Testing the auto-updater with local builds

Local installers + the mock feed (`scripts/mock-update-feed.mjs`) exercise
the whole update cycle offline. The env vars (`VORTEX_UPDATER_API_BASE`,
`VORTEX_UPDATER_DOWNLOAD_BASE`, `VORTEX_DEV_UPDATER`), asset staging, and the
unsigned-build `publisherName` caveat are covered in
`docs/updater-testing.md`. The signed end-to-end run against a scratch
GitHub repo (`scripts/updater-e2e-staging.mjs`) is in
`docs/updater-rehearsal.md`.

## More detail

- `docs/packaging/windows.md`: the pipeline explained, CI behavior
- `docs/publishing-releases.md`: how releases go live
