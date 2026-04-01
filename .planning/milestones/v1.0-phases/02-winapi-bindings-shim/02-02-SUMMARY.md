---
phase: 02-winapi-bindings-shim
plan: 02
subsystem: infra
tags: [winapi-bindings, linux, webpack, rolldown, build-alias, electron]

# Dependency graph
requires:
  - phase: 02-01
    provides: "winapi-shim.ts with 48 exported functions at src/renderer/src/util/winapi-shim.ts"
provides:
  - "webpack resolve.alias: winapi-bindings -> winapi-shim.ts on Linux (no-op on Windows)"
  - "rolldown createConfig: optional 6th alias parameter spread into resolve block"
  - "src/main/build.mjs: platform-conditional linuxAlias passed to createConfig"
  - "All 18+ winapi-bindings import sites resolve to shim at bundle time — zero source edits"
  - "Electron window appears on Linux: no MODULE_NOT_FOUND crash from winapi-bindings"
affects: [03-native-addon-compilation, 04-fomod-installer, 05-ipc-elevation-audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Platform-conditional webpack alias: `...(process.platform === 'linux' && { alias: {...} })` spread in resolve block"
    - "Rolldown createConfig optional alias param: 6th arg `alias = undefined`, spread as `...(alias !== undefined && { resolve: { alias } })`"
    - "Build-time shim injection: shim resolved at bundle time, not at runtime require()"

key-files:
  created: []
  modified:
    - src/renderer/webpack.config.cjs
    - rolldown.base.mjs
    - src/main/build.mjs

key-decisions:
  - "Alias injected at bundle time (webpack/rolldown config) not at runtime — catches all 18+ import sites without touching source files"
  - "Windows build guard via `process.platform === 'linux'` at config evaluation time — alias is absent on Windows, not just inactive"
  - "Rolldown alias passed as optional 6th parameter to keep createConfig backwards-compatible with all existing callers"
  - "SHIM_PATH uses import.meta.dirname for ESM-safe resolution in build.mjs"

patterns-established:
  - "Linux build alias pattern: platform guard at config level wraps alias object in spread, evaluates to nothing on Windows"
  - "Rolldown extension pattern: add optional trailing params to createConfig with undefined default to avoid breaking callers"

requirements-completed: [WAPI-01]

# Metrics
duration: ~15min
completed: 2026-03-30
---

# Phase 2 Plan 2: winapi-bindings Build Aliases Summary

**webpack resolve.alias and rolldown createConfig alias parameter redirect `winapi-bindings` to `winapi-shim.ts` on Linux at bundle time — Electron window confirmed appearing without MODULE_NOT_FOUND crash**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-30T11:50:00Z
- **Completed:** 2026-03-30T12:10:00Z
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 3

## Accomplishments
- Added platform-conditional `resolve.alias` to webpack renderer config — `"winapi-bindings"` maps to `winapi-shim.ts` path when `process.platform === "linux"`, spread evaluates to nothing on Windows
- Extended `createConfig()` in `rolldown.base.mjs` with optional 6th `alias` parameter spread into `resolve:` block — zero impact on existing callers
- Added `SHIM_PATH` constant and `linuxAlias` platform guard in `src/main/build.mjs`, passed as 6th arg to `createConfig`
- Human verification confirmed: Electron window appears on Linux, application code reaches main process, zero `MODULE_NOT_FOUND` errors for `winapi-bindings`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add webpack resolve.alias for Linux and extend rolldown createConfig with alias parameter** - `c57aaaef4` (feat)
2. **Task 2: Verify Electron window appears on Linux** - human-verify checkpoint (approved by user)

## Files Created/Modified
- `src/renderer/webpack.config.cjs` - Added Linux-conditional `resolve.alias` for `winapi-bindings` in the webpack resolve block
- `rolldown.base.mjs` - Extended `createConfig()` with optional 6th `alias` parameter; spread into `defineConfig` resolve block
- `src/main/build.mjs` - Added `SHIM_PATH` pointing to `winapi-shim.ts`, `linuxAlias` platform guard, and `linuxAlias` as 6th arg to `createConfig`

## Decisions Made
- Build-time alias (webpack/rolldown config level) rather than runtime shim injection: catches all 18+ import sites in a single config change, no source file edits required
- Windows guard uses `process.platform === "linux"` at config evaluation time so the alias key is entirely absent from Windows bundles — not just set to `undefined`
- `SHIM_PATH` computed with `import.meta.dirname` (ESM-safe) rather than `__dirname` since `build.mjs` is an ES module
- 6th optional param in `createConfig` (not a new overload or config object) to remain backwards-compatible with all existing callers that pass 5 or fewer args

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None — build succeeded and human verification confirmed the app boots on Linux without winapi-related crashes.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Phase 2 (winapi-bindings Shim) is **complete**: shim created (02-01), build aliases wired (02-02), app verified booting on Linux
- Phase 3 (Native Addon Compilation) can proceed: the critical MODULE_NOT_FOUND blocker is resolved
- Phase 5 (IPC and Elevation Audit) can proceed: depends on Phase 2 and is now unblocked
- Phase 4 (FOMOD Installer Integration) still waits on Phase 3

---
*Phase: 02-winapi-bindings-shim*
*Completed: 2026-03-30*
