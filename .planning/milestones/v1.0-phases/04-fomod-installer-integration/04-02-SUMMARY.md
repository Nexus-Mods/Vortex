---
phase: 04-fomod-installer-integration
plan: 02
subsystem: integration
tags: [fomod, tcp, ipc, linux, validation, bug-fix]

# Dependency graph
requires:
  - phase: 04-01
    provides: asarUnpack entries and VortexIPCConnection exe fix
provides:
  - End-to-end validation that FOMOD TCP transport works on Linux
  - Fix for mKnownGameStores undefined entry crashing manual game path selection
affects: [fomod-installer, game-discovery, linux]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Filter undefined entries from game store arrays at construction time"

key-files:
  created: []
  modified:
    - src/renderer/src/extensions/gamemode_management/GameModeManager.ts

key-decisions:
  - "EpicGamesLauncher exports undefined on Linux (Windows-only store) — filtered at GameModeManager constructor"
  - "FOMOD TCP transport confirmed working end-to-end on Linux via minimal test archive"
  - "ModInstallerIPC ELF binary resolved correctly via VortexIPCConnection.getExecutablePaths"

patterns-established:
  - "Game store arrays must filter undefined/null before use — platform-conditional stores export undefined"

requirements-completed: [FOMD-04]

# Metrics
duration: 90min
completed: 2026-03-31
---

# Phase 4 Plan 02: FOMOD TCP Transport Validation Summary

**FOMD-04 verified: FOMOD installer dialog appears on Linux, TCP transport handshake succeeded**

## Performance

- **Duration:** ~90 min (includes debugging)
- **Completed:** 2026-03-31
- **Tasks:** 2

## Accomplishments

### Task 1: Binary presence verified
- `ModInstallerIPC` ELF confirmed at `src/renderer/node_modules/@nexusmods/fomod-installer-ipc/dist/ModInstallerIPC` — ELF 64-bit
- `ModInstaller.Native.so` confirmed at `src/renderer/node_modules/@nexusmods/fomod-installer-native/prebuilds/linux-x64/` — ELF 64-bit
- `assets/dotnetprobe` confirmed — ELF 64-bit, executable
- `ModInstallerIPC` was missing execute bit — fixed with `chmod +x`

### Task 2: End-to-end validation
- FOMOD installer dialog appeared and rendered correctly on Linux
- User selected options and completed install — TCP transport confirmed working
- Test archive: minimal `fomod/ModuleConfig.xml` with two plugin options

### Bug found and fixed during validation
**Root cause:** `EpicGamesLauncher` exports `undefined` on Linux (intentional — it's a Windows-only store). `GameModeManager` spreads it directly: `[Steam, EpicGamesLauncher, ...gameStoreExtensions]`, putting `undefined` in the array. When `manualGameStoreSelection` called `gameStores.map((store) => ({ id: store.id, ... }))`, it crashed with `TypeError: Cannot read properties of undefined (reading 'id')`, which was caught and shown as "Game not found".

**Fix:** Filter the array at construction: `.filter((s): s is IGameStore => s != null)`

**Commit:** `390579ab7` — fix(linux): filter undefined game stores from mKnownGameStores

## Files Modified
- `src/renderer/src/extensions/gamemode_management/GameModeManager.ts` — filter null/undefined game stores

## Self-Check: PASSED

- FOMOD dialog appeared on Linux ✓
- TCP transport handshake succeeded ✓
- TestSupported responded ✓
- Install completed ✓
