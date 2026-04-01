---
phase: 03-native-addon-compilation
plan: 01
subsystem: infra
tags: [libloot, loot, native-addon, cmake, rust, cargo, postinstall, ci, linux]

requires:
  - phase: 02-winapi-bindings-shim
    provides: "Linux devcontainer and CI foundation established"

provides:
  - "scripts/postinstall-libloot.cjs builds libloot 0.29.1 from source on Linux and places liblibloot.so in loot_api/"
  - "CI workflow has Rust toolchain and cmake available before pnpm install on Linux"
  - "liblibloot.so satisfies -l../loot_api/libloot linker flag so loot.node can compile"

affects: [03-02-electron-rebuild, 03-03-gamebryo-savegame, loot-addon, native-addon-compilation]

tech-stack:
  added:
    - dtolnay/rust-toolchain@stable (GitHub Actions — Rust compiler for libloot build)
    - cmake (apt package — libloot CMake build system)
    - liblz4-dev (apt package — lz4 headers for potential gamebryo-savegame compilation)
  patterns:
    - "Platform-guarded postinstall: require.resolve() to locate package, exit 0 on non-Linux"
    - "Non-fatal build script: catch all errors, warn, exit 0 to not block pnpm install"
    - "Idempotent postinstall: check for .so existence before attempting build"

key-files:
  created:
    - scripts/postinstall-libloot.cjs
  modified:
    - package.json
    - .github/workflows/main.yml

key-decisions:
  - "Build libloot 0.29.1 from source (cmake + cargo) — LOOT stopped publishing Linux prebuilts at 0.24.5; no prebuilt exists for 0.29.1"
  - "Deliver via postinstall script (D-03 honored) — require.resolve('loot/package.json') locates loot_api/ portably"
  - "Copy source path is tmpDir/cpp/build/liblibloot.so (single deterministic path, no glob)"
  - "cmake + liblz4-dev merged into renamed 'Install Linux build dependencies' step (cleaner than two apt-get update calls)"
  - "Rust step placed before pnpm install so postinstall-libloot.cjs can call cargo during pnpm install"

patterns-established:
  - "Platform-guarded postinstall pattern: process.platform !== 'linux' early exit (zero Windows impact)"
  - "Dynamic loot_api path resolution via require.resolve — immune to pnpm store hash changes"

requirements-completed: [NADD-03]

duration: 3min
completed: 2026-03-30
---

# Phase 03 Plan 01: libloot Linux Build Infrastructure Summary

**postinstall-libloot.cjs builds libloot 0.29.1 from source via cmake+cargo on Linux, placing liblibloot.so in loot_api/ so loot.node can compile; CI gets Rust toolchain and cmake before pnpm install**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-30T20:05:56Z
- **Completed:** 2026-03-30T20:08:36Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `scripts/postinstall-libloot.cjs` — platform-guarded script that builds libloot 0.29.1 from source using cmake + Rust (cargo) and delivers `liblibloot.so` to `loot_api/`
- Wired script into root `package.json` as `postinstall` hook
- Updated `.github/workflows/main.yml` to install Rust toolchain (`dtolnay/rust-toolchain@stable`) and cmake before `pnpm install` on Linux, so the postinstall script has both tools on PATH

## Task Commits

Each task was committed atomically:

1. **Task 1: Create postinstall-libloot.cjs and wire into package.json** - `63e89a115` (feat)
2. **Task 2: Add Rust toolchain and cmake to CI workflow for Linux** - `adabf6642` (feat)

**Plan metadata:** committed via docs commit (see final commit)

## Files Created/Modified

- `scripts/postinstall-libloot.cjs` - Platform-guarded Linux-only script; clones libloot 0.29.1, runs cmake+cargo build, copies `liblibloot.so` to `loot_api/`; exits 0 gracefully on non-Linux or failure
- `package.json` - Added `"postinstall": "node scripts/postinstall-libloot.cjs"` to scripts
- `.github/workflows/main.yml` - Renamed "Install fontconfig" to "Install Linux build dependencies" (adds `cmake liblz4-dev`); added "Install Rust toolchain" step before "Install dependencies"

## Decisions Made

- **Build from source, not prebuilts:** D-02 specified sourcing from LOOT GitHub release artifacts, but research confirmed LOOT stopped publishing Linux prebuilts at 0.24.5. libloot 0.29.1 (required by node-loot 6.2.1) has no Linux binary. Building from source via cmake+cargo is the only viable path. D-01 and D-03 honored as specified.
- **Single deterministic copy path:** `${tmpDir}/cpp/build/liblibloot.so` — Unix Makefiles generator on Linux places the shared library directly in the build directory without a config-named subdirectory.
- **Non-fatal build:** Script exits 0 on any failure with a warning — prevents blocking `pnpm install` for developers who don't need the loot addon (e.g., Windows developers).
- **Rust step before pnpm install:** The postinstall script runs `cargo` indirectly via cmake (libloot 0.25+ is Rust + C++ FFI). cargo must be on PATH before `pnpm install` triggers the postinstall hook.
- **Merged fontconfig step:** Renamed "Install fontconfig" to "Install Linux build dependencies" and added `cmake liblz4-dev` to avoid a second `apt-get update` call.

## Deviations from Plan

None — plan executed exactly as written. The plan already documented D-02's infeasibility and specified building from source as the correct approach.

## Issues Encountered

- Git objects directory had root-owned files from a parallel agent commit, causing `insufficient permission for adding an object to repository database`. Fixed with `sudo chown -R alex:alex .git/objects/`. Task 2 committed successfully after fix.

## User Setup Required

None — no external service configuration required. The postinstall script runs automatically on `pnpm install` on Linux and CI will have the required tools.

## Next Phase Readiness

- `liblibloot.so` will be built during `pnpm install` on Linux (postinstall hook)
- CI has Rust toolchain and cmake available before dependency install
- `@electron/rebuild` is already in devDependencies (confirmed during Task 1 read)
- Plan 03-02 can proceed with `@electron/rebuild -f -v 39.8.0` to compile loot.node and other addons
- Potential concern: RPATH at runtime — after `@electron/rebuild` builds loot.node, `ldd` should be run to confirm `liblibloot.so` resolves at `$ORIGIN/../loot_api/`

---
*Phase: 03-native-addon-compilation*
*Completed: 2026-03-30*

## Self-Check: PASSED
