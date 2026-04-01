---
phase: 08-nxm-protocol-handler
plan: 01
subsystem: linux-protocol
tags: [linux, nxm, appimage, kde, xdg, desktop-entry, protocol-handler]

# Dependency graph
requires:
  - phase: 07-linux-packaging
    provides: AppImage build config; APPIMAGE env var set at runtime by AppImage launcher

provides:
  - ensureAppImageDesktopEntry() writes .desktop file + wrapper script for AppImage builds
  - generateWrapperScript() handles optional appPath (AppImage vs dev build)
  - refreshKdeDesktopDatabase() calls kbuildsycoca6 after desktop database refresh on KDE Plasma
  - PACKAGE_DESKTOP_ID branch in registerLinuxNxmProtocolHandler() wired to AppImage entry creation

affects:
  - 08-02-nxm-protocol-handler (cold-start buffer; builds on same nxm.ts flow)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AppImage desktop entry: self-contained binary, no appPath positional arg in wrapper"
    - "KDE Plasma cache refresh: kbuildsycoca6 --noincremental; ENOENT silently skipped for non-KDE"
    - "APPIMAGE env var guard: process.env.APPIMAGE truthy only inside AppImage runtime"

key-files:
  created: []
  modified:
    - src/renderer/src/util/protocolRegistration/linux/nxm.ts
    - src/renderer/src/util/protocolRegistration/linux/common.ts

key-decisions:
  - "generateWrapperScript appPath made optional: AppImage is self-contained, no Electron appPath arg needed"
  - "APPIMAGE_WRAPPER_FILE_NAME = com.nexusmods.vortex.sh (non-dev variant)"
  - "ensureAppImageDesktopEntry uses Name=Vortex with NoDisplay=true (not dev build label)"
  - "kbuildsycoca6 ENOENT logged at debug not warn/error (expected on non-KDE desktops)"

patterns-established:
  - "AppImage entry creation mirrors ensureDevDesktopEntry() structure exactly; diverges only in name/file constants and appPath omission"
  - "Both wrapper and .desktop file written before xdg-settings registration to prevent non-existent desktop ID error"

requirements-completed: [PROT-01, PROT-02]

# Metrics
duration: 8min
completed: 2026-04-01
---

# Phase 8 Plan 1: NXM Protocol Handler — AppImage Desktop Entry Summary

**AppImage .desktop entry + KDE kbuildsycoca6 refresh wired for NXM protocol handler registration on Linux**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-01T01:33:00Z
- **Completed:** 2026-04-01T01:41:02Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `refreshKdeDesktopDatabase()` to `common.ts`; it runs `kbuildsycoca6 --noincremental` after `update-desktop-database` — ENOENT silently skipped for non-KDE desktops
- Made `generateWrapperScript()` accept optional `appPath` so AppImage builds omit the positional Electron arg; dev builds are unaffected
- Added `ensureAppImageDesktopEntry()` in `nxm.ts` mirroring `ensureDevDesktopEntry()`: writes `com.nexusmods.vortex.sh` wrapper and `com.nexusmods.vortex.desktop` entry with `Name=Vortex` / `NoDisplay=true`
- Wired `PACKAGE_DESKTOP_ID && process.env.APPIMAGE` branch in `registerLinuxNxmProtocolHandler()` so the .desktop file is written before `xdg-settings` tries to register it

## Task Commits

1. **Task 1: KDE kbuildsycoca6 refresh + optional appPath in wrapper** - `d80668bc7` (feat)
2. **Task 2: ensureAppImageDesktopEntry + PACKAGE_DESKTOP_ID branch** - `5e34a34a2` (feat)

## Files Created/Modified
- `src/renderer/src/util/protocolRegistration/linux/nxm.ts` - Added `APPIMAGE_WRAPPER_FILE_NAME`, `ensureAppImageDesktopEntry()`, optional `appPath` in `generateWrapperScript()`, `PACKAGE_DESKTOP_ID` branch in `registerLinuxNxmProtocolHandler()`
- `src/renderer/src/util/protocolRegistration/linux/common.ts` - Added `refreshKdeDesktopDatabase()` and call from `refreshDesktopDatabase()`

## Decisions Made
- `generateWrapperScript` appPath made optional: AppImage builds (`process.env.APPIMAGE`) are self-contained executables — the wrapper invokes the AppImage directly with no Electron appPath positional arg. Dev builds still pass both args.
- `kbuildsycoca6` ENOENT logged at `"debug"` level (not warn/error): the command simply not existing is the expected state on GNOME/Hyprland/etc.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- AppImage NXM registration path is complete: desktop entry written before xdg-settings, KDE cache refreshed after update-desktop-database
- Plan 08-02 (cold-start NXM URL buffer in Application.ts) is the remaining plan in this phase

## Self-Check: PASSED

- FOUND: src/renderer/src/util/protocolRegistration/linux/nxm.ts
- FOUND: src/renderer/src/util/protocolRegistration/linux/common.ts
- FOUND: .planning/phases/08-nxm-protocol-handler/08-01-SUMMARY.md
- FOUND: d80668bc7 (feat: KDE kbuildsycoca6 + optional appPath)
- FOUND: 5e34a34a2 (feat: ensureAppImageDesktopEntry + PACKAGE_DESKTOP_ID branch)

---
*Phase: 08-nxm-protocol-handler*
*Completed: 2026-04-01*
