# Scripts Overview

This document describes the scripts under `scripts/`, where they are invoked, and why they exist. It also highlights related configuration files and environment variables used during install and build.

## Install Hooks (automatic)

- `scripts/install-p7zip-macos.js`
  - Where: chained in `package.json` `preinstall`
  - Why: Ensures `p7zip` is available on macOS (installs via Homebrew if missing) so `node-7z` can function during builds.

- `scripts/preinstall-macos.js`
  - Where: `package.json` `preinstall`
  - Why: On macOS, removes `drivelist` entries from `package.json` files before install to prevent native build failures. Creates backups that are restored later.

- `scripts/configure-native-modules.js`
  - Where: `package.json` `postinstall` chain
  - Why: Sets environment variables (`SKIP_NATIVE_BUILD`, `PREBUILD_INSTALL_ONLY`, and module-specific flags) to prefer prebuilt binaries and skip native compilation where mocks or macOS implementations are used.

- `scripts/patch-native-modules.js`
  - Where: `package.json` `postinstall` chain
  - Why: Patches `node-addon-api` to enable C++ exceptions and configures native module builds. On macOS, installs real implementations for certain modules (e.g., `drivelist`, `permissions`, `turbowalk`, `bsdiff-node`, `ffi`, `ref*`, `node-7z`) directly into `node_modules` and `app/node_modules`. Also writes `node-addon-api.gypi` and sets additional environment variables to prevent unwanted native builds.

- `scripts/fix-7z-bin-macos.js`
  - Where: `package.json` `postinstall` chain
  - Why: On macOS, ensures a working `7z` executable by creating a `darwin` folder and symlink in `node_modules/7z-bin` (uses system `7z` or the Homebrew-installed one).

- `postinstall.js` (repo root)
  - Where: `package.json` `postinstall` chain
  - Why: Verifies presence of key native modules, attempts install if missing, restores `package.json` backups created by `preinstall-macos.js`, and removes `drivelist` from macOS environments where a mock/real implementation is used.

- `scripts/setup-submodule-forks.sh`
  - Where: `package.json` `postinstall` chain (`bash scripts/setup-submodule-forks.sh || true`)
  - Why: Points submodules to user forks and handles `.DS_Store` ignores. Internally calls:
    - `scripts/point_submodules_to_user_forks_and_ignore_dsstore.sh`
    - `scripts/_submodule_point_fork.sh`

## Validation and Verification (manual via Yarn scripts)

- `scripts/validate-clean-install.js`
  - Where: `yarn validate-clean-install`
  - Why: Sanity checks for a clean install state across platforms.

- `scripts/submodule-branch-check.js`
  - Where: `yarn check-submodules`
  - Why: Verifies submodule branches are correctly configured.

- `scripts/complete-validation.js`
  - Where: `yarn complete-validation`
  - Why: Runs a more comprehensive validation suite (install, env, submodules).

- `scripts/project-setup-verification.js`
  - Where: `yarn verify-setup`; referenced by tests and docs
  - Why: Performs project setup checks. Uses `scripts/macos-branch-mapping.json` to validate branch mapping for macOS.

- `scripts/clean-dev-data.js`
  - Where: `yarn clean`
  - Why: Cleans development data and temporary artifacts.

## Build and Release Utilities

- `scripts/build-macos.js`
  - Where: `yarn build:macos`
  - Why: Convenience for macOS build flow (local packaging or prep steps). Not required for standard development builds.

- `scripts/notarize-macos.js`
  - Where: `yarn notarize:macos`
  - Why: Handles macOS app notarization steps for releases.

## macOS Native Implementations (installed via postinstall)

These files are copied into `node_modules` and `app/node_modules` by `scripts/patch-native-modules.js` to provide real/macOS-specific implementations:

- `scripts/bsdiff-macos.js`
- `scripts/ffi-macos.js`
- `scripts/ref-macos.js`
- `scripts/ref-struct-macos.js`
- `scripts/ref-union-macos.js`
- `scripts/node-7z-macos.js`
- `scripts/permissions-macos.js`
- `scripts/turbowalk-macos.js`
- `scripts/vortexmt-macos.js`
- `scripts/wholocks-macos.js`

These are not invoked directly; they’re installed as module entry points by the patcher and loaded when those modules are required.

## Submodule Utilities

- `scripts/update-gitmodules-macos.sh`
  - Where: `yarn update-gitmodules-macos`
  - Why: Updates `.gitmodules` to align with macOS branches and expected remotes.

- `scripts/push_macos_branches.sh`
  - Where: `yarn push:macos`
  - Why: Pushes macOS-specific branches to remotes.

- `scripts/sweep_and_push_all.sh`
  - Where: `yarn sweep:all` and `yarn sweep:all:dry`
  - Why: Sweeps and pushes across multiple repos/submodules; dry-run option available.

- `scripts/prepare-collections-install.sh`
  - Where: `extensions/collections/package.json` `preinstall`
  - Why: Prepares the collections extension for installation.

## Legacy (archived)

The following helper scripts have been moved to `tools/legacy/` to reduce clutter and are ignored by Git:

- `add_dsstore_gitignore_and_push.sh`
- `config_ignore_extensions.sh`
- `preserve_submodule_remotes.sh`
- `stash_and_apply_submodules.sh`
- `submodule_summary.sh` and `submodule_summary.out`
- `test-verification.js`

## Key Environment Variables

- Global: `SKIP_NATIVE_BUILD=1`, `PREBUILD_INSTALL_ONLY=1`, `npm_config_build_from_source=false`
- Module-specific (examples): `npm_config_<module>_skip_build=true`, `npm_config_<module>_prebuild=false`, `npm_config_<module>_binary_host_mirror=none`
- macOS-specific skip flags: `SKIP_DRIVELIST_BUILD=1`, `DRIVELIST_SKIP_INSTALL=1`, etc.
- `node-addon-api` config: `NAPI_CPP_EXCEPTIONS`, C++ exceptions enabled, `MACOSX_DEPLOYMENT_TARGET=10.15`.

## Typical Flows

- Clean install (macOS):
  - `yarn cache clean && rm -rf node_modules app/node_modules`
  - `yarn install --non-interactive --check-files`
  - Hooks run automatically (`preinstall` and `postinstall`).

- Validate:
  - `yarn verify-setup`
  - `yarn validate-clean-install`

- Build:
  - `yarn build`
  - Optional macOS flow: `yarn build:macos`, `yarn notarize:macos`