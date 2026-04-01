---
phase: 06-steam-proton-detection
plan: "01"
subsystem: steam
tags: [steam, proton, linux, flatpak, vdf, game-detection]

# Dependency graph
requires:
  - phase: 05-ipc-and-elevation-audit
    provides: IPC utility and platform guard pattern established
provides:
  - findAllLinuxSteamPaths() returning all valid Steam roots (native + Flatpak + Snap)
  - Multi-root Steam scanning with appid deduplication in Steam.ts
  - oslist-aware getProtonInfo() detecting never-launched Windows-only games as Proton
affects: [06-02, 06-03, STAM-01, STAM-02, STAM-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Multi-root Steam scan: findAllLinuxSteamPaths() + Set<string> dedup by appid"
    - "oslist fallback: oslist present => use field; absent => check compatdata dir"

key-files:
  created: []
  modified:
    - src/renderer/src/util/linux/steamPaths.ts
    - src/renderer/src/util/linux/proton.ts
    - src/renderer/src/util/Steam.ts

key-decisions:
  - "findLinuxSteamPath() kept intact for backward compat; findAllLinuxSteamPaths() is additive"
  - "oslist as primary Proton signal when available — enables never-launched game detection without compatdata"
  - "Appid dedup uses Set<string> first-occurrence-wins after games reduce, before tap()"

patterns-established:
  - "oslist field from ACF manifest AppState is the authoritative Proton signal; compatdata fallback for older games"
  - "Multi-root scanning: collect all valid roots then deduplicate games by appid"

requirements-completed: [STAM-01, STAM-02, STAM-03]

# Metrics
duration: 3min
completed: 2026-03-31
---

# Phase 06 Plan 01: Steam Multi-Root Detection and oslist Proton Detection Summary

**Multi-root Steam scanning (native + Flatpak) with oslist-based Proton detection for never-launched Windows-only games**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-31T22:01:31Z
- **Completed:** 2026-03-31T22:04:30Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `findAllLinuxSteamPaths()` to steamPaths.ts — returns every valid Steam root by filtering all candidate paths through `isValidSteamPath()`
- Wired multi-root scanning into `Steam.ts resolveSteamPaths()` — on Linux uses all valid roots instead of just the first one found; added early return guard for empty roots
- Added appid deduplication (`Set<string>`) after games reduce — Flatpak + native installs sharing the same library folders no longer yield duplicate game entries
- Extended `getProtonInfo()` with optional `oslist` parameter — Windows-only games (oslist doesn't contain "linux") detected as `usesProton=true` even without a `compatdata/` directory; native Linux games correctly excluded
- Threaded `entry.manifestData?.["AppState"]?.["oslist"]` from ACF manifests into `getProtonInfo()` call in `Steam.ts`

## Task Commits

Each task was committed atomically:

1. **Task 1: findAllLinuxSteamPaths() and multi-root Steam scanning** - `3e2c31458` (feat)
2. **Task 2: oslist-aware Proton detection** - `0f1daeb56` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `src/renderer/src/util/linux/steamPaths.ts` — Added `findAllLinuxSteamPaths()` export
- `src/renderer/src/util/linux/proton.ts` — Extended `getProtonInfo()` with `oslist?: string` parameter and oslist-based needsProton logic
- `src/renderer/src/util/Steam.ts` — Updated import, `resolveSteamPaths()` multi-root logic, appid dedup Set

## Decisions Made

- `findLinuxSteamPath()` kept unchanged for backward compatibility — `findAllLinuxSteamPaths()` is purely additive
- `oslist` used as primary signal when present; falls back to `compatdata` directory check when absent — this handles both pre-existing installations (with `compatdata`) and never-launched games (with only `oslist` metadata)
- Appid dedup positioned after the flat `reduce()` call, before `.tap()` — clean separation from flattening logic

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- STAM-01, STAM-02, STAM-03 satisfied: VDF parsing works, Flatpak paths resolved, Proton prefixes detected per-game
- Ready for Phase 06-02 (`{mygames}` Wine prefix variable resolution) and 06-03 (game extension audit)
- No blockers

---
*Phase: 06-steam-proton-detection*
*Completed: 2026-03-31*

## Self-Check: PASSED

- FOUND: src/renderer/src/util/linux/steamPaths.ts
- FOUND: src/renderer/src/util/linux/proton.ts
- FOUND: src/renderer/src/util/Steam.ts
- FOUND: .planning/phases/06-steam-proton-detection/06-01-SUMMARY.md
- FOUND commit: 3e2c31458 (Task 1)
- FOUND commit: 0f1daeb56 (Task 2)
