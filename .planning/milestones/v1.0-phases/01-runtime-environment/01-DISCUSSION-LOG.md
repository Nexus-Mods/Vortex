# Phase 1: Runtime Environment - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 01-runtime-environment
**Areas discussed:** RENV-03 cleanup scope

---

## RENV-03: electron-builder Cleanup Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Strict: 2 .exe files only | Move only VC_redist.x64.exe and windowsdesktop-runtime-win-x64.exe to win.extraResources. Minimal diff, directly satisfies RENV-03. | ✓ |
| Also move nsis/**/* to win | Also move ./nsis/**/* to win.extraResources — it's Windows-only and would fail if nsis/ doesn't exist on Linux. | |
| Full cleanup | Move all Windows-only entries (extraResources + asarUnpack FOMD .dll/.exe patterns) to win blocks. | |

**User's choice:** Strict — 2 .exe files only
**Notes:** FOMD/NSIS entries belong to Phase 4 scope; keep Phase 1 diff minimal.

---

## Areas Not Discussed (skipped by user)

**RENV-01: devcontainer vs CI runner** — Not discussed; implementation is mechanical (append libs to Dockerfile).

**RENV-02: localAppData semantics** — Not discussed; requirement specifies exact return value (`$XDG_DATA_HOME || ~/.local/share`).

---

## Claude's Discretion

- Placement of libs in Dockerfile (append to existing apt-get block)
- Use of `os.homedir()` vs `app.getPath('home')` for XDG fallback
- Import style for `os` module in getVortexPath.ts
- Merge strategy for `win.extraResources` in electron-builder.config.json

## Deferred Ideas

None.
