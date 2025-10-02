# Yarn Commands Reference

This page documents the Yarn commands and scripts used in this repository, how they relate hierarchically, what each flag does, and guidance on when to use which command.

## Overview

- Core development flow is driven by Yarn scripts defined in `package.json`.
- Some commands are “one-shot” wrappers that chain multiple specialized steps.
- macOS-specific scripts and environment flags are included where relevant.

## One-Shot Workflows (Wrappers)

- `yarn dev:full`
  - Chain: `yarn clean --full` → `yarn build` → `yarn start:dev`
  - Use when: You want a fresh development environment and to start the app immediately.
  - Notes: Removes dev data and build outputs, rebuilds everything, then launches Electron.

- `yarn predist`
  - Chain: `build_api` → `_install_app` → `subprojects_app` → `_assets_app`
  - Use when: Preparing app assets and bundled extensions for packaging.
  - Notes: Non-interactive execution suitable for CI and reproducible builds.

- `yarn prepareci`
  - Chain: `build_api` → `_install_app` → `subprojects_ci` → `_assets_app`
  - Use when: CI preparation prior to packaging; runs extension builds with limited parallelism.

- `yarn dist`
  - Chain: `build_dist` → `package` → `extract_sourcemaps`
  - Use when: Building production distributables locally (no publish). Includes sourcemap extraction.

## Core Development Commands

- `yarn install`
  - Use when: Installing or updating dependencies.
  - Flags:
    - `--non-interactive`: Avoids prompts (CI-friendly).
    - `--check-files`: Re-checks `node_modules` integrity to match lockfile.
    - `--network-concurrency <n>`: Limits concurrent network requests (useful for flaky networks).
    - `--ignore-scripts`: Skips running `preinstall/postinstall` scripts (advanced troubleshooting).

- `yarn start` / `yarn start:dev`
  - Use when: Launching the application in development mode.
  - Notes: Sets `NODE_ENV=development` and runs Electron against local build output.

- `yarn build`
  - Chain: `check_packages` → `build_rest` → TypeScript compile (`tsc -p .`)
  - Use when: Building the app for development.
  - Notes: Prefers prebuilt native modules via env (`SKIP_NATIVE_BUILD`, `PREBUILD_INSTALL_ONLY`).

- `yarn buildwatch`
  - Use when: Incrementally rebuild core app sources while watching changes (extensions not watched).

- `yarn build_rest`
  - Chain: `_assets_out` → `compile_themes` → `build_api` → `subprojects`
  - Use when: Building assets and bundled extensions into `out/` for local dev.

- `yarn build_api`
  - Use when: Building the API package under `api/`.

## Extensions and Bundled Subprojects

- `yarn subprojects`
  - Use when: Building bundled extensions into `out/`.
  - Notes: Runs extension `install` and `build` steps, applying platform-specific environment.

- `yarn subprojects_app`
  - Use when: Building bundled extensions targeting the `app/` directory for packaging.

- `yarn subprojects_ci`
  - Use when: CI-safe extension builds (reduced parallelism via `--noparallel`).

- `yarn buildext`
  - Use when: Build a single extension via `tools/buildScripts/buildSingleExtension.js`.

## Cleaning and Validation

- `yarn clean`
  - Use when: Clearing build outputs and reinstalling dependencies.
  - Flags:
    - `--dev-data`: Also removes macOS dev data at `~/Library/Application Support/vortex_devel`.
    - `--full`: Removes `out/`, reinstalls dependencies, and clears app support data (macOS).
  - Notes: See `docs/clean-command.md` for details.

- `yarn validate-clean-install`
  - Use when: Sanity checks for a clean install state across platforms.

- `yarn complete-validation`
  - Use when: Comprehensive validation (install, environment, submodules).

- `yarn verify-setup`
  - Use when: Project setup verification (branch mapping, environment, dependencies).

## Assets and Packaging

- `_assets_out` / `_assets_app`
  - Use when: Compiling styles, images, and copying assets for dev or app packaging.

- `compile_themes` / `compile_themes_app`
  - Use when: Building Sass styles for dev (`out/`) or app (`app/assets`).

- `yarn build_dist`
  - Use when: Running Webpack to produce main and renderer bundles.

- `yarn package`
  - Use when: Packaging the Electron app via `electron-builder` (no publish).

## macOS-Specific Commands

- `yarn build:macos`
  - Use when: Convenience steps for macOS build flows.

- `yarn notarize:macos`
  - Use when: Notarizing macOS app builds.

- `yarn update-gitmodules-macos`
  - Use when: Updating `.gitmodules` to align with macOS branches/remotes.

- `yarn push:macos`
  - Use when: Pushing macOS-specific branches to remotes.

## Submodule Sweep Utilities

- `yarn sweep:all`
  - Use when: Sweep and push across multiple repos/submodules.

- `yarn sweep:all:dry`
  - Use when: Dry-run sweep to review changes without pushing.

## Flags Reference (Common)

- `--non-interactive`: Disable prompts. Use in CI or scripted runs.
- `--check-files`: Verify installed files match lockfile; fixes missing/corrupted modules.
- `--force`: Re-resolve and reinstall; use sparingly for dependency resolution issues.
- `--network-concurrency <n>`: Throttle concurrent network requests; helpful on poor networks.
- `--ignore-scripts`: Skip lifecycle scripts; use for isolating install issues or avoiding native builds.
- `--mutex file`: Yarn v1 file lock to avoid concurrency issues (disabled on macOS in our tooling).

## Which Command to Use When

- Fresh dev start: `yarn dev:full` when you want a clean slate and immediate app launch.
- Rebuild after code changes: `yarn build` for rebuilding core and extensions.
- Only rebuild extensions: `yarn subprojects` to recompile bundled plugins.
- Asset/style-only tweaks: `yarn compile_themes` (or `_assets_out` for a full assets refresh).
- Fix broken installs: `yarn clean --full` followed by `yarn install --check-files` or `yarn build`.
- CI preparation: `yarn prepareci` for deterministic builds; use `predist` for local pre-packaging.
- Produce distributables: `yarn dist` for production bundles and artifacts.
- Troubleshoot native builds: `yarn install --ignore-scripts` to bypass lifecycle scripts; then run targeted steps manually.

## Notes

- Environment variables like `SKIP_NATIVE_BUILD`, `PREBUILD_INSTALL_ONLY`, `MACOSX_DEPLOYMENT_TARGET`, and `NAPI_CPP_EXCEPTIONS` are set by scripts to improve cross-platform reliability.
- Extension builds apply platform-specific flags automatically via the subproject builder.