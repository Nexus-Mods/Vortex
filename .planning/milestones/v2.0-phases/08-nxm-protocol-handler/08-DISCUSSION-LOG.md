# Phase 8: NXM Protocol Handler - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 08-nxm-protocol-handler
**Areas discussed:** AppImage desktop entry, Cold-start NXM buffer

---

## AppImage Desktop Entry

| Option | Description | Selected |
|--------|-------------|----------|
| Wrapper script | Same pattern as dev build — write .sh wrapper + .desktop file to ~/.local/share/applications/; unsets LD_LIBRARY_PATH/LD_PRELOAD, xdg-utils non-mainstream DE workaround | ✓ |
| Direct $APPIMAGE path | Exec=$APPIMAGE --download %u directly; simpler but loses LD_LIBRARY_PATH protection | |

**User's choice:** Wrapper script (same pattern as dev build)

---

| Option | Description | Selected |
|--------|-------------|----------|
| On every startup | Write idempotently via writeFileIfChanged(); zero I/O cost when unchanged; stays current after AppImage updates | ✓ |
| Only when registering as default | Write only when setAsDefault=true; risk: path goes stale if AppImage is moved and setting isn't re-toggled | |

**User's choice:** On every startup

---

| Option | Description | Selected |
|--------|-------------|----------|
| "Vortex" | Name=Vortex, NoDisplay=true — protocol handler, not launcher | ✓ |
| "Vortex Mod Manager" | More descriptive; still NoDisplay=true | |

**User's choice:** "Vortex" — matches dev build pattern, stays consistent

---

## Cold-Start NXM Buffer

| Option | Description | Selected |
|--------|-------------|----------|
| After sendReady IPC | Apply pendingDownload after renderer sends its ready signal (show-window IPC, which fires after external-url listener is registered) | ✓ |
| After mainWindow.create() resolves | Apply after BrowserWindow created; renderer may not have registered download handler yet | |
| After fixed 1s delay | Shorter blind wait; still unreliable on slow machines | |

**User's choice:** After sendReady IPC — maps to existing show-window IPC (no new signal needed)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Log and drop silently | On startup failure, log warn and discard URL; startup error is already its own path | ✓ |
| Show error dialog | Explicit but fires on top of whatever caused startup to fail | |

**User's choice:** Log and drop silently

---

## Claude's Discretion

- Whether to add unit tests for `ensureAppImageDesktopEntry()`
- Exact wrapper script content for AppImage (vs dev build — no separate `appPath`)
- Whether `mPendingDownload` should be a method or private field

## Deferred Ideas

- SteamOS Steam Browser NXM behavior — hardware unavailable; deferred to v3.0 (PROT-03)
- Generic tool/plugin protocol registration beyond nxm://
