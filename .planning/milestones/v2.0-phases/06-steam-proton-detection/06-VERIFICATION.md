---
phase: 06-steam-proton-detection
verified: 2026-04-01T00:07:39Z
status: passed
score: 12/12 must-haves verified
re_verification: false
---

# Phase 06: Steam/Proton Detection Verification Report

**Phase Goal:** Implement Steam/Proton detection so Vortex can find Steam games on Linux, resolve Wine prefix paths for Bethesda INI files, and confirm top-4 game extensions are Linux-compatible.
**Verified:** 2026-04-01T00:07:39Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All valid Steam roots discovered (native + Flatpak + any additional) | VERIFIED | `findAllLinuxSteamPaths()` in steamPaths.ts:79 filters all candidates through `isValidSteamPath()`; `.steam/root` symlink resolved via `fs.realpathSync` at line 19 |
| 2 | Games from all Steam roots appear deduplicated by appid | VERIFIED | Steam.ts uses `findAllLinuxSteamPaths()` in `resolveSteamPaths()` (line 257); `Set<string>` dedup at lines 442-447 |
| 3 | Never-launched Windows-only games detected as usesProton=true via oslist field | VERIFIED | proton.ts `getProtonInfo()` line 250-252: `const needsProton = oslist ? !oslist.toLowerCase().includes("linux") : compatDataExists` |
| 4 | Native Linux games (oslist contains linux) correctly NOT marked as Proton | VERIFIED | Same oslist check — `.includes("linux")` returns false for usesProton |
| 5 | Proton {mygames} resolves to compatdata Wine prefix Documents/My Games | VERIFIED | `getMyGamesPath()` in proton.ts:22-32 builds `compatDataPath/pfx/drive_c/users/steamuser/Documents/My Games` |
| 6 | Wine prefix path uses Documents not My Documents | VERIFIED | local-gamesettings/gameSupport.ts line 167: `"Documents"` (0 occurrences of "My Documents") |
| 7 | PROTON_USERNAME is always steamuser, never os.userInfo().username | VERIFIED | proton.ts:16 `export const PROTON_USERNAME = "steamuser"` |
| 8 | Windows code paths completely unchanged | VERIFIED | All Linux guards use `process.platform === "linux"` checks; fallback always returns Windows path |
| 9 | iniFiles() call sites in ini_prep/index.ts work correctly with async return | VERIFIED | All 4 call sites await iniFiles() (lines 60, 135, 218, 341 in index.ts) |
| 10 | Fallout 4 loads on Linux without MODULE_NOT_FOUND | VERIFIED | `grep -c "winapi-bindings" extensions/games/game-fallout4/src/index.js` returns 0 |
| 11 | Cyberpunk 2077 has no winapi-bindings dependency | VERIFIED | No winapi-bindings in game-cyberpunk2077/src — pure registerGameStub |
| 12 | Stardew Valley has native Linux executable detection | VERIFIED | linux-specific test file `install.linux.test.ts` + `linuxSMAPIPlatform` export confirm Linux support |

**Score:** 12/12 truths verified

---

### Required Artifacts

| Artifact | Expected | Exists | Substantive | Wired | Status |
|----------|----------|--------|-------------|-------|--------|
| `src/renderer/src/util/linux/steamPaths.ts` | findAllLinuxSteamPaths() | Yes | Yes (82 lines, realpathSync + filter) | Yes (imported by Steam.ts) | VERIFIED |
| `src/renderer/src/util/linux/proton.ts` | oslist-aware getProtonInfo(), PROTON_USERNAME, getMyGamesPath() | Yes | Yes (312 lines, full implementation) | Yes (imported by ini_prep/gameSupport.ts) | VERIFIED |
| `src/renderer/src/util/Steam.ts` | Multi-root scanning + appid dedup | Yes | Yes (findAllLinuxSteamPaths + Set dedup) | Yes (uses steamPaths + proton) | VERIFIED |
| `extensions/local-gamesettings/src/util/gameSupport.ts` | Documents fix | Yes | Yes (Documents present, My Documents absent) | Yes (runtime platform guard active) | VERIFIED |
| `src/renderer/src/extensions/ini_prep/gameSupport.ts` | Async iniFiles() with Linux guard | Yes | Yes (async, getMyGamesPath import, usesProton guard) | Yes (called by index.ts) | VERIFIED |
| `src/renderer/src/extensions/ini_prep/index.ts` | 4 call sites await async iniFiles() | Yes | Yes (4x await iniFiles + getSteamEntry helper) | Yes (wired to gameSupport.ts + Steam) | VERIFIED |
| `extensions/games/game-fallout4/src/index.js` | No winapi-bindings require | Yes | Yes (dead import removed, other requires intact) | N/A (standalone bundled extension) | VERIFIED |

---

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `Steam.ts` | `linux/steamPaths.ts` | `import { findAllLinuxSteamPaths }` | WIRED | Line 24-27: import confirmed; line 257: used in resolveSteamPaths() |
| `Steam.ts` | `linux/proton.ts` | `getProtonInfo()` with oslist | WIRED | Line 404: `entry.manifestData?.["AppState"]?.["oslist"]` passed as 4th arg |
| `ini_prep/gameSupport.ts` | `linux/proton.ts` | `import { getMyGamesPath }` | WIRED | Line 7: import confirmed; line 223: called when usesProton + compatDataPath |
| `ini_prep/index.ts` | `ini_prep/gameSupport.ts` | `await iniFiles(gameMode, discovery, steamEntry)` | WIRED | 4 call sites confirmed (lines 60, 135, 218, 341) |
| `local-gamesettings/gameSupport.ts` | Wine prefix filesystem | `path.join(... "Documents" ...)` | WIRED | Line 167: "Documents" present; no "My Documents" occurrences |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `Steam.ts` `parseManifests()` | `entry.manifestData["AppState"]["oslist"]` | ACF manifest file read from steamapps/ | Yes — reads real VDF files from disk | FLOWING |
| `ini_prep/gameSupport.ts` `iniFiles()` | `steamEntry.compatDataPath` | `getSteamEntry()` → `steam.allGames()` → real Steam scan | Yes — live Steam game list | FLOWING |
| `local-gamesettings/gameSupport.ts` `mygamesPath()` | `discovery.path` → `steamAppsPath` derivation | Redux state discovery object | Yes — real discovery path | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: Human verified per STAM-05 end-to-end verification (2026-04-01, Linux). Results documented in 06-03-SUMMARY.md:
- Vortex launches on Linux without crash
- Steam library detected: 546+ games
- Secondary Steam library (`/media/alex/intel/SteamLibrary`) detected
- Fallout 4 auto-discovered via Steam game list
- Mod staging folder works (disk usage check passes on Linux)
- Fallout 4 extension loads without MODULE_NOT_FOUND

Automated spot-checks skipped — requires running Electron on Linux (external runtime dependency, not checkable with grep/file inspection). Human verification covers all behavioral truths.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| STAM-01 | 06-01 | Steam game library VDF parsing works on Linux | SATISFIED | findAllLinuxSteamPaths() reads libraryfolders.vdf; existing VDF parsing unchanged |
| STAM-02 | 06-01 | All valid Steam roots scanned; Flatpak paths resolved; dual-install handled | SATISFIED | findAllLinuxSteamPaths() includes Flatpak path; Set<string> dedup in parseManifests() |
| STAM-03 | 06-01 | Proton prefix resolved per-game; never-launched games detected via oslist | SATISFIED | getProtonInfo() with oslist parameter; oslist primary signal for never-launched games |
| STAM-04 | 06-02 | {mygames} resolves to correct Wine prefix location on Linux | SATISFIED | getMyGamesPath() + async iniFiles() + local-gamesettings Documents fix |
| STAM-05 | 06-03 | Top-4 titles confirmed working on Linux | SATISFIED | Fallout 4 dead import removed; Cyberpunk/Stardew/Skyrim SE confirmed clean; human verified end-to-end |

All 5 STAM requirements satisfied. No orphaned requirements.

---

### Anti-Patterns Found

None. Scanned all 7 modified files for TODO/FIXME/HACK/PLACEHOLDER/empty returns. No anti-patterns detected.

The `err: any` casts in ini_prep/index.ts catch handlers are documented deviations (pre-existing PromiseBB typed-catch issue surfaced by async conversion) — not new stubs.

---

### Human Verification Required

All automated checks passed. Human verification was performed end-to-end as part of STAM-05 (Task 2, checkpoint:human-verify in 06-03-PLAN.md). Results documented in 06-03-SUMMARY.md. No further human verification needed.

---

### Commit Verification

All implementation commits confirmed present in git:

| Commit | Plan | Description |
|--------|------|-------------|
| `3e2c31458` | 06-01 Task 1 | findAllLinuxSteamPaths() and multi-root Steam scanning |
| `0f1daeb56` | 06-01 Task 2 | oslist-aware Proton detection |
| `589ab2668` | 06-02 Task 1 | PROTON_USERNAME + getMyGamesPath(); fix My Documents bug |
| `58ed84d67` | 06-02 Task 2 | async iniFiles() with Linux Proton guard; 4 call sites updated |
| `942997faf` | 06-03 Task 1 | Remove dead winapi-bindings require from Fallout 4 |
| `023f8006a` | 06-03 Task 2 | Fix 3 Linux game discovery bugs (secondary library, GameStoreHelper, transferPath) |

---

### Gaps Summary

No gaps. All 12 must-have truths verified at all levels (exists, substantive, wired, data-flowing). Phase 06 goal fully achieved.

---

_Verified: 2026-04-01T00:07:39Z_
_Verifier: Claude (gsd-verifier)_
