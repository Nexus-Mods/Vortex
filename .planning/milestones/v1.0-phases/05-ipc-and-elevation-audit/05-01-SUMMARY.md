---
phase: 05-ipc-and-elevation-audit
plan: "01"
subsystem: ipc
tags: [ipc, linux, unix-socket, named-pipe, platform-guard]
dependency_graph:
  requires: []
  provides: [getIPCPath-utility, ipc-platform-correct]
  affects: [elevated.ts, fs.ts, ExtensionManager.ts, symlink_activator_elevate]
tech_stack:
  added: []
  patterns: [platform-guard, serialized-closure-injection]
key_files:
  created:
    - src/renderer/src/util/ipc.ts
    - src/renderer/src/util/ipc.test.ts
  modified:
    - src/renderer/src/util/elevated.ts
    - src/renderer/src/util/fs.ts
    - src/renderer/src/ExtensionManager.ts
    - src/renderer/src/extensions/symlink_activator_elevate/index.ts
decisions:
  - "Static import + vi.spyOn used instead of dynamic import() to satisfy node16 moduleResolution"
  - "baseFunc serialized closure in symlink_activator_elevate also patched (same pattern as elevatedMain)"
metrics:
  duration: "~10 minutes"
  completed: "2026-03-31"
  tasks: 2
  files: 6
---

# Phase 05 Plan 01: IPC Path Platform Utility Summary

**One-liner:** `getIPCPath(id)` utility routes IPC to Unix domain sockets on Linux and named pipes on Windows; all four IPC sites patched.

## What Was Built

Created `src/renderer/src/util/ipc.ts` with a single `getIPCPath(id: string): string` export. On Linux it returns `/tmp/vortex-{id}.sock`; on Windows it returns `\\?\pipe\{id}`. Patched all four IPC server/client sites that previously hardcoded the Windows UNC pipe prefix.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create getIPCPath utility with TDD test | e85f736a0 | ipc.ts, ipc.test.ts |
| 2 | Patch all IPC path sites to use getIPCPath | c7c4fb2a0 | elevated.ts, fs.ts, ExtensionManager.ts, symlink_activator_elevate/index.ts |

## Verification

- `pnpm -F @vortex/renderer vitest run src/util/ipc.test.ts` — 3 tests pass (Linux, Windows, slash-id)
- `pnpm run build` — TypeScript typecheck + webpack bundle succeeds
- `grep '\\?\pipe'` in all patched files — zero matches (all replaced with `getIPCPath()`)
- `getIPCPath` appears in 6 files (definition + test + 4 call sites)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Dynamic import incompatible with node16 moduleResolution**
- **Found during:** Task 2 (build verification)
- **Issue:** Plan specified `await import("./ipc")` in test file; `node16` moduleResolution requires explicit `.js` extensions on relative imports, causing TS2835 errors
- **Fix:** Rewrote tests to use static `import { getIPCPath } from "./ipc.js"` + `vi.spyOn(process, "platform", "get")` — functionally equivalent but compliant with TS moduleResolution
- **Files modified:** `src/renderer/src/util/ipc.test.ts`
- **Commit:** c7c4fb2a0 (included in Task 2 commit)

**2. [Rule 2 - Missing] baseFunc serialized closure in symlink_activator_elevate also had hardcoded pipe path**
- **Found during:** Task 2 verification grep
- **Issue:** Plan documented three `.listen()` sites and the `elevatedMain` child closure in `elevated.ts`. However `symlink_activator_elevate/index.ts` also contains `baseFunc()` — a copy of `elevatedMain` — with the same `client.connect(imp.path.join("\\\\?\\pipe", ipcPath))` pattern, plus a `makeScript()` injection site at line 764 that baked in the raw `IPC_ID` constant
- **Fix:** Patched both the `client.connect()` in `baseFunc` (child uses pre-resolved path) and the `makeScript()` injection to use `getIPCPath(IPC_ID)` (parent resolves the path before serializing)
- **Files modified:** `src/renderer/src/extensions/symlink_activator_elevate/index.ts`
- **Commit:** c7c4fb2a0

## Known Stubs

None — all IPC path sites are fully wired with platform-correct paths.

## Self-Check: PASSED
