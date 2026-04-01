---
phase: 06-steam-proton-detection
plan: 03
subsystem: game-extensions
tags: [steam, proton, fallout4, skyrimse, cyberpunk2077, stardewvalley, winapi-bindings, linux]

# Dependency graph
requires:
  - phase: 06-02
    provides: getMyGamesPath() Wine prefix resolution + ini_prep STAM-04 Linux guard
provides:
  - "Fallout 4 extension loads on Linux without MODULE_NOT_FOUND (winapi-bindings dead import removed)"
  - "All top-4 game titles audited and confirmed Linux-compatible"
affects: [07-dist-packaging, future-game-extension-work]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Remove Windows-only dead imports from bundled JS extensions (not covered by webpack alias)"]

key-files:
  created: []
  modified:
    - extensions/games/game-fallout4/src/index.js

key-decisions:
  - "Fallout 4 winapi-bindings: dead import removed from source (dist is generated at build time, gitignored)"
  - "Cyberpunk 2077 is a registerGameStub with no imports — fully Linux safe"
  - "Stardew Valley uses platform-conditional requiredFiles/executable — native Linux binary already supported"
  - "Skyrim SE has no winapi-bindings; {mygames} INI paths resolved via STAM-04 Wine prefix fix in ini_prep"

patterns-established:
  - "Bundled game extensions use copyfiles (not webpack) — webpack alias does NOT cover them; check for Windows-only require() calls"

requirements-completed: [STAM-05]

# Metrics
duration: 5min
completed: 2026-03-31
---

# Phase 06 Plan 03: Game Extensions Audit Summary

**Dead winapi-bindings require removed from Fallout 4; all 4 top-title game extensions confirmed Linux-compatible**

## Performance

- **Duration:** ~20 min (including human verification + auto-fix iteration)
- **Started:** 2026-03-31T22:16:00Z
- **Completed:** 2026-04-01T11:00:04Z
- **Tasks:** 2 of 2
- **Files modified:** 5

## Accomplishments

- Removed dead `const winapi = require('winapi-bindings')` from `game-fallout4/src/index.js` (variable never referenced, causes MODULE_NOT_FOUND on Linux at runtime since bundled extensions bypass webpack alias)
- Confirmed Cyberpunk 2077 is a pure `registerGameStub` with zero imports — fully Linux safe
- Confirmed Stardew Valley has native Linux executable detection (`requiredFiles: ["StardewValley"]` on non-win32, Linux `defaultPaths` included)
- Confirmed Skyrim SE has no winapi-bindings dependency and uses `{mygames}` template INI paths that inherit the STAM-04 Wine prefix fix from `ini_prep/gameSupport.ts`
- Fixed 3 additional bugs discovered during STAM-05 end-to-end verification: Steam secondary library detection, Steam lookup silent drop on Linux, staging folder disk-usage check hard-rejected on non-Windows

## Verification Results (STAM-05 End-to-End)

Human verified on Linux 2026-04-01:
- Vortex launches on Linux without crash
- Steam library detected: 546+ games
- Secondary Steam library (`/media/alex/intel/SteamLibrary`) detected
- Fallout 4 auto-discovered via Steam game list
- Mod staging folder works (disk usage check passes on Linux)
- Fallout 4 extension loads without MODULE_NOT_FOUND

STAM-05 satisfied.

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove dead winapi-bindings require from Fallout 4 and audit remaining 3 titles** - `942997faf` (fix)
2. **Task 2: Verify Steam/Proton detection end-to-end on Linux** - `023f8006a` (fix — 3 verification bugs auto-fixed via Rule 1)

## Files Created/Modified

- `extensions/games/game-fallout4/src/index.js` - Removed unused `const winapi = require('winapi-bindings')` on line 4
- `src/renderer/src/util/linux/steamPaths.ts` - Resolve `~/.steam/root` symlink first; read `libraryfolders.vdf` from all valid Steam roots so secondary libraries are always discovered
- `src/renderer/src/util/Steam.ts` - Updated to iterate all steam roots from `findAllLinuxSteamPaths()` when reading VDF library folders
- `src/renderer/src/util/GameStoreHelper.ts` - Dropped `result.priority !== undefined` guard in `find()` that silently dropped all Steam entries on Linux
- `src/renderer/src/util/transferPath.ts` - Removed win32-only guard from `testPathTransfer()`; uses destination path directly for `diskusage.check()` on Linux

## Decisions Made

- **Bundled extension webpack alias gap**: Bundled game extensions under `extensions/games/` are distributed via `copyfiles` (not webpack bundle), so the webpack/rolldown alias for `winapi-bindings` does NOT intercept their `require()` calls at runtime. This means any remaining Windows-only `require()` in these JS files will fire unconditionally on Linux. Fix: remove dead imports from source.
- **Dist is gitignored**: `extensions/games/game-fallout4/dist/` is in `.gitignore`. Only `src/index.js` is committed; dist is regenerated at build time via `pnpm run _build`.

## Audit Findings

### Fallout 4
- **Issue**: Line 4 `const winapi = require('winapi-bindings')` — variable `winapi` is never referenced anywhere in the 141-line file
- **Fix**: Line removed from `src/index.js`
- **Other requires intact**: `bluebird`, `path`, `vortex-api` all present and used
- **Status**: FIXED — will load on Linux without MODULE_NOT_FOUND

### Cyberpunk 2077
- **Audit**: Pure stub (`registerGameStub`); only 17 lines with zero require/import statements
- **Status**: CONFIRMED CLEAN — no Windows-only dependencies

### Stardew Valley
- **Audit**: `StardewValleyGame.ts` uses `process.platform == "win32"` guards for `requiredFiles` and `executable()`; on Linux `requiredFiles: ["StardewValley"]` (native ELF binary); `defaultPaths` includes Linux paths (`~/.local/share/Steam/steamapps/...`)
- **Status**: CONFIRMED — native Linux support already present

### Skyrim SE
- **Audit**: `src/index.js` has no winapi-bindings import; uses `{mygames}` template paths for all INI files; `ini_prep/gameSupport.ts` resolves `{mygames}` to Wine prefix path via `getMyGamesPath(compatDataPath)` on Linux when `steamEntry.usesProton` is true (STAM-04 fix from plan 06-02)
- **Status**: CONFIRMED — inherits STAM-04 Wine prefix fix

## Deviations from Plan

Three bugs were discovered during the STAM-05 end-to-end human verification and auto-fixed per Rule 1 (broken behavior).

### Auto-fixed Issues

**1. [Rule 1 - Bug] steamPaths.ts: ~/.steam/root symlink not resolved; only first root read VDF**
- **Found during:** Task 2 (STAM-05 end-to-end verification on Linux)
- **Issue:** `findAllLinuxSteamPaths()` did not resolve `~/.steam/root` symlink (the canonical pointer Valve installs for all Linux Steam variants). Also, `libraryfolders.vdf` was only read from the first discovered root, so secondary libraries on other drives were not discovered.
- **Fix:** Added `fs.realpathSync` resolution of `~/.steam/root` before deduplication; moved VDF reading to iterate over all valid roots
- **Files modified:** `src/renderer/src/util/linux/steamPaths.ts`, `src/renderer/src/util/Steam.ts`
- **Verification:** Secondary Steam library (`/media/alex/intel/SteamLibrary`) appeared in game list; 546+ games detected
- **Committed in:** `023f8006a`

**2. [Rule 1 - Bug] GameStoreHelper.ts: result.priority guard silently dropped all Steam entries on Linux**
- **Found during:** Task 2 (STAM-05 end-to-end verification on Linux)
- **Issue:** `find()` in `GameStoreHelper.ts` had a guard `result.priority !== undefined` that filtered out results without an explicit priority. Steam entries on Linux never set `priority` (only Windows `registryLookup` path sets it), so all Steam game lookups returned `undefined` on Linux.
- **Fix:** Removed the `result.priority !== undefined` guard — priority is optional, not required for a valid result
- **Files modified:** `src/renderer/src/util/GameStoreHelper.ts`
- **Verification:** Fallout 4 auto-discovered from Steam game list on Linux
- **Committed in:** `023f8006a`

**3. [Rule 1 - Bug] transferPath.ts: testPathTransfer() hard-rejected on non-Windows**
- **Found during:** Task 2 (STAM-05 end-to-end verification on Linux)
- **Issue:** `testPathTransfer()` called `winapi.GetVolumePathName()` under a `win32`-only guard; on Linux it early-returned an error, making the mod staging folder disk-usage check always fail
- **Fix:** Removed the win32-only guard; on Linux use the destination path directly for `diskusage.check()` instead of deriving the volume path via winapi
- **Files modified:** `src/renderer/src/util/transferPath.ts`
- **Verification:** Mod staging folder accepted; no disk-usage errors on Linux
- **Committed in:** `023f8006a`

---

**Total deviations:** 3 auto-fixed (all Rule 1 — broken behavior found during verification)
**Impact on plan:** All three fixes were necessary for STAM-05 to pass. No scope creep.

## Issues Encountered

- `extensions/games/game-fallout4/dist/` is gitignored, so `dist/index.js` could not be committed separately. Dist is regenerated via `pnpm run _build` (copyfiles from src). This is correct behavior — source is the canonical file.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All STAM-01 through STAM-05 requirements addressed and verified across plans 06-01, 06-02, 06-03
- Phase 06 (steam-proton-detection) is fully complete — STAM-05 satisfied
- Phase 07 (dist packaging) is unblocked and ready to proceed

---
*Phase: 06-steam-proton-detection*
*Completed: 2026-03-31*
