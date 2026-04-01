---
phase: 03-native-addon-compilation
plan: 02
subsystem: infra
tags: [electron-rebuild, native-addons, bsatk, esptk, bsdiff-node, vortexmt, xxhash-addon, loot, ci, node-gyp]

# Dependency graph
requires:
  - phase: 03-native-addon-compilation
    provides: postinstall-libloot.cjs and libloot.so build for loot addon (plan 03-01)
provides:
  - "@electron/rebuild 4.0.3 in devDependencies (pnpm catalog + package.json)"
  - "scripts/verify-addons.cjs smoke test for all 6 native addons"
  - "CI steps: Rebuild native addons for Electron (Linux) + Verify native addons load (Linux)"
  - "NADD-06 audit result documented: vortexmt clean, gamebryo-savegame disabled"
affects:
  - 03-native-addon-compilation
  - 04-fomod-linux-binary

# Tech tracking
tech-stack:
  added:
    - "@electron/rebuild 4.0.3 — recompile native addons against Electron 39.8.0 headers"
  patterns:
    - "CI Linux-only steps use if: runner.os == 'Linux' guard (Windows CI unaffected)"
    - "Native addon smoke tests run after rebuild via scripts/verify-addons.cjs"
    - "xxhash-addon loads from NAPI prebuilds without rebuild (node-gyp-build)"

key-files:
  created:
    - scripts/verify-addons.cjs
  modified:
    - pnpm-workspace.yaml
    - package.json
    - .github/workflows/main.yml

key-decisions:
  - "gamebryo-savegame disabled on Linux: two compile errors (MSVC-only exception constructor + missing lz4/zlib linker flags); deferred to future phase"
  - "NADD-06 clear error satisfied by ExtensionManager: gamebryo-savegame-management is a lazy-loaded extension, its load failure is non-fatal"
  - "vortexmt confirmed clean: proper #ifdef WIN32 guards, portable C++ — added to CI rebuild"
  - "xxhash-addon needs no rebuild: NAPI prebuilds for linux-x64 (glibc+musl) loaded by node-gyp-build"

patterns-established:
  - "verify-addons.cjs: smoke test pattern for CI native addon verification"
  - "Audit comments in scripts document WHY disabled, not just that it is"

requirements-completed: [NADD-01, NADD-02, NADD-04, NADD-05, NADD-06]

# Metrics
duration: 4min
completed: 2026-03-30
---

# Phase 03 Plan 02: Native Addon CI Rebuild Summary

**@electron/rebuild 4.0.3 added to CI with verify-addons.cjs smoke test covering 6 addons; vortexmt clean for Linux, gamebryo-savegame disabled with documented NADD-06 audit**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-30T20:06:14Z
- **Completed:** 2026-03-30T20:10:36Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments

- Added `@electron/rebuild 4.0.3` to pnpm catalog, `allowBuilds`, and root `package.json` devDependencies
- Created `scripts/verify-addons.cjs`: smoke tests bsatk, esptk, bsdiff-node, xxhash-addon, vortexmt, loot — exits non-zero on any failure
- Added two Linux-only CI steps: `Rebuild native addons for Electron` (npx @electron/rebuild -f -v 39.8.0) and `Verify native addons load` (node scripts/verify-addons.cjs), both after `pnpm install` and before `Build`
- NADD-06 audit documented: vortexmt is clean (proper WIN32 guards, compiled locally), gamebryo-savegame disabled (two compile errors; ExtensionManager provides the clear error on Linux)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add @electron/rebuild, create verify-addons script, add CI steps** - `2565e5a40` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified

- `scripts/verify-addons.cjs` — Smoke test script requiring all 6 native addons; exits non-zero on failure; NADD-06 audit results documented
- `pnpm-workspace.yaml` — Added `@electron/rebuild: 4.0.3` to catalog and `allowBuilds`
- `package.json` — Added `"@electron/rebuild": "catalog:"` to devDependencies (applied by parallel plan 03-01)
- `.github/workflows/main.yml` — Added `Rebuild native addons for Electron` and `Verify native addons load` CI steps (both Linux-only)

## Decisions Made

- **gamebryo-savegame disabled on Linux**: Two compile errors confirmed — (1) MSVC-only `std::exception(std::runtime_error(msg))` constructor in `MoreInfoException`, (2) `binding.gyp` links lz4/zlib only on `OS=="win"` but `.cpp` includes unconditionally. Save game preview is not Phase 1 core functionality; fix deferred via `patch-package`.
- **NADD-06 clear error requirement satisfied without platform guard**: `gamebryo-savegame` is only imported in `extensions/gamebryo-savegame-management/src/util/refreshSavegames.ts` — a bundled extension loaded lazily by ExtensionManager. When `require("gamebryo-savegame")` fails on Linux, ExtensionManager catches the error and reports it as a non-fatal warning.
- **xxhash-addon verified as prebuild-only**: Ships NAPI prebuilds for `linux-x64` (glibc + musl); loaded by `node-gyp-build` without rebuild; included in verify-addons.cjs for smoke-test completeness.

## Deviations from Plan

None — plan executed exactly as written.

Note: `package.json` and `.github/workflows/main.yml` were also modified by parallel agent 03-01, which ran concurrently. My `@electron/rebuild` devDep was applied to `package.json` (confirmed in HEAD). The CI workflow already had the correct prior edits from 03-01; my two new steps were added correctly after `pnpm install` and before `Build`.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 5 standard native addons (bsatk, esptk, bsdiff-node, vortexmt, xxhash-addon) ready for Electron rebuild in CI
- `loot` addon depends on plan 03-01 delivering `libloot.so` first, then `@electron/rebuild` will compile it
- `gamebryo-savegame` disabled on Linux — save game preview will not be available in Phase 1; can be fixed in a later phase via `patch-package`
- CI gate is set: any addon load failure blocks the Linux build matrix leg

---
*Phase: 03-native-addon-compilation*
*Completed: 2026-03-30*
