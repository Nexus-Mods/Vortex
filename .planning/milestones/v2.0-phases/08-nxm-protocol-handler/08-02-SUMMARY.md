---
phase: 08-nxm-protocol-handler
plan: "02"
subsystem: main-process
tags: [nxm, cold-start, protocol-handler, prot-01]
dependency_graph:
  requires: []
  provides: [mPendingDownload cold-start buffer in Application.ts]
  affects: [src/main/src/Application.ts]
tech_stack:
  added: []
  patterns: [m-prefix private field, buffer-then-apply after startUi]
key_files:
  created: []
  modified:
    - src/main/src/Application.ts
decisions:
  - "Buffer args.download in mPendingDownload before startup; apply after startUi() resolves -- guarantees renderer external-url listener is registered before URL is dispatched"
  - "Use .catch() on applyArguments call to prevent startup crash if pending download fails"
  - "Pass { download: pendingUrl } as IParameters cast -- applyArguments checks each field independently; full args object not needed"
metrics:
  duration: "5m"
  completed: "2026-04-01"
  tasks_completed: 1
  files_modified: 1
requirements_satisfied: [PROT-01]
---

# Phase 08 Plan 02: Cold-start NXM URL Buffer Summary

Cold-start NXM URL buffered in Application.ts mPendingDownload field and applied after startUi() resolves.

## What Was Built

When Vortex is launched via an NXM link from a closed state, `args.download` is passed on the command line but the renderer is not yet ready to receive the `external-url` IPC message. Previously, `applyArguments()` was only called on the second-instance path — the cold-start path silently dropped the URL.

This plan adds a three-step buffer pattern:
1. **Capture** `args.download` in `mPendingDownload` at the top of `regularStartInner` (before startup begins)
2. **Wait** for `await this.startUi()` to resolve (renderer sends `show-window` → main window resolves → `external-url` listener is guaranteed registered)
3. **Apply** the buffered URL via `applyArguments({ download: pendingUrl })` with a `.catch()` guard

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add mPendingDownload field and cold-start buffer/apply in regularStartInner | 7f03d991f | src/main/src/Application.ts |

## Acceptance Criteria Met

- `private mPendingDownload: string | undefined;` field added after `mDeinitCrashDump`
- `this.mPendingDownload = args.download;` assigned before `this.testUserEnvironment()` in `regularStartInner`
- `if (this.mPendingDownload !== undefined)` block inserted after `await this.startUi()` and before tray icon setup
- Pending download block calls `this.applyArguments({ download: pendingUrl } as IParameters)`
- Pending download block has `.catch((err: unknown) => log("warn", "failed to apply pending download", err))`
- Pending download block sets `this.mPendingDownload = undefined` before calling applyArguments (state cleared)
- `second-instance` handler at line ~250 is unchanged
- `applyArguments` method at line ~1130 is unchanged
- All 61 main process tests pass

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- File exists: src/main/src/Application.ts (modified, not created)
- Commit 7f03d991f verified in git log
- All 5 mPendingDownload references present (field, assignment, check, clear, apply)
- Ordering verified: buffer at line 435, startUi at line 500, apply at line 503, tray at line 511
