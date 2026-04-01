---
phase: 07-linux-packaging
plan: 02
subsystem: ci
tags: [github-actions, linux-packaging, appimage, deb, ci]

# Dependency graph
requires:
  - phase: 07-linux-packaging
    plan: 01
    provides: electron-builder configured for AppImage + deb
provides:
  - parallel build-linux CI job producing and publishing Linux artifacts
affects: [DIST-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Parallel sibling CI job (no needs:) running on ubuntu-latest alongside Windows build"
    - "Rust toolchain before apt deps before pnpm install (matches main.yml ordering)"

key-files:
  created: []
  modified:
    - .github/workflows/package.yml

key-decisions:
  - "build-linux is a parallel sibling job (no needs:) — runs concurrently with Windows build"
  - "pnpm run package:nosign reused for Linux — electron-builder ignores Windows signing config on Linux"
  - "Validation step checks AppImage, .deb, and latest-linux.yml existence before release upload"
  - "Publishes to both Nexus-Mods/Vortex and Nexus-Mods/Vortex-Staging using PERSONAL_ACCESS_TOKEN"

requirements-completed: [DIST-03]

# Metrics
duration: 5min
completed: 2026-04-01
---

# Phase 7 Plan 02: GitHub Actions Linux CI Job Summary

**Parallel build-linux job added to package.yml — produces AppImage, .deb, and latest-linux.yml alongside Windows artifacts**

## Performance

- **Duration:** ~5 min
- **Completed:** 2026-04-01
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- `.github/workflows/package.yml` gains a `build-linux` job running on `ubuntu-latest` in parallel with the Windows `build` job (no `needs:` dependency)
- Job includes: Rust toolchain → apt build deps (libfontconfig1-dev, cmake, liblz4-dev) → pnpm install → `package:nosign` → validation step
- Validation step fails CI if any of AppImage, `.deb`, or `latest-linux.yml` are missing from `./dist/`
- Two `softprops/action-gh-release` steps publish Linux artifacts to both Vortex and Vortex-Staging releases
- `upload-artifact` step for local artifact download when `create-artifacts` input is true
- Windows `build` job completely unchanged — 133 new lines added after line 216

## Task Commits

1. **Task 1: Add build-linux job to package.yml** - `e7a842841` (feat)

## Files Created/Modified

- `.github/workflows/package.yml` — parallel build-linux job added; Windows build job unchanged

## Decisions Made

- No `needs:` field — Linux job runs concurrently with Windows, not sequentially after it
- `pnpm run package:nosign` — electron-builder skips Windows code signing config automatically on Linux
- Version parsing replicated in bash (not PowerShell) since job runs on ubuntu-latest
- No dotnet, CodeSignTool, VC_redist, or VS2022 node-gyp steps — Windows-only concerns excluded

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Self-Check

- `grep "build-linux:" .github/workflows/package.yml` → present ✓
- `grep -c "runs-on:" .github/workflows/package.yml` → 2 (both jobs) ✓
- `grep "latest-linux.yml" .github/workflows/package.yml` → present (upload + release) ✓
- `grep "Vortex-Staging" .github/workflows/package.yml` → appears twice ✓

---
*Phase: 07-linux-packaging*
*Completed: 2026-04-01*
