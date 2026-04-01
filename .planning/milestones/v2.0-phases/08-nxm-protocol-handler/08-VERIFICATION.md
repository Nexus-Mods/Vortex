---
phase: 08-nxm-protocol-handler
verified: 2026-04-01T00:00:00Z
status: human_needed
score: 6/7 must-haves verified
re_verification: false
human_verification:
  - test: "Click Download with Manager in a browser on standard Linux (GNOME or KDE Plasma) with Vortex running"
    expected: "Vortex receives focus and begins the download immediately"
    why_human: "Requires live browser, NXM link, and running Vortex instance; cannot simulate via grep"
  - test: "Click Download with Manager while Vortex is closed on standard Linux"
    expected: "Vortex launches, waits for Redux store / renderer ready, then begins the download — URL is not silently dropped"
    why_human: "Requires live AppImage or dev build execution on Linux; cold-start path exercises mPendingDownload runtime behavior"
  - test: "Run from AppImage build on standard Linux, open Vortex settings, toggle Handle Nexus Links on"
    expected: "~/.local/share/applications/com.nexusmods.vortex.desktop and com.nexusmods.vortex.sh are written; xdg-settings reports com.nexusmods.vortex.desktop as nxm handler"
    why_human: "Requires an AppImage binary and process.env.APPIMAGE to be set at runtime"
  - test: "Run on KDE Plasma Desktop Mode and trigger NXM handler registration"
    expected: "kbuildsycoca6 --noincremental runs and NXM link opens Vortex; no kbuildsycoca6 errors in logs"
    why_human: "Requires KDE Plasma environment; cannot simulate kbuildsycoca6 availability via static analysis"
  - test: "Steam Browser NXM behavior on SteamOS (if hardware available)"
    expected: "Documented outcome: either confirmed working or deferred to v3.0 per PROT-03"
    why_human: "Requires Steam Deck hardware; hardware was unavailable during this phase; deferral documented in DISCUSSION-LOG.md"
---

# Phase 8: NXM Protocol Handler Verification Report

**Phase Goal:** Clicking "Download with Manager" on Nexus Mods opens Vortex and starts the download — in both dev and AppImage builds, on standard Linux and SteamOS/KDE Plasma
**Verified:** 2026-04-01T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Success Criteria (from ROADMAP.md)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Clicking "Download with Manager" in browser on standard Linux with Vortex already running opens Vortex and immediately begins the download | ? HUMAN | Code path exists and is wired; requires live execution to verify |
| 2 | Clicking "Download with Manager" while Vortex is closed launches Vortex and begins the download after the Redux store is ready — the NXM URL is not silently dropped | ? HUMAN | `mPendingDownload` buffer verified in code; runtime behavior requires live test |
| 3 | The NXM protocol handler is registered and functional when running from a packaged AppImage build (.desktop file written to ~/.local/share/applications/) | ? HUMAN | `ensureAppImageDesktopEntry()` exists and is wired; requires AppImage runtime for file-write verification |
| 4 | NXM handler is confirmed working in SteamOS Desktop Mode (KDE Plasma); Steam Browser behavior documented or deferred to v3.0 if hardware unavailable | ? HUMAN | `kbuildsycoca6` refresh verified in code; SteamOS runtime test requires hardware |

**Score:** 6/7 automated must-haves verified; 0/4 success criteria can be confirmed without live execution

### Observable Truths (from PLAN must_haves)

#### Plan 08-01 Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | AppImage builds write a .desktop file and wrapper script to ~/.local/share/applications/ on every startup | ✓ VERIFIED | `ensureAppImageDesktopEntry()` calls `writeFileIfChanged()` for both `com.nexusmods.vortex.desktop` and `com.nexusmods.vortex.sh`; wired in `registerLinuxNxmProtocolHandler()` under `PACKAGE_DESKTOP_ID && process.env.APPIMAGE` guard |
| 2 | The wrapper script launches the AppImage directly (no appPath positional arg) with LD_LIBRARY_PATH/LD_PRELOAD unset | ✓ VERIFIED | `generateWrapperScript(appImagePath)` called with one argument; `appPath?: string` is optional; generated script has `unset LD_LIBRARY_PATH` and `unset LD_PRELOAD`; `appPathArg` resolves to `""` when undefined |
| 3 | KDE Plasma refreshes its service cache after desktop database update via kbuildsycoca6 | ✓ VERIFIED | `refreshKdeDesktopDatabase()` present in `common.ts` lines 60–69; called from `refreshDesktopDatabase()` line 80 after `update-desktop-database` |
| 4 | xdg-settings registers a desktop ID that actually has a corresponding .desktop file | ✓ VERIFIED | `ensureAppImageDesktopEntry()` runs before `setDefaultUrlSchemeHandler()` in `registerLinuxNxmProtocolHandler()` (lines 68–87 of nxm.ts) — file is written first |

#### Plan 08-02 Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 5 | Cold-start NXM URL (args.download) is captured before the startup sequence and applied after startUi() resolves | ✓ VERIFIED | Line 435 sets `this.mPendingDownload = args.download` before startup; lines 503–509 apply after `await this.startUi()` at line 500 |
| 6 | The download URL is not silently dropped when Vortex is launched via NXM link from a closed state | ✓ VERIFIED | `mPendingDownload` pattern present; buffer is set before any failure-point in startup; apply block uses `.catch()` so a failure logs but does not drop the startup |
| 7 | If startUi() fails, mPendingDownload is cleared silently with a warning log | ✓ VERIFIED | Block clears `this.mPendingDownload = undefined` before calling `applyArguments`; `.catch((err: unknown) => log("warn", "failed to apply pending download", err))` present |
| 8 | The existing second-instance applyArguments path is unchanged | ✓ VERIFIED | Line 251–253 `app.on("second-instance", ...)` handler untouched; `applyArguments` method at line 1143 untouched |

**Score:** 8/8 automated truths verified

### Required Artifacts

| Artifact | Provides | Level 1 (Exists) | Level 2 (Substantive) | Level 3 (Wired) | Status |
|----------|----------|-----------------|----------------------|-----------------|--------|
| `src/renderer/src/util/protocolRegistration/linux/nxm.ts` | `ensureAppImageDesktopEntry` + `PACKAGE_DESKTOP_ID` branch | ✓ | ✓ 329 lines, full implementation | ✓ Called from `registerLinuxNxmProtocolHandler` | ✓ VERIFIED |
| `src/renderer/src/util/protocolRegistration/linux/common.ts` | `refreshKdeDesktopDatabase` called from `refreshDesktopDatabase` | ✓ | ✓ 223 lines, full implementation | ✓ Called at line 80 of `refreshDesktopDatabase` | ✓ VERIFIED |
| `src/main/src/Application.ts` | `mPendingDownload` field + cold-start buffer/apply logic | ✓ | ✓ Field at line 130, buffer at line 435, apply at lines 503–509 | ✓ In active startup code path `regularStartInner` | ✓ VERIFIED |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `registerLinuxNxmProtocolHandler` | `ensureAppImageDesktopEntry` | `desktopId === PACKAGE_DESKTOP_ID && process.env.APPIMAGE` | ✓ WIRED | nxm.ts lines 68–73; guard and call both present |
| `refreshDesktopDatabase` | `refreshKdeDesktopDatabase` | function call after update-desktop-database | ✓ WIRED | common.ts line 80; call is the final statement of `refreshDesktopDatabase` |
| `regularStartInner` | `applyArguments` | `mPendingDownload` buffer applied after `await this.startUi()` | ✓ WIRED | Application.ts lines 500–509; ordering confirmed: buffer at 435, startUi at 500, apply at 503, tray at 511 |
| `startUi` | `mMainWindow.sendExternalURL` | `applyArguments` calls `sendExternalURL` after window is ready | ✓ WIRED | `applyArguments` at line 1143 unchanged; `sendExternalURL` call path intact |
| `registerLinuxProtocolHandler` (linux/index.ts) | `registerLinuxNxmProtocolHandler` | direct call line 46 | ✓ WIRED | Confirmed in `src/renderer/src/util/protocolRegistration/linux/index.ts` |
| `ExtensionManager` | `registerProtocolHandler` | import + call at line 2011 | ✓ WIRED | `ExtensionManager.ts` imports from `./util/protocolRegistration` and calls `registerProtocolHandler` |

### Data-Flow Trace (Level 4)

Not applicable — this phase implements OS-level side-effects (file writes, process spawns), not data rendering components. No state variable flows to UI rendering.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `ensureAppImageDesktopEntry` function exists in nxm.ts | `grep -n "function ensureAppImageDesktopEntry" nxm.ts` | Line 285 | ✓ PASS |
| `kbuildsycoca6` call exists in common.ts | `grep -n "kbuildsycoca6" common.ts` | Lines 61, 65 | ✓ PASS |
| `APPIMAGE_WRAPPER_FILE_NAME` constant defined | `grep "APPIMAGE_WRAPPER_FILE_NAME" nxm.ts` | Line 33: `"com.nexusmods.vortex.sh"` | ✓ PASS |
| `mPendingDownload` field + all 5 usages in Application.ts | `grep -n "mPendingDownload" Application.ts` | Lines 130, 435, 503, 504, 505, 506 — field, assign, check, copy, clear, apply | ✓ PASS |
| `generateWrapperScript` accepts optional appPath | `grep "appPath?" nxm.ts` | Line 145: `appPath?: string` | ✓ PASS |
| All desktop file escaping tests pass | `pnpm exec jest --testPathPattern="desktopFile"` | 16 tests passed in 1.357s | ✓ PASS |
| All three commits present in git history | `git log --oneline d80668bc7 5e34a34a2 7f03d991f` | All three confirmed | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| PROT-01 | 08-01-PLAN.md, 08-02-PLAN.md | NXM "Download with Manager" works on standard Linux (GNOME, KDE Plasma) in both dev and AppImage builds | ✓ CODE VERIFIED / ? HUMAN RUNTIME | `ensureAppImageDesktopEntry()` writes .desktop; `mPendingDownload` handles cold-start; end-to-end behavior requires live Linux test |
| PROT-02 | 08-01-PLAN.md | NXM handler validated on SteamOS/KDE Plasma Desktop Mode; `kbuildsycoca6 --noincremental` triggered after desktop DB update on KDE; Steam Browser NXM behavior documented | ✓ CODE VERIFIED / ? HUMAN RUNTIME | `kbuildsycoca6` call verified in code; KDE Plasma runtime validation and SteamOS hardware test are human-only |

No orphaned requirements: PROT-03 (Steam Browser on Steam Deck) is explicitly deferred to v3.0 and not assigned to Phase 8 in REQUIREMENTS.md.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `nxm.ts` | 166 | `return null` | ℹ️ Info | Inside `.map()` callback for env var export lines; immediately filtered by `.filter((line): line is string => line !== null)` — not a stub, idiomatic TypeScript pattern |
| `Application.ts` | 561, 1164 | `TODO:` comments | ℹ️ Info | Pre-existing TODOs unrelated to Phase 8 changes; not introduced by this phase |

No blockers or warnings. No placeholder implementations found.

### Human Verification Required

#### 1. End-to-End NXM Link with Running Vortex

**Test:** On standard Linux (GNOME or KDE Plasma), launch Vortex, navigate to any mod on nexusmods.com, click "Download with Manager"
**Expected:** Vortex window receives focus and a download begins
**Why human:** Requires a live browser with nxm:// protocol routing to a running Electron instance; cannot simulate via static analysis

#### 2. Cold-Start NXM URL (Vortex Closed)

**Test:** Ensure Vortex is fully closed. Click "Download with Manager" on any Nexus Mods page. Wait for Vortex to launch.
**Expected:** Vortex launches, the Redux store initializes, and the download begins — the NXM URL is not silently dropped
**Why human:** The `mPendingDownload` runtime behavior (timing of `show-window` IPC vs `external-url` IPC) must be observed in a real Electron process

#### 3. AppImage Desktop Entry File Write

**Test:** Run Vortex from an AppImage (`./Vortex.AppImage`), open Settings → Nexus Mods → enable "Handle Nexus Links"
**Expected:** `~/.local/share/applications/com.nexusmods.vortex.desktop` and `com.nexusmods.vortex.sh` exist; `xdg-settings get default-url-scheme-handler nxm` returns `com.nexusmods.vortex.desktop`
**Why human:** `process.env.APPIMAGE` is only set when running from an actual AppImage binary; the guard `&& process.env.APPIMAGE` cannot be exercised in a Node test environment

#### 4. KDE Plasma Cache Refresh

**Test:** On KDE Plasma, trigger NXM handler registration (toggle Handle Nexus Links or app startup)
**Expected:** `kbuildsycoca6 --noincremental` runs without error visible in Vortex logs; after registration, clicking an NXM link opens Vortex
**Why human:** Requires a KDE Plasma session where `kbuildsycoca6` is on PATH; GNOME/other DE tests cannot cover this path

#### 5. SteamOS / Steam Browser (Deferred)

**Test:** On Steam Deck hardware in Desktop Mode, confirm NXM handler registration works via KDE Plasma; test Steam Browser NXM behavior if possible
**Expected:** If hardware available — NXM confirmed working; if unavailable — document as deferred to v3.0 per PROT-03
**Why human:** Steam Deck hardware was unavailable during this phase; outcome is documented as deferred in `08-DISCUSSION-LOG.md` line 70

### Gaps Summary

No code gaps found. All automated checks pass. The phase goal is code-complete: the implementation correctly handles AppImage desktop entry creation (`ensureAppImageDesktopEntry`), KDE Plasma cache refresh (`kbuildsycoca6`), and cold-start NXM URL buffering (`mPendingDownload`). All key links are wired. All three commits are present in git history. Existing tests pass.

The `human_needed` status reflects that the four success criteria in ROADMAP.md describe end-to-end behavioral outcomes (browser click → download starts) that require a live Linux environment with a real browser, NXM-linked account, and either a dev or AppImage build. These cannot be verified by static analysis.

---

_Verified: 2026-04-01T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
