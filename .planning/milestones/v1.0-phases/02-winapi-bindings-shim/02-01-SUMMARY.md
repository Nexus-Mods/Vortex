---
phase: 02-winapi-bindings-shim
plan: 01
subsystem: infra
tags: [winapi-bindings, linux, shim, native-modules, electron, fs, statfsSync]

# Dependency graph
requires: []
provides:
  - winapi-shim.ts: Linux shim replacing winapi-bindings native module with 48 exported functions
  - GetDiskFreeSpaceEx using fs.statfsSync for real POSIX disk stats
  - GetVolumePathName walking stat.dev boundaries with ENOENT fallback to path.parse().root
  - ShellExecuteEx throwing stub with descriptive Linux message (callers already catch)
  - No-op/safe-return stubs for all registry, ACL, task scheduler, process, and privilege APIs
  - Default export aggregating all named exports (supports both import styles)
  - Vitest test suite: 19 tests covering WAPI-02 through WAPI-05
affects: [webpack-alias-phase, 02-02-webpack-alias]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Linux shim pattern: functional stubs via Node.js built-ins, throwing stubs for Windows-only ops, no-op stubs for safe operations"
    - "unsupported() helper: DRY never-returning helper for throwing stubs"
    - "WalkDir variadic: ...args pattern to handle both 3-arg and 4-arg overloads"

key-files:
  created:
    - src/renderer/src/util/winapi-shim.ts
    - src/renderer/src/util/winapi-shim.test.ts
  modified: []

key-decisions:
  - "Test file placed at src/renderer/src/util/winapi-shim.test.ts (not __tests__/) because renderer vitest.config.mts excludes src/**/__tests__/* and includes src/**/*.test.{ts,tsx}"
  - "RegGetValue returns undefined (not object) diverging from Jest mock — production shim is correct; mock is for renderer unit tests only"
  - "WithRegOpen does NOT call the callback — prevents registry-dependent code paths from executing on Linux"

patterns-established:
  - "Linux shim: functional category (statfsSync/statSync) + throwing category (unsupported()) + no-op/safe-return category"
  - "Default export mirrors all named exports for dual import compatibility"

requirements-completed: [WAPI-02, WAPI-03, WAPI-04, WAPI-05]

# Metrics
duration: 3min
completed: 2026-03-30
---

# Phase 2 Plan 1: winapi-bindings Linux Shim Summary

**winapi-bindings Linux shim with 48 exports — statfsSync/statSync for disk ops, throwing stub for ShellExecuteEx, no-ops for all registry/ACL/privilege APIs, dual import support, 19 tests passing**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-30T11:46:42Z
- **Completed:** 2026-03-30T11:49:33Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Created `winapi-shim.ts` with 48 exported functions covering the full `winapi-bindings` index.d.ts API surface
- Implemented `GetDiskFreeSpaceEx` via `fs.statfsSync` returning real POSIX block device stats
- Implemented `GetVolumePathName` walking `stat.dev` device boundaries with ENOENT fallback to `path.parse().root` (always "/" on Linux)
- Implemented `GetNativeArch` returning `process.arch`
- `ShellExecuteEx` throws with "not supported on Linux" message (callers in elevated.ts already catch)
- All registry, ACL, task scheduler, process list, and privilege functions are safe no-ops or return empty arrays/false
- Both named-export and default-export import styles work correctly
- 19 Vitest tests all passing

## Task Commits

1. **Task 1: Write tests and implement winapi-shim.ts** - `d12b97afd` (feat)

## Files Created/Modified
- `src/renderer/src/util/winapi-shim.ts` - Linux shim replacing winapi-bindings native module (48 exports, default export)
- `src/renderer/src/util/winapi-shim.test.ts` - Vitest test suite covering WAPI-02 through WAPI-05 (19 tests)

## Decisions Made
- Test file at `src/renderer/src/util/winapi-shim.test.ts` (not `__tests__/`): renderer vitest config `include: src/**/*.test.{ts,tsx}` and `exclude: src/**/__tests__/*` makes `__tests__/` invisible to the test runner. File moved to match the include pattern.
- `RegGetValue` returns `undefined` (production shim) vs object (Jest mock): the existing Jest mock is for renderer unit tests that expect a registry object; the production shim returns `undefined` because callers already handle both patterns and the mock is NOT modified.
- `WithRegOpen` does NOT call the callback: prevents registry-dependent code paths from ever executing on Linux.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test file location: __tests__/ excluded by renderer vitest.config.mts**
- **Found during:** Task 1 (RED phase — running tests returned "No test files found")
- **Issue:** Plan specified `src/renderer/src/util/__tests__/winapi-shim.test.ts` but `src/renderer/vitest.config.mts` has `exclude: ["node_modules", "src/**/__tests__/*"]` which silently drops all `__tests__/` files from the test run
- **Fix:** Moved test file to `src/renderer/src/util/winapi-shim.test.ts` which matches `include: ["src/**/*.test.{ts,tsx}"]`
- **Files modified:** Only the test file path changed; content identical
- **Verification:** `npx vitest run src/renderer/src/util/winapi-shim.test.ts` ran and all 19 tests passed
- **Committed in:** d12b97afd (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking)
**Impact on plan:** Minor path adjustment; no content changes. All plan requirements met.

## Issues Encountered
None beyond the test file path deviation above.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- `winapi-shim.ts` is ready to be aliased into webpack builds
- Phase 02-02 will add the webpack alias so `import winapi from "winapi-bindings"` resolves to this shim on Linux
- No blockers for next plan

---
*Phase: 02-winapi-bindings-shim*
*Completed: 2026-03-30*
