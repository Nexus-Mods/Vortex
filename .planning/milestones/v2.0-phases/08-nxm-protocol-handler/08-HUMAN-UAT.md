---
status: partial
phase: 08-nxm-protocol-handler
source: [08-VERIFICATION.md]
started: 2026-04-01T12:44:00Z
updated: 2026-04-01T12:44:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. End-to-End NXM Link with Running Vortex
expected: On standard Linux (GNOME or KDE Plasma), launch Vortex, click "Download with Manager" on any Nexus Mods mod page — Vortex receives focus and a download begins immediately
result: [pending]

### 2. Cold-Start NXM URL (Vortex Closed)
expected: Ensure Vortex is fully closed, click "Download with Manager" — Vortex launches, Redux store initializes, and download begins without silently dropping the NXM URL
result: [pending]

### 3. AppImage Desktop Entry File Write
expected: Run from AppImage, enable "Handle Nexus Links" in Settings — `~/.local/share/applications/com.nexusmods.vortex.desktop` and `com.nexusmods.vortex.sh` are written; `xdg-settings get default-url-scheme-handler nxm` returns `com.nexusmods.vortex.desktop`
result: [pending]

### 4. KDE Plasma Cache Refresh
expected: On KDE Plasma, trigger NXM handler registration — `kbuildsycoca6 --noincremental` runs without error; clicking an NXM link opens Vortex
result: [pending]

### 5. SteamOS / Steam Browser (Deferred to v3.0)
expected: If Steam Deck hardware available — NXM confirmed working in Desktop Mode; if unavailable — documented as deferred per PROT-03
result: [pending — hardware unavailable; deferred to v3.0 per PROT-03]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
