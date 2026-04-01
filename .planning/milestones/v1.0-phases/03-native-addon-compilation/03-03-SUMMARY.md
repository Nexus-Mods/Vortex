---
phase: 03-native-addon-compilation
plan: 03
subsystem: infra
tags: [loot, rpath, ld_library_path, native-addons, ci, github-actions, integration, linux]

# Dependency graph
requires:
  - phase: 03-native-addon-compilation
    provides: "postinstall-libloot.cjs + libloot.so build (plan 03-01)"
  - phase: 03-native-addon-compilation
    provides: "@electron/rebuild CI step + verify-addons.cjs smoke test (plan 03-02)"

provides:
  - "Complete validated CI pipeline: libloot build -> electron-rebuild -> verify-addons -> build"
  - "loot.node RPATH/LD_LIBRARY_PATH issue resolved — liblibloot.so resolves at runtime"
  - "CI step ordering corrected: Rust -> cmake -> pnpm install -> rebuild -> verify -> build"
  - "verify-addons.cjs extended with in-process LD_LIBRARY_PATH fallback for non-CI environments"
  - "Both ubuntu-latest and windows-latest CI matrix legs green — all NADD requirements verified"

affects:
  - 04-fomod-linux-binary
  - 05-ipc-elevation-audit

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "LD_LIBRARY_PATH in-process fallback before require() for addons with unresolved .so paths"
    - "CI verify step wraps command with computed LOOT_API_DIR for belt-and-suspenders .so resolution"

key-files:
  created: []
  modified:
    - .github/workflows/main.yml
    - scripts/verify-addons.cjs

key-decisions:
  - "LD_LIBRARY_PATH in-process + CI wrapper chosen over patch-package RPATH — avoids modifying node_modules and patching binding.gyp; sufficient for both CI and local developer runs"
  - "CI step ordering fixed: Install Rust toolchain moved before Install Linux build dependencies to match documented integration spec (Rust -> cmake -> pnpm install -> rebuild -> verify -> build)"

patterns-established:
  - "CI verify wrappers: set LD_LIBRARY_PATH from require.resolve() so verify scripts are self-contained"

requirements-completed: [NADD-01, NADD-02, NADD-03, NADD-04, NADD-05, NADD-06]

# Metrics
duration: integration + CI verification (~10 min)
completed: 2026-03-31
---

# Phase 03 Plan 03: Native Addon Integration and CI Validation Summary

**loot.node LD_LIBRARY_PATH fallback added and CI step ordering corrected; ubuntu-latest and windows-latest both green with all 6 native addons verified end-to-end**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-31T07:41:36Z
- **Completed:** 2026-03-31 (CI approved by user)
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify)
- **Files modified:** 2

## Accomplishments

- Diagnosed and fixed loot.node RPATH issue: `liblibloot.so` was not resolving at runtime because loot's `binding.gyp` sets no RPATH. Applied LD_LIBRARY_PATH fix both in-process in `verify-addons.cjs` and as a CI step wrapper.
- Corrected CI step ordering: `Install Rust toolchain` was positioned after `Install Linux build dependencies` but must come before to ensure `cargo` is on PATH when cmake builds libloot (cmake invokes cargo for the Rust FFI layer). Fixed to: Rust -> cmake -> pnpm install -> rebuild -> verify -> build.
- Both `ubuntu-latest` and `windows-latest` GitHub Actions matrix legs passed CI — all NADD-01 through NADD-06 requirements confirmed green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix loot RPATH and validate all addons load locally** - `a4041eb88` (fix)
2. **Task 2: Verify CI passes on both Linux and Windows** - human-approved checkpoint (no code commit — CI validation)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified

- `.github/workflows/main.yml` — Reordered CI steps (Rust before cmake); added `LOOT_API_DIR` computed LD_LIBRARY_PATH wrapper to "Verify native addons load" step
- `scripts/verify-addons.cjs` — Added in-process LD_LIBRARY_PATH fallback block (Linux-only) before addon require loop, using `require.resolve('loot/package.json')` to locate `loot_api/`

## Decisions Made

- **LD_LIBRARY_PATH over RPATH/patch-package:** The plan offered two options. Option 1 (LD_LIBRARY_PATH in-process + CI wrapper) was chosen because it requires no `pnpm add patch-package`, no binding.gyp edits in `node_modules`, and no `patchedDependencies` wiring. Both the in-process env set (for local developer runs) and the CI shell wrapper (belt-and-suspenders) are applied. This avoids any Windows side-effects and keeps the fix reversible.
- **Step ordering correction:** The documented integration spec required Rust -> cmake -> pnpm install. The existing CI had cmake before Rust (from independent plan commits). Fixed in this integration plan as designed.

## Deviations from Plan

None — plan executed exactly as written. Both the LD_LIBRARY_PATH approach and the CI step ordering audit were explicitly specified in Task 1.

## Issues Encountered

None. The LD_LIBRARY_PATH fix worked on first attempt. CI passed on first run for both matrix legs.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 6 native addons (bsatk, esptk, bsdiff-node, vortexmt, xxhash-addon, loot) compile and load on Linux in CI
- Phase 3 (Native Addon Compilation) is complete — all NADD-01 through NADD-06 requirements satisfied
- Phase 4 (FOMOD Installer Integration) can now proceed: depends on Phase 2 (complete) and Phase 3 (now complete)
- Phase 5 (IPC and Elevation Audit) can also proceed: depends on Phase 2 only

---
*Phase: 03-native-addon-compilation*
*Completed: 2026-03-31*

## Self-Check: PASSED

- `.github/workflows/main.yml` exists and was modified in commit `a4041eb88`
- `scripts/verify-addons.cjs` exists and was modified in commit `a4041eb88`
- Task 1 commit `a4041eb88` confirmed in git log
- Task 2 is a human-verify checkpoint — approved by user ("approved"), no code commit
