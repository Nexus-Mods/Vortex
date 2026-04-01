---
phase: 04-fomod-installer-integration
plan: 01
subsystem: infra
tags: [electron-builder, asar, fomod, dotnet, ipc, linux]

# Dependency graph
requires:
  - phase: 03-native-addon-compilation
    provides: Native addon compilation and packaging patterns established
provides:
  - asarUnpack entries for Linux FOMOD binaries (ModInstaller.Native.so, ModInstallerIPC ELF, dotnetprobe)
  - Platform-conditional executable name resolution in VortexIPCConnection (strips .exe on Linux)
affects: [04-02-fomod-installer-integration, fomod-installer, packaging]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Process platform conditional exe resolution: process.platform === 'linux' ? name.replace(.exe) : name"
    - "asarUnpack explicit paths for platform-specific binaries (no broad globs)"

key-files:
  created: []
  modified:
    - src/main/electron-builder.config.json
    - src/renderer/src/extensions/installer_fomod_ipc/utils/VortexIPCConnection.ts

key-decisions:
  - "Explicit asarUnpack paths used for Linux binaries (not broad globs) — per D-01 decision"
  - "platformExeName variable introduced to keep Windows behavior identical while stripping .exe on Linux"
  - "FOMD-03 dotnetprobe Linux branch already correct in installer_dotnet/index.ts — no changes needed"

patterns-established:
  - "Platform-conditional exe name: resolve platformExeName before all path operations"

requirements-completed: [FOMD-01, FOMD-02, FOMD-03, FOMD-04]

# Metrics
duration: 8min
completed: 2026-03-31
---

# Phase 4 Plan 01: FOMOD Installer Integration — asarUnpack and IPC Executable Resolution Summary

**Three Linux FOMOD binary asarUnpack entries added and VortexIPCConnection strips .exe on Linux for ModInstallerIPC ELF resolution**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-30T22:54:43Z
- **Completed:** 2026-03-31T09:57:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `ModInstaller.Native.so`, `ModInstallerIPC` (ELF), and `dotnetprobe` to electron-builder asarUnpack — these binaries were previously trapped inside the asar archive on Linux (only `*.dll` and `*.exe` globs existed)
- Fixed `VortexIPCConnection.getExecutablePaths()` to strip `.exe` suffix on Linux so the IPC layer resolves `ModInstallerIPC` (the .NET 9 self-contained ELF) instead of the non-existent `ModInstallerIPC.exe`
- Verified that `installer_dotnet/index.ts` already has correct Linux branch in `checkNetInstall()` — resolves `dotnetprobe` without `.exe` at line 223 — FOMD-03 satisfied with no changes needed

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Linux FOMOD binary patterns to asarUnpack** - `a3fb60abf` (chore)
2. **Task 2: Fix VortexIPCConnection.getExecutablePaths for Linux** - `10147812e` (fix)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `src/main/electron-builder.config.json` - Added 3 Linux-specific asarUnpack entries after `assets/*.exe`
- `src/renderer/src/extensions/installer_fomod_ipc/utils/VortexIPCConnection.ts` - Added `platformExeName` with `.exe` strip on Linux in `getExecutablePaths()`

## Decisions Made
- Used explicit paths (not broad globs) for Linux asarUnpack entries per D-01 constraint
- Introduced `platformExeName` as a local const so `exeName` parameter stays unchanged — both `super.getExecutablePaths()` and `path.join()` receive the same resolved name
- No changes needed for FOMD-03 — the `checkNetInstall()` Linux branch at line 220 already resolves `dotnetprobe` (no `.exe`) via `getVortexPath("assets_unpacked")`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The `pnpm run build` failure in the worktree is a pre-existing infrastructure issue (worktree `node_modules` not installed) unrelated to these changes. JSON validity and TypeScript syntax were verified via targeted checks.

## FOMD-03 Verification (no code changes)

`installer_dotnet/index.ts` `checkNetInstall()` (line 209):
- Line 215: `if (process.platform === "win32")` → resolves `dotnetprobe.exe`
- Line 220: `else if (process.platform === "linux")` → resolves `dotnetprobe` (no .exe)
- `automaticFix` is not set on the Linux branch (line 253 sets it conditionally for linux .NET install prompts, but the `testResult` check at line 282 only triggers `automaticFix` for Windows scenarios)
- FOMD-03 requirement satisfied: dotnetprobe ELF is now unpacked from asar (new asarUnpack entry) and the code path resolves it correctly

## Next Phase Readiness
- asarUnpack configuration complete — Linux FOMOD binaries will be accessible at runtime
- IPC executable resolution fixed — ModInstallerIPC ELF will be found on Linux
- Ready for 04-02: runtime integration testing and end-to-end FOMOD install verification

---
*Phase: 04-fomod-installer-integration*
*Completed: 2026-03-31*

## Self-Check: PASSED

- FOUND: src/main/electron-builder.config.json
- FOUND: src/renderer/src/extensions/installer_fomod_ipc/utils/VortexIPCConnection.ts
- FOUND: 04-01-SUMMARY.md
- FOUND: commit a3fb60abf
- FOUND: commit 10147812e
