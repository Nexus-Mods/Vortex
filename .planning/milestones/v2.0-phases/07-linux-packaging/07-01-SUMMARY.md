---
phase: 07-linux-packaging
plan: 01
subsystem: infra
tags: [electron-builder, appimage, deb, linux-packaging, auto-updater]

# Dependency graph
requires:
  - phase: 01-runtime-environment
    provides: electron-builder Linux packaging foundation (RENV-03 — zip target was placeholder)
provides:
  - electron-builder config targeting AppImage + deb with GitHub publish and deb.depends
  - Linux auto-updater gate in Application.ts via process.env.APPIMAGE
affects: [07-02-github-actions-ci, DIST-01, DIST-02, DIST-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "process.env.APPIMAGE as AppImage install signal (set by AppImage runtime at launch)"
    - "platform guard pattern: if (process.platform === 'linux') else Windows path"

key-files:
  created: []
  modified:
    - src/main/electron-builder.config.json
    - src/main/src/Application.ts

key-decisions:
  - "linux.artifactName mirrors nsis.artifactName pattern: vortex-setup-${version}.${ext}"
  - "deb.depends: xdg-utils (NXM protocol handler) + libasound2 (Electron audio)"
  - "Auto-updater gate: APPIMAGE env var only — zip and deb installs get managed (no updater)"

patterns-established:
  - "Platform guard before Windows-specific stat() check in identifyInstallType()"

requirements-completed: [DIST-01, DIST-02, DIST-04]

# Metrics
duration: 2min
completed: 2026-04-01
---

# Phase 7 Plan 01: Linux Packaging Config Summary

**electron-builder AppImage + deb targets configured and auto-updater gated behind process.env.APPIMAGE on Linux**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-01T00:39:30Z
- **Completed:** 2026-04-01T00:41:40Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- electron-builder.config.json updated: linux.target changed from `["zip"]` to `["AppImage", "deb"]`; artifactName, publish, and deb.depends added
- Application.ts identifyInstallType() gains Linux branch: AppImage installs (APPIMAGE env var set) get "regular" (updater enabled); all other Linux installs get "managed"
- Windows code path completely unchanged — Uninstall Vortex.exe check preserved in else branch
- TypeScript build (`pnpm run build`) passes with no errors

## Task Commits

1. **Task 1: Configure electron-builder for AppImage + deb targets** - `2c2fc2624` (feat)
2. **Task 2: Add Linux branch to identifyInstallType() for auto-updater gate** - `95fecf5b0` (feat)

## Files Created/Modified
- `src/main/electron-builder.config.json` - linux.target AppImage+deb, artifactName, publish, deb.depends added
- `src/main/src/Application.ts` - Linux platform guard in identifyInstallType() using process.env.APPIMAGE

## Decisions Made
- `linux.artifactName` mirrors the `nsis.artifactName` pattern (`vortex-setup-${version}.${ext}`) for naming consistency
- `deb.depends` includes `xdg-utils` (required for NXM protocol registration) and `libasound2` (Electron audio, common Debian dependency)
- Auto-updater gate uses `process.env.APPIMAGE` — the AppImage runtime sets this env var automatically on launch; zip and deb installs get "managed" (no auto-updater)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - both config changes are complete and functional.

## Next Phase Readiness

- electron-builder is fully configured for Linux AppImage + deb distribution
- Auto-updater gate is in place for AppImage installs
- Ready for Phase 07-02: GitHub Actions CI workflow to produce Linux artifacts

---
*Phase: 07-linux-packaging*
*Completed: 2026-04-01*
