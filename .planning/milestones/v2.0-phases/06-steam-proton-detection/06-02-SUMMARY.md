---
phase: 06-steam-proton-detection
plan: "02"
subsystem: linux
tags: [proton, wine, steam, ini, bethesda, path-resolution]

# Dependency graph
requires:
  - phase: 06-steam-proton-detection/06-01
    provides: getCompatDataPath, IProtonInfo, ISteamEntry.compatDataPath, ISteamEntry.usesProton
provides:
  - PROTON_USERNAME constant exported from proton.ts
  - getMyGamesPath(compatDataPath) helper returning correct Wine prefix Documents/My Games path
  - local-gamesettings mygamesPath() uses "Documents" (not "My Documents") for Wine prefix
  - ini_prep iniFiles() is async with Linux Proton guard using getMyGamesPath
  - All 4 ini_prep/index.ts call sites await async iniFiles()
affects: [06-steam-proton-detection, phase-07, phase-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "async iniFiles() with optional ISteamEntry — Windows callers pass nothing, Linux callers pass steamEntry"
    - "PromiseBB.resolve(asyncFn()) wrapping to preserve two-arg .catch(FilterClass, handler) at call sites"
    - "getSteamEntry() helper: no-op on non-Linux or non-Steam, looks up entry by gamePath match"

key-files:
  created: []
  modified:
    - src/renderer/src/util/linux/proton.ts
    - extensions/local-gamesettings/src/util/gameSupport.ts
    - src/renderer/src/extensions/ini_prep/gameSupport.ts
    - src/renderer/src/extensions/ini_prep/index.ts

key-decisions:
  - "getMyGamesPath accepts compatDataPath directly (not ISteamEntry) — simpler signature, callers already have the path"
  - "PromiseBB.resolve(asyncFn()) wrapping preserves existing two-arg .catch(UserCanceled, handler) pattern at call sites — avoids rewriting all error handlers"
  - "getSteamEntry() catches all errors and returns undefined — safe fallback to Windows path on any Steam API failure"
  - "err: any cast in three catch handlers — pre-existing typed-catch issue surfaced by async conversion; minimal fix to keep existing error handling intact"

patterns-established:
  - "Linux Proton guard pattern: if (process.platform === 'linux' && steamEntry?.usesProton && steamEntry?.compatDataPath) — use Wine prefix path"
  - "PROTON_USERNAME = 'steamuser' — never os.userInfo().username; canonical constant to prevent this class of bug"

requirements-completed: [STAM-04]

# Metrics
duration: 15min
completed: 2026-03-31
---

# Phase 06 Plan 02: Wine Prefix {mygames} Path Resolution Summary

**Proton Wine prefix INI path resolution fixed: PROTON_USERNAME constant, getMyGamesPath() helper, async iniFiles() with Linux guard, and "My Documents" -> "Documents" bug corrected across two gameSupport files**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-31T22:10:00Z
- **Completed:** 2026-03-31T22:25:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added `PROTON_USERNAME = "steamuser"` constant to proton.ts — prevents os.userInfo().username class of bug
- Added `getMyGamesPath(compatDataPath)` helper building `compatDataPath/pfx/drive_c/users/steamuser/Documents/My Games`
- Fixed long-standing "My Documents" bug in local-gamesettings/gameSupport.ts (Wine uses "Documents", not "My Documents")
- Made ini_prep `iniFiles()` async with Linux Proton guard — Skyrim SE and Fallout 4 INI files now resolve inside Wine prefix on Linux
- Updated all 4 call sites in ini_prep/index.ts to await the async result; Windows behavior completely unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Add PROTON_USERNAME + getMyGamesPath(); fix local-gamesettings "My Documents" bug** - `589ab2668` (feat)
2. **Task 2: Async iniFiles() with Linux Proton guard; update all 4 call sites** - `58ed84d67` (feat)

## Files Created/Modified

- `src/renderer/src/util/linux/proton.ts` - Added PROTON_USERNAME constant and getMyGamesPath() helper
- `extensions/local-gamesettings/src/util/gameSupport.ts` - Fixed "My Documents" -> "Documents" in Wine prefix path
- `src/renderer/src/extensions/ini_prep/gameSupport.ts` - Made iniFiles() async with optional steamEntry + Linux guard
- `src/renderer/src/extensions/ini_prep/index.ts` - Added getSteamEntry() helper; updated 4 call sites to await iniFiles(); PromiseBB.resolve() wrapping for two-arg catch compat

## Decisions Made

- `getMyGamesPath` accepts `compatDataPath: string` (not `ISteamEntry`) — callers already have the path from 06-01 work; simpler, less coupling
- `PromiseBB.resolve(asyncFn())` wrapping at call sites in index.ts: preserves the existing `.catch(UserCanceled, handler)` two-argument PromiseBB syntax without rewriting all three error handler chains
- `getSteamEntry()` returns `undefined` on any failure — safe fallback to Windows documents path ensures no regression
- Added `err: any` type casts in three existing catch handlers — TypeScript's `unknown` catch type surfaced when functions changed from PromiseBB to native Promise; minimal targeted fix to keep pre-existing error handling intact

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PromiseBB two-arg catch incompatible with native async Promise return**

- **Found during:** Task 2 (updating call sites)
- **Issue:** Converting `ensureIniBackups`, `discoverSettingsChanges`, `bakeSettings`, `purgeChanges` to `async` changed their return type from `PromiseBB<void>` to `Promise<void>`. The callers used `.catch(UserCanceled, handler)` — a PromiseBB-only API that TypeScript flags as error TS2554 on native Promise.
- **Fix:** Wrapped each async call in `PromiseBB.resolve(asyncFn())` at the 3 call sites in `context.once()`. This re-wraps the native Promise in PromiseBB without changing behavior.
- **Files modified:** src/renderer/src/extensions/ini_prep/index.ts
- **Verification:** Build passes, no TS2554 errors
- **Committed in:** 58ed84d67 (Task 2 commit)

**2. [Rule 1 - Bug] TypeScript `unknown` type in catch handlers after async conversion**

- **Found during:** Task 2 (build check)
- **Issue:** Three existing `.catch((err) => ...)` handlers accessed `err.code`, `err.path`, `err.stack`, `err.systemCode`, `err.errno` — pre-existing pattern that TypeScript didn't flag in PromiseBB chains but flags as TS2339 on native Promise `.catch` where `err` is `unknown`.
- **Fix:** Added `err: any` type annotation in the three catch handler parameters.
- **Files modified:** src/renderer/src/extensions/ini_prep/index.ts
- **Verification:** Build passes, no TS2339 errors
- **Committed in:** 58ed84d67 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both fixes necessary to keep build green. No scope creep. Pre-existing typing gaps in PromiseBB catch chains surfaced by async conversion; fixed minimally with targeted type annotations.

## Issues Encountered

None beyond the auto-fixed TypeScript issues documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- STAM-04 requirement satisfied: `{mygames}` now resolves to correct Wine prefix path on Linux for Proton games
- PROTON_USERNAME and getMyGamesPath() available for any future phase needing Wine prefix paths
- Phase 06-03 (game extension audit) can now rely on correct INI path resolution for Skyrim SE and Fallout 4

---
*Phase: 06-steam-proton-detection*
*Completed: 2026-03-31*
