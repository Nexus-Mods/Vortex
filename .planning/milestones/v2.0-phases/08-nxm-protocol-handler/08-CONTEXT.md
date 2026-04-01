# Phase 8: NXM Protocol Handler - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the `nxm://` protocol so clicking "Download with Manager" on Nexus Mods opens Vortex and starts the download — in both dev and AppImage builds, on standard Linux (GNOME, KDE Plasma) and SteamOS Desktop Mode.

Two gaps remain in the already-complete `protocolRegistration/linux/` module:
1. AppImage builds never write their `.desktop` file to `~/.local/share/applications/` — registration via `xdg-settings` silently fails
2. Cold-start NXM URLs (Vortex not running when link is clicked) are silently dropped — `applyArguments()` is never called with the startup `args.download` value

</domain>

<decisions>
## Implementation Decisions

### AppImage Desktop Entry
- **D-01:** Add `ensureAppImageDesktopEntry()` to `src/renderer/src/util/protocolRegistration/linux/nxm.ts`, following the exact same pattern as `ensureDevDesktopEntry()`. Write `com.nexusmods.vortex.desktop` + a wrapper script `com.nexusmods.vortex.sh` to `applicationsDirectory()` (`~/.local/share/applications/` or `$XDG_DATA_HOME/applications/`).

- **D-02:** Exec= line uses a wrapper script (not direct `$APPIMAGE` path). Wrapper script:
  - Unsets `LD_LIBRARY_PATH` and `LD_PRELOAD` (critical for NixOS/Vivaldi library conflicts — already in dev wrapper)
  - Resolves `$APPIMAGE` env var to a literal path at write time (not embedded as variable)
  - Conditionally passes `--download "$@"` only when `$1` is non-empty (same as dev wrapper)
  - Captures relevant Electron env vars (`XDG_DATA_DIRS`, `GIO_EXTRA_MODULES`, etc.)

- **D-03:** Desktop entry uses `Name=Vortex`, `NoDisplay=true` (hidden from app launchers — same as dev entry). It's a protocol handler, not a launcher. Full field set matches `ensureDevDesktopEntry()` output.

- **D-04:** Write on every startup (idempotently) when running from AppImage (`process.env.APPIMAGE` is set). `writeFileIfChanged()` already handles no-ops — zero I/O cost when content is identical. Ensures the entry stays current after AppImage version updates. Call site: in `registerLinuxNxmProtocolHandler()`, in the `desktopId === PACKAGE_DESKTOP_ID` branch (parallel to the existing `DEV_DESKTOP_ID` branch).

- **D-05:** KDE Plasma requires `kbuildsycoca6 --noincremental` after `update-desktop-database` to refresh its `.desktop` cache. Add a `refreshKdeDesktopDatabase(applicationsDir)` helper in `common.ts` that:
  - Attempts `kbuildsycoca6 --noincremental`
  - Logs debug on failure (ENOENT = not KDE, not an error)
  - Call it from `refreshDesktopDatabase()` after the existing `update-desktop-database` call

### Cold-Start NXM Buffer
- **D-06:** Add `private mPendingDownload: string | undefined` field to the `Application` class in `src/main/src/Application.ts`.

- **D-07:** In `regularStartInner(args)`, capture `args.download` into `mPendingDownload` before the main startup sequence. After `await this.startUi()` resolves, if `mPendingDownload` is set, call `this.applyArguments({ download: this.mPendingDownload })` then clear the field.

- **D-08:** `mMainWindow.create()` already resolves when the renderer sends `show-window` — at that point, `ipcRenderer.on("external-url", ...)` is already registered (registered at line ~742, `show-window` sent at line ~910 in renderer.tsx). No new IPC signal needed.

- **D-09:** If `startUi()` throws or `mMainWindow` is never created, log a warning and drop `mPendingDownload` silently. The startup failure is a separate error path; do not compound it with a download error dialog.

- **D-10:** The existing 2-second timeout + error dialog in `applyArguments()` stays as-is for the `second-instance` path (where Vortex is already running but window creation may be in progress). The cold-start path bypasses that code entirely by calling `applyArguments` only after `startUi()` resolves.

### PROT-02: SteamOS / KDE Plasma Scope
- **D-11:** KDE Plasma Desktop Mode on standard Linux is in scope and covered by D-05. SteamOS (Steam Deck hardware) is validated as best-effort: if hardware is available, test. If not, document Steam Browser NXM behavior as unknown and deferred to v3.0 per REQUIREMENTS.md PROT-03.
- **D-12:** `kbuildsycoca6` call (D-05) covers KDE Plasma on both standard Linux and SteamOS Desktop Mode.

### Claude's Discretion
- Whether to add integration tests for the AppImage desktop entry write path (unit tests for `ensureAppImageDesktopEntry()` following the existing `desktopFileEscaping.test.ts` pattern)
- Whether to expose `mPendingDownload` as a method or keep it as a private field
- Exact AppImage path resolution: `process.env.APPIMAGE` is set by the AppImage runtime and always contains the absolute path to the `.AppImage` file — use it directly

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Protocol Registration Code
- `src/renderer/src/util/protocolRegistration/linux/nxm.ts` — primary file to modify; add `ensureAppImageDesktopEntry()` and call it in `registerLinuxNxmProtocolHandler()`
- `src/renderer/src/util/protocolRegistration/linux/common.ts` — add `refreshKdeDesktopDatabase()` here; existing `refreshDesktopDatabase()` and `writeFileIfChanged()` helpers are here
- `src/renderer/src/util/protocolRegistration/linux/index.ts` — route dispatcher; no changes expected
- `src/renderer/src/util/protocolRegistration/index.ts` — platform facade; no changes expected

### Application.ts Cold-Start Path
- `src/main/src/Application.ts` — add `mPendingDownload` field and post-startUi dispatch; see `regularStartInner()` (~line 428), `startUi()` (~line 197), `applyArguments()` (~line 1130)
- `src/main/src/MainWindow.ts` — `create()` resolves on `ready-to-show` / `show-window` IPC (~line 263); `sendExternalURL()` sends `external-url` IPC (~line 337)
- `src/renderer/src/renderer.tsx` — `external-url` IPC listener registered ~line 742, `show-window` sent ~line 910

### Requirements
- `.planning/REQUIREMENTS.md` §PROT-01–02 — acceptance criteria for both requirements
- Research summary: `.planning/research/SUMMARY.md` §PROT track — confirmed findings on AppImage desktop entry gap and cold-start NXM bug

### Reference Implementation
- NexusMods.App Linux protocol handler (cited in nxm.ts comments):
  - `https://github.com/Nexus-Mods/NexusMods.App/blob/main/src/NexusMods.Backend/OS/LinuxInterop.Protocol.cs`
  - Wrapper script approach, xdg-utils workaround for non-mainstream DEs

### Tests
- `src/renderer/src/__tests__/desktopFileEscaping.test.ts` — existing test pattern for linux protocol registration utilities; follow this for any new tests

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ensureDevDesktopEntry()` in `nxm.ts` — template for `ensureAppImageDesktopEntry()`; same wrapper script, same desktop file structure, same `writeFileIfChanged()` calls
- `generateWrapperScript(executablePath, appPath)` in `nxm.ts` — reuse for AppImage wrapper; `executablePath` = `process.env.APPIMAGE`, `appPath` = not needed (AppImage is self-contained, no separate `appPath`)
- `writeFileIfChanged()` in `nxm.ts` — idempotent file write; already handles ENOENT
- `applicationsDirectory()` in `common.ts` — returns `$XDG_DATA_HOME/applications` or `~/.local/share/applications`
- `refreshDesktopDatabase(applicationsDir)` in `common.ts` — wraps `update-desktop-database`; extend with `kbuildsycoca6` call
- `warnIfApplicationsPathNeedsEscaping()` in `nxm.ts` — call this in `ensureAppImageDesktopEntry()` too

### Established Patterns
- Platform guard: `if (process.platform === 'linux') { }` — confirmed for AppImage branch too
- `process.env.APPIMAGE` — set by AppImage runtime, contains absolute path to the `.AppImage` file; use directly as `executablePath`
- `writeFileIfChanged()` idempotent writes — zero cost when file unchanged
- Private field naming with `m` prefix — `mPendingDownload` matches existing `mMainWindow`, `mTray` etc.

### Integration Points
- `registerLinuxNxmProtocolHandler()` in `nxm.ts`: add `PACKAGE_DESKTOP_ID` branch alongside existing `DEV_DESKTOP_ID` branch
- `refreshDesktopDatabase()` in `common.ts`: call `kbuildsycoca6` after `update-desktop-database`
- `regularStartInner()` in `Application.ts`: buffer + apply `mPendingDownload` after `await this.startUi()`

</code_context>

<specifics>
## Specific Ideas

- The wrapper script for AppImage differs from dev wrapper in one key way: `executablePath` = `process.env.APPIMAGE` (the AppImage file itself), and the `appPath` arg to `generateWrapperScript` is not needed (AppImage is self-contained). The wrapper may need to be adjusted — `generateWrapperScript(executablePath, appPath)` currently always passes `appPath` as second arg to the executable. For AppImage, the equivalent is just `exec "$APPIMAGE" --download "$@"` with no separate appPath.
- `kbuildsycoca6` is available on all KDE systems (KDE Frameworks package). ENOENT means not KDE — log debug, not warn.

</specifics>

<deferred>
## Deferred Ideas

- PROT-02 SteamOS Steam Browser NXM behavior — requires Steam Deck hardware; deferred to v3.0 per REQUIREMENTS.md PROT-03
- DIST-05: AppImage delta auto-update on SteamOS immutable filesystem — deferred to v3.0
- Generic protocol registration for tools/plugins beyond nxm:// — noted in `linux/index.ts` comments; future work

</deferred>

---

*Phase: 08-nxm-protocol-handler*
*Context gathered: 2026-04-01*
