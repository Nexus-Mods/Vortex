# Elevation Audit — Phase 1 Scope

## Summary

`runElevated()` is **NOT** called on any startup code path. pkexec is **NOT** needed for Phase 1.

All elevation call sites are user-triggered mod deployment operations. The six confirmed call sites
are in three renderer-side files (`util/fs.ts`, `ExtensionManager.ts`,
`symlink_activator_elevate/index.ts`) and are only reached when a user explicitly initiates
elevated mod deployment or an elevated custom tool. None of those files are imported or executed
during the Electron/React bootstrap sequence.

## runElevated Call Sites

| # | File | Line | Context | Trigger |
|---|------|------|---------|---------|
| 1 | `src/renderer/src/util/fs.ts` | 1078 | `elevated()` helper — wraps file copy/move ops in an elevated Node sub-process | User-triggered (mod deployment file operations) |
| 2 | `src/renderer/src/ExtensionManager.ts` | 2659 | `runElevated()` called from private `runElevated()` method via `startIPC()` | User-triggered (elevated custom tools launched by user action) |
| 3 | `src/renderer/src/extensions/symlink_activator_elevate/index.ts` | 566 | Symlink deployment — starts elevated remote process for symlink creation | User-triggered (mod deployment — user initiates deployment) |
| 4 | `src/renderer/src/extensions/symlink_activator_elevate/index.ts` | 806 | `CreateTask` via elevated process — sets up Windows Task Scheduler for symlinks | User-triggered (mod deployment — one-time setup step) |
| 5 | `src/renderer/src/extensions/symlink_activator_elevate/index.ts` | 930 | `DeleteTask` via elevated process — removes the scheduled task | User-triggered (mod deployment — cleanup step) |
| 6 | `src/renderer/src/extensions/symlink_activator_elevate/index.ts` | 1057 | Privilege adjustment (`SeCreateSymbolicLinkPrivilege`) via elevated process | User-triggered (mod deployment — privilege toggle) |

## Startup Path Analysis

The following startup entry points were inspected for direct and transitive calls to `runElevated()`:

- **`src/main/src/main.ts`** — Electron main process bootstrap. Does **not** import or call `runElevated`.
- **`src/main/src/Application.ts`** — Application lifecycle (window creation, persistence init, auto-updater). Does **not** import or call `runElevated`.
- **`src/renderer/src/renderer.tsx`** — React renderer bootstrap (Redux store creation, extension manager init, initial render). Does **not** import or call `runElevated`.

`runElevated` is imported in exactly three renderer-side files:

1. `src/renderer/src/util/fs.ts` — only reached when user triggers an elevated file operation
2. `src/renderer/src/ExtensionManager.ts` — only reached when user launches an elevated custom tool
3. `src/renderer/src/extensions/symlink_activator_elevate/index.ts` — only reached when user activates symlink-based mod deployment

None of those import sites are executed during startup initialization. The extension manager loads
extensions lazily, and `symlink_activator_elevate` is not invoked until the user explicitly
triggers deployment.

## Phase 1 Elevation Decision

pkexec is **NOT** required for Phase 1.

The `winapi.ShellExecuteEx` shim from Phase 2 (WAPI-04) already throws a clear error on Linux when
elevation is attempted. Since `runElevated()` is never called during startup, this throw is
acceptable — it only fires if a user explicitly triggers an elevated operation (mod deployment).

On Linux, the `runElevated()` path will throw at the `winapi.ShellExecuteEx` call site inside
`src/renderer/src/util/elevated.ts`. This produces a user-visible error rather than a silent crash,
which is the correct Phase 1 behavior: Linux users cannot yet use elevated deployment, but the app
continues to run. The "boots on Linux" core value is preserved.

## Future Work (v2)

Full pkexec + polkit integration is deferred to v2. Two requirements track this work:

- **ELEV-01** — Replace Windows named-pipe IPC in `elevatedMain` with Unix domain sockets on Linux
- **ELEV-02** — Replace `winapi.ShellExecuteEx({ verb: "runas" })` with `pkexec node <tmpFile>` on Linux

These changes will be needed when Linux users attempt symlink-based mod deployment. Until then, the
Phase 2 shim's throw provides a clear failure message rather than a cryptic crash.

## Methodology

Audit performed by `grep` search for `runElevated` across `src/renderer/src/` and manual inspection
of each call site's execution context. Startup entry points (`main.ts`, `Application.ts`,
`renderer.tsx`) inspected for direct imports and transitive calls — none found.

---

*Audit date: 2026-03-31*
*Phase: 05-ipc-and-elevation-audit*
