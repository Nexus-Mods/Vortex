# Windows Packaging

Use this page when you need a Windows installer for local testing or you need
to understand how release builds are produced.

## Local Unsigned Packages

From the **repo root**:

```bash
pnpm package:nosign
```

This runs the full production build and produces an unsigned installer in the
repo-root `dist/`. Expect it to take several minutes.

The version baked into the installer comes from `src/main/package.json`,
which holds the placeholder `1.0.0`. To package a specific version, inject it
first and restore afterwards:

```bash
pnpm -F "@vortex/main" version 2.7.0 --no-git-tag-version --no-git-checks --allow-same-version
pnpm package:nosign
git restore src/main/package.json
```

**Trap:** the `package`/`package:nosign` scripts inside `src/main` fail when
run standalone ("The system cannot find the path specified"); they expect
the deploy directory that only the root pipeline creates. Always use the root
script.

## What the pipeline does

1. The root script sets `NODE_ENV=production` and runs the full build.
2. Nx runs `@vortex/main:package:nosign`, which depends on `publish`: it
   wipes `src/main/dist`, runs `pnpm deploy` to materialize a standalone
   package there, and `prepare-dist-package.mjs` resolves the `catalog:` and
   `workspace:` dependency specifiers.
3. electron-builder runs from that deploy directory
   (`src/main/electron-builder.config.json`) and writes its output to the
   repo-root `dist/` (`directories.output: ../../../dist`).
4. `scripts/verify-packaged-asar.mjs` should be run afterwards:

    ```bash
    node scripts/verify-packaged-asar.mjs
    ```

    It compares every nested `node_modules` dependency version in the deploy
    tree against what actually landed in the asar, and fails on mismatches. This guard
    exists because electron-builder 26's pnpm module collector shipped a build
    with ~50 wrong nested dependency versions (we are pinned to 24.13.3 until
    that is fixed upstream).

## Output

- `vortex-setup-<version>.exe`: the NSIS installer (assisted, per-machine)
- `vortex-setup-<version>.exe.blockmap`: enables differential auto-updates;
  published alongside the installer on GitHub releases
- `latest.yml`: the auto-updater manifest (version, sha512, file name)
- `win-unpacked/`: the unpacked app, useful for quick inspection

## Signed Release Builds

Signed builds are created by CI only (`.github/actions/package/action.yml`,
driven by [package.yml]); the signing secrets are not available locally. The
CI action additionally:

- sanitizes the requested version and falls back to
  `<package version>-nightly.<date>` when none is given,
- bumps both `@vortex/main` and `@nexusmods/vortex-api`,
- reuses a cached `electron-rebuild` (`VORTEX_ELECTRON_REBUILD=skip`),
- signs when secrets are available and falls back to nosign otherwise,
- validates the produced artifacts, including the asar dependency check
  described above.

Do not run `pnpm package` (the signing variant) locally.

## Testing the auto-updater with local packages

A pair of local unsigned installers plus the mock update feed exercise the
entire update cycle offline; see [updater-testing.md] for the full
workbench (mock feed, env vars, the `publisherName` caveat for unsigned
builds, blockmap staging).

For the signed end-to-end run against real GitHub, which covers what the mock
feed can't (real API shapes, CDN redirects, prerelease and draft semantics,
Authenticode), see [updater-rehearsal.md] and
`scripts/updater-e2e-staging.mjs`.

## References

- [updater-testing.md]
- [updater-rehearsal.md]
- [electron-builder documentation]
- [electron-builder NSIS configuration]
- [Package workflow]

[Package workflow]: ../../.github/workflows/package.yml
[electron-builder documentation]: https://www.electron.build/
[electron-builder NSIS configuration]: https://www.electron.build/configuration/nsis
[package.yml]: ../../.github/workflows/package.yml
[updater-rehearsal.md]: ../updater-rehearsal.md
[updater-testing.md]: ../updater-testing.md
