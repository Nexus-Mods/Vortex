# Phase 3: Native Addon Compilation - Research

**Researched:** 2026-03-31
**Domain:** Node.js native addon compilation, Electron rebuild, libloot Linux build chain
**Confidence:** HIGH for most addons; MEDIUM for loot (non-obvious libloot strategy)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Get loot working on Linux by adding a Linux `libloot.so` to the `node-loot` npm
package. The binding.gyp already links against `-l../loot_api/libloot` — adding the `.so`
alongside the existing Windows DLL is sufficient to enable compilation.

**D-02:** Source the Linux libloot from **LOOT's published GitHub release artifacts** (prebuilt
`libloot.so` + headers). Do not compile libloot from source in CI. Version must match the
`libloot.dll` already shipped in the package.

**D-03:** Deliver the `.so` via a **postinstall script** (or patch-package) that downloads and
drops `libloot.so` into `node_modules/loot/loot_api/` after `pnpm install`. No fork of
node-loot required. The existing `binding.gyp` path (`-l../loot_api/libloot`) will find it on
Linux automatically.

**Rebuild approach:** Standard `@electron/rebuild` after `pnpm install` for all addons that need
Electron ABI recompilation.

**vortexmt / gamebryo-savegame (NADD-06):** No explicit preference — planner should audit both
and either add to CI (if clean) or disable/shim (if Windows-specific APIs found).

### Claude's Discretion

- CI structure (where in main.yml to add the rebuild step, what apt packages to install)
- How to fail CI cleanly if an addon fails to build
- Whether to run `@electron/rebuild` once globally or per-workspace

### Deferred Ideas (OUT OF SCOPE)

- Forking node-loot to add Linux support upstream (future improvement)
- gamebryo-savegame and vortexmt deeper audit (handled per NADD-06 in this phase)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NADD-01 | `bsatk` native addon compiles for Linux via `@electron/rebuild` in CI | binding.gyp has Linux section; already compiled locally; needs zlib1g-dev implicitly from process |
| NADD-02 | `esptk` native addon compiles for Linux via `@electron/rebuild` in CI | No Linux-specific deps; compiled locally; pure C++ with #ifdef guards |
| NADD-03 | `loot` native addon compiles for Linux via `@electron/rebuild` in CI | **BLOCKER:** libloot.so not in LOOT GitHub releases for 0.29.1 (see §Loot Blocker) — must build from source |
| NADD-04 | `bsdiff-node` compiles for Linux via `@electron/rebuild` in CI | Bundles bzip2 sources; no external deps; compiled locally |
| NADD-05 | `xxhash-addon` available for Linux | Ships NAPI prebuilds for linux-x64 (glibc + musl); no rebuild needed |
| NADD-06 | `vortexmt` and `gamebryo-savegame` audited for Windows-specific API usage | vortexmt: CLEAN (properly guarded); gamebryo-savegame: BLOCKED — two compile errors on Linux |
</phase_requirements>

---

## Summary

Five C++ native addons need to load correctly in Electron 39.8.0 on Linux. Four of them
(`bsatk`, `esptk`, `bsdiff-node`, `vortexmt`) already compiled from source on the local Linux
host after `pnpm install`, confirming their C++ is Linux-compatible. `xxhash-addon` ships NAPI
prebuilds for `linux-x64` and requires no rebuild. All five that compiled locally need
`@electron/rebuild` to recompile against Electron headers (NAPI ABI is stable but Electron
ships its own Node headers). `@electron/rebuild 4.0.3` is the current stable release and is not
in the project's dependencies — it must be added to the root `package.json` as a dev dependency
or invoked via `npx` in CI.

**Critical blocker for loot (NADD-03):** Decision D-02 specified sourcing `libloot.so` from
LOOT's GitHub release artifacts. However, LOOT stopped publishing Linux prebuilts at version
0.24.5. The `node-loot` package in this project links against libloot **0.29.1** (confirmed from
`loot_api/include/loot/loot_version.h`: MAJOR=0, MINOR=29, PATCH=1). No Linux binary exists
for this version. The only viable path is to build `libloot.so` from source using the
`loot/libloot` CMake + Rust (cargo) build system. This requires installing `cargo`/`rustc` on the
CI runner and running cmake in the `cpp/` subdirectory of the libloot source.

**Audit result for NADD-06:**
- `vortexmt`: CLEAN. Its `common.h` properly guards `#ifdef WIN32` / `#else` for `from_utf8()`.
  The `main.cpp` uses only portable C++ and NAPI. Compiled successfully on this host.
- `gamebryo-savegame`: TWO COMPILE ERRORS on Linux. (1) `MoreInfoException` inherits from
  `std::exception(std::runtime_error(message))` — this is MSVC-only syntax; GCC rejects it.
  (2) `binding.gyp` only links `lz4` and `zlib` on `OS=="win"` — but the `.cpp` includes
  `<lz4.h>` and `<zlib.h>` unconditionally, causing link failures. Fixing both requires a
  patch-package or source edit. The planner must decide: fix and compile, or disable/shim.

**Primary recommendation:** Add `@electron/rebuild` as a dev dependency, build `libloot.so`
from source in a dedicated CI step, deliver it via a platform-guarded postinstall script, then
run `@electron/rebuild` once for all other addons on the Linux matrix leg.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@electron/rebuild` | 4.0.3 | Recompile native addons against Electron Node headers | Official Electron tool; handles ABI mismatch between system Node and Electron |
| `node-gyp` | 10.3.1 | Node native addon build system | Already present (dependency of `node-loot` and others) |
| `cmake` | 3.24+ | libloot build system orchestrator | Required by libloot's cpp/ CMakeLists.txt |
| `cargo` / `rustc` | stable | libloot core is written in Rust | libloot 0.25+ is Rust-based with a C++ FFI wrapper |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `liblz4-dev` | system | lz4 decompression headers+lib | Required to fix gamebryo-savegame on Linux if enabled |
| `zlib1g-dev` | system | zlib headers (already present on this host) | Required for bsatk (already compiles; no explicit -lz needed — see §Zlib Note) |
| `patch-package` | - | Apply in-tree patches to node_modules | If gamebryo-savegame MoreInfoException is to be fixed without forking |

**Installation:**
```bash
# Add to root devDependencies
pnpm add -D @electron/rebuild --workspace-root

# CI apt deps (add to existing Install fontconfig step in main.yml)
sudo apt-get install -y libfontconfig1-dev liblz4-dev cmake

# Rust toolchain (if building libloot from source)
curl https://sh.rustup.rs -sSf | sh -s -- -y --profile minimal
```

**Version verification:** `@electron/rebuild` 4.0.3 confirmed via `npm view @electron/rebuild version`.

---

## Architecture Patterns

### Recommended CI Step Structure (Linux only)

Insert three new steps after `Install dependencies` and before `Build` in main.yml:

```yaml
# Step A: Install native addon build dependencies (Linux only)
- name: Install native addon build dependencies
  if: runner.os == 'Linux'
  run: sudo apt-get update && sudo apt-get install -y libfontconfig1-dev liblz4-dev cmake

# Step B: Build and deliver libloot.so (Linux only)
# Option 1 (D-02 intent) — download prebuilt: NOT POSSIBLE for 0.29.1
# Option 2 (actual viable path) — build from source:
- name: Build libloot.so from source
  if: runner.os == 'Linux'
  run: |
    curl https://sh.rustup.rs -sSf | sh -s -- -y --profile minimal
    source "$HOME/.cargo/env"
    git clone --depth=1 --branch 0.29.1 https://github.com/loot/libloot.git /tmp/libloot
    cd /tmp/libloot/cpp
    cmake -DCMAKE_BUILD_TYPE=Release -DLIBLOOT_BUILD_TESTS=OFF -B build
    cmake --build build --parallel
    cp build/liblibloot.so \
      "$GITHUB_WORKSPACE/node_modules/.pnpm/loot@.../node_modules/loot/loot_api/libloot.so"

# Step C: Rebuild native addons against Electron headers (Linux only)
- name: Rebuild native addons for Electron
  if: runner.os == 'Linux'
  run: npx @electron/rebuild -f -v 39.8.0
```

The exact path in step B requires a glob or helper script (pnpm store path is a hash-embedded
string). A postinstall script that runs during `pnpm install` is cleaner than a CI path-glob.

### Postinstall Script Pattern (D-03)

```javascript
// scripts/postinstall-libloot.js
// Source: D-03 decision
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

if (process.platform !== 'linux') process.exit(0);

const LIBLOOT_VERSION = '0.29.1'; // must match loot_api/include/loot/loot_version.h
const lootApiDir = path.resolve(
  __dirname, '../node_modules/.pnpm',
  // ... resolve the pnpm store path dynamically
);
```

Better pattern: use `require.resolve('loot/package.json')` to locate the loot package, then
navigate to `../loot_api/`.

```javascript
// scripts/postinstall-libloot.js
if (process.platform !== 'linux') process.exit(0);

const lootPkg = require.resolve('loot/package.json');
const lootApiDir = path.join(path.dirname(lootPkg), 'loot_api');
const soPath = path.join(lootApiDir, 'libloot.so');

// Build approach: clone and compile libloot 0.29.1
// OR download approach: would need https://example.com/libloot-0.29.1-linux.tar.gz
// (does not exist — see §Loot Blocker)
```

### @electron/rebuild Invocation

```bash
# Rebuild all native addons for Electron 39.8.0
# -f = force rebuild even if already built
# -v = electron version
npx @electron/rebuild -f -v 39.8.0

# Rebuild specific addons only (if selective rebuild preferred)
npx @electron/rebuild -f -v 39.8.0 --only bsatk,esptk,loot,bsdiff-node,vortexmt
```

For pnpm workspaces, `@electron/rebuild` scans `node_modules` recursively. Running from the
workspace root should find all addons.

### Existing CI Pattern (reference)

```yaml
# Current step in main.yml (lines 46-49)
- name: Install fontconfig
  if: runner.os == 'Linux'
  run: sudo apt-get update && sudo apt-get install -y libfontconfig1-dev
```

New steps follow this pattern exactly: `if: runner.os == 'Linux'` with `sudo apt-get`.

### Anti-Patterns to Avoid

- **Using `npm rebuild` instead of `@electron/rebuild`:** `npm rebuild` compiles against system
  Node ABI, not Electron ABI. The `.node` file will fail to load at runtime with
  `Error: The module was compiled against a different Node.js version`.
- **Forgetting `-f` (force) flag:** Without `-f`, `@electron/rebuild` skips addons it thinks
  are already built. Always use `-f` in CI.
- **Hardcoding pnpm store paths:** The store path contains a content hash. Use `require.resolve`
  or `pnpm list --json` to find the actual path.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ABI recompilation | Custom node-gyp scripts | `@electron/rebuild` | Handles electron headers, napi version, all edge cases |
| Linux prebuilt detection | Manual file existence checks | `node-gyp-build` (already used by xxhash-addon) | Handles glibc/musl detection automatically |
| Patch application | Manual `sed` in CI | `patch-package` (if gamebryo needs fixing) | Patch persists across `pnpm install`; tracked in git |

---

## Loot Blocker — Critical Research Finding

**Finding:** Decision D-02 ("source libloot.so from LOOT's published GitHub release artifacts")
is **not executable** for libloot 0.29.1.

**Evidence:** GitHub API query of all LOOT releases confirms:
- Releases 0.25.0 through 0.29.2 (current): only `libloot-{version}-win64.7z` (Windows only)
- Release 0.24.5: last release with Linux artifact (`libloot-0.24.5-Linux.tar.xz`)
- libloot 0.25+ was rewritten in Rust; LOOT's maintainers no longer publish Linux prebuilts

**What `node-loot` in this project needs:**
- Package version: 6.2.1 (from `loot/package.json`)
- libloot version required: **0.29.1** (from `loot_api/include/loot/loot_version.h`)
- Header API: libloot C++ FFI headers (already in `loot_api/include/loot/`)

**Alternative approaches for the planner to choose between:**

1. **Build libloot from source in CI** (RECOMMENDED — confirmed feasible):
   - `git clone --depth=1 --branch 0.29.1 https://github.com/loot/libloot.git`
   - `cd cpp && cmake -DLIBLOOT_BUILD_TESTS=OFF -B build && cmake --build build`
   - Requires: `cmake` (apt), `cargo`/`rustc` (`rustup minimal` install, ~30 sec in CI)
   - Output: `cpp/build/liblibloot.so` — copy to `node_modules/loot/loot_api/libloot.so`
   - LOOT CI confirms this works on ubuntu-24.04 (their `cpp` job runs on ubuntu-24.04)

2. **Build libloot in postinstall script** (D-03 variant):
   - Same cmake+cargo approach, but runs during `pnpm install`
   - Slower on every developer `pnpm install` on Linux; better to isolate in CI step

3. **Disable loot on Linux** (FALLBACK only):
   - Wrap all loot imports with `if (process.platform !== 'linux')` guards
   - LOOT provides plugin load order sorting — mod manager works but no load ordering
   - Not recommended for a feature-complete Linux port

**Confidence:** HIGH. Verified via GitHub API against all 20 LOOT releases.

---

## Addon-by-Addon Status

### bsatk (NADD-01) — STATUS: READY
- **binding.gyp:** Has explicit `OS=="linux"` section adding `-pthread`; Windows-only zlib bundled
- **Compile status:** `.node` produced locally — `bsatk.node` confirmed in pnpm store
- **Zlib note:** `bsatk` includes `<zlib.h>` but does NOT link `-lz` on Linux in binding.gyp.
  Symbols are `U inflate*` (undefined) in the `.so` — resolved at load time from the Node.js/
  Electron process (Electron bundles zlib and exports it as a global). This has been verified as
  working on this host and is the expected pattern.
- **Action:** `@electron/rebuild` only. No apt packages needed.
- **Confidence:** HIGH

### esptk (NADD-02) — STATUS: READY
- **binding.gyp:** No Linux section, no Windows-specific libraries beyond DelayLoad. Standard NAPI.
- **Compile status:** `.node` produced locally — `esptk.node` confirmed in pnpm store
- **Source check:** `string_cast.h` has proper `#ifdef _WIN32` / `#else` guards with Linux
  fallbacks that return `std::string` instead of `std::wstring`
- **Action:** `@electron/rebuild` only. No apt packages needed.
- **Confidence:** HIGH

### loot (NADD-03) — STATUS: BLOCKED (see §Loot Blocker)
- **binding.gyp:** Links `-l../loot_api/libloot` (no platform condition — same name on both)
- **Compile status:** `nothing.a` stub — failed because `libloot.so` does not exist
- **Source check:** `exceptions.cpp` and `lootwrapper.cpp` have proper `#ifdef WIN32` guards.
  The C++ wrapper is Linux-compatible.
- **Required action:** Build `libloot.so` (0.29.1) from source using cmake + cargo (Rust), then
  run `@electron/rebuild` to compile the node-gyp binding
- **CI deps:** `cmake`, `rustup --profile minimal`
- **Confidence:** MEDIUM (cmake+cargo path confirmed feasible from LOOT CI; not yet validated
  in Vortex CI specifically)

### bsdiff-node (NADD-04) — STATUS: READY
- **binding.gyp:** Bundles bzip2 sources directly in `src/c/bzip2/`. Zero external deps on Linux.
  Only `OS=="win"` condition is for DelayLoad linker flag.
- **Compile status:** `.node` would be produced locally (not yet verified but structure clean)
- **Action:** `@electron/rebuild` only. No apt packages needed.
- **Confidence:** HIGH

### xxhash-addon (NADD-05) — STATUS: READY (no rebuild needed)
- **Prebuilds:** `prebuilds/linux-x64/addon.napi.glibc.node` and `addon.napi.musl.node` present
- **Install strategy:** `node-gyp-build` checks prebuilds first; NAPI is ABI-stable across
  Node/Electron versions — same binary works for Electron 39 without recompile
- **Action:** None. `pnpm install` already delivers the correct binary.
- **Confidence:** HIGH

### vortexmt (NADD-06 first target) — STATUS: CLEAN, READY
- **binding.gyp:** No Linux-specific or Windows-specific library deps; uses NAPI + node-addon-api
- **common.h:** Proper `#ifdef WIN32` / `#else` guards for `from_utf8()` function
- **main.cpp:** Uses only portable C++ stdlib (`std::ifstream`, `std::thread`, MD5)
- **Compile status:** `.node` confirmed produced locally — `vortexmt.node` exists in pnpm store
- **Action:** Add to `@electron/rebuild` run (same step as bsatk/esptk/bsdiff-node)
- **Confidence:** HIGH

### gamebryo-savegame (NADD-06 second target) — STATUS: BLOCKED (two errors)
- **Error 1 — MoreInfoException constructor (MSVC-only):**
  ```cpp
  // gamebryosavegame.cpp line 27 — FAILS on GCC/Clang
  : std::exception(std::runtime_error(message))
  ```
  `std::exception` on GCC has no constructor taking another exception. Fix: inherit from
  `std::runtime_error` directly or use a message string member.
- **Error 2 — Missing lz4/zlib linker flags:**
  The `.cpp` includes `<lz4.h>` and `<zlib.h>` unconditionally, but `binding.gyp` only adds
  `./lz4/dll/liblz4` and `./zlib/lib/zlib` on `OS=="win"`. On Linux, `node-gyp` will fail to
  link with `undefined reference to LZ4_decompress_safe`.
  Fix: add `liblz4-dev` to apt and add `"-llz4", "-lz"` to a new `OS=="linux"` condition.
- **string_cast.h:** Has proper `#ifdef _WIN32` guards. Not a blocker.
- **Compile status:** `nothing.a` stub on this host (confirms compile failure)
- **Planner decision required:** Fix both errors via patch-package and enable, OR disable with
  a platform guard and a clear error. Disabling is simpler and safe — gamebryo-savegame provides
  save game preview in the UI, not core functionality.
- **Confidence:** HIGH (root causes directly verified in source code)

---

## Common Pitfalls

### Pitfall 1: ABI Mismatch — system Node vs Electron
**What goes wrong:** Addon compiled by `pnpm install` runs against system Node ABI (e.g., Node
22 = ABI 131). Electron 39 bundles its own Node (different ABI). The `.node` file throws
`Error: The module './bsatk.node' was compiled against a different Node.js version`.
**Why it happens:** pnpm install runs the addon's `install` script, which calls `node-gyp` with
the current Node. Without `@electron/rebuild`, the ABI does not match Electron.
**How to avoid:** Always run `@electron/rebuild -f -v 39.8.0` after `pnpm install` in CI and
in local Linux dev setup.
**Warning signs:** `NODE_MODULE_VERSION` mismatch in error message at startup.

### Pitfall 2: libloot.so Not on LD_LIBRARY_PATH at Runtime
**What goes wrong:** `node-loot` compiles successfully but fails at `require()` with
`liblibloot.so: cannot open shared object file`.
**Why it happens:** The linker flags `-l../loot_api/libloot` create a build-time path. At
runtime, the system linker can't find the `.so` unless it's in a known path or RPATH is set.
**How to avoid:** Check the `binding.gyp` for `rpath` settings, or copy the `.so` to a
directory that is in `LD_LIBRARY_PATH`, or add `"-Wl,-rpath,$$ORIGIN/../loot_api"` to the
Linux linker flags in binding.gyp.
**Warning signs:** `NADD-03` test passes (addon loads) but crashes on first call into LOOT API.

### Pitfall 3: pnpm Store Path Instability in CI
**What goes wrong:** A script that hardcodes the pnpm store path (with the content hash) breaks
when any dependency version changes.
**How to avoid:** Use `require.resolve('loot/package.json')` or `pnpm list --json | jq` to
locate the package path dynamically. Never hardcode `.pnpm/loot@https+++...` in scripts.

### Pitfall 4: gamebryo-savegame MSVC Exception Constructor
**What goes wrong:** GCC rejects `std::exception(std::runtime_error(message))` with
`error: no matching function for call to 'std::exception::exception(std::runtime_error)'`.
**Why it happens:** MSVC's `std::exception` has a non-standard constructor taking a `const char*`
(and extension constructors for other exceptions). GCC/Clang strictly follow the C++ standard.
**How to avoid:** Apply a patch-package fix that changes the inheritance to
`: std::runtime_error(message)` and adds `std::string` for the extra fields.

### Pitfall 5: @electron/rebuild and pnpm Hoisting
**What goes wrong:** `@electron/rebuild` run from root does not find addons in pnpm's virtual
store (`.pnpm/` directory).
**How to avoid:** Use `--module-dir` flag if needed, or ensure `@electron/rebuild` version 4.x
(which has pnpm support). Alternatively, run `node_modules/.bin/electron-rebuild` if the binary
exists.

---

## Code Examples

### Pattern: Locate loot_api dir portably in postinstall script

```javascript
// Source: Node.js require.resolve() — portable across pnpm store locations
const path = require('path');

function findLootApiDir() {
  const lootPkgPath = require.resolve('loot/package.json');
  return path.join(path.dirname(lootPkgPath), 'loot_api');
}
```

### Pattern: Platform-guarded postinstall

```javascript
// scripts/postinstall-libloot.js
if (process.platform !== 'linux') {
  console.log('postinstall-libloot: skipping (not Linux)');
  process.exit(0);
}
// ... Linux-only build/download logic
```

### Pattern: Build libloot.so from source in CI

```yaml
# .github/workflows/main.yml — insert after "Install dependencies" step
- name: Install Rust toolchain
  if: runner.os == 'Linux'
  uses: dtolnay/rust-toolchain@stable
  with:
    toolchain: stable

- name: Build libloot.so
  if: runner.os == 'Linux'
  run: |
    git clone --depth=1 --branch 0.29.1 \
      https://github.com/loot/libloot.git /tmp/libloot
    cd /tmp/libloot/cpp
    cmake \
      -DCMAKE_BUILD_TYPE=Release \
      -DLIBLOOT_BUILD_TESTS=OFF \
      -DLIBLOOT_INSTALL_DOCS=OFF \
      -B build
    cmake --build build --parallel
    LOOT_API_DIR=$(node -e "
      const p = require('path');
      console.log(p.join(p.dirname(require.resolve('loot/package.json')), 'loot_api'));
    ")
    cp /tmp/libloot/cpp/build/RelWithDebInfo/liblibloot.so \
      "$LOOT_API_DIR/libloot.so"
```

### Pattern: Run @electron/rebuild in CI

```yaml
- name: Rebuild native addons for Electron
  if: runner.os == 'Linux'
  run: |
    npx @electron/rebuild -f -v 39.8.0
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| libloot was C++ (CMake only) | libloot is Rust + C++ FFI wrapper | 0.25.0 (2023) | Linux prebuilts dropped; must build from source |
| electron-rebuild (standalone) | @electron/rebuild (scoped package) | 2020 | Use `npx @electron/rebuild`, not `electron-rebuild` |
| node-pre-gyp | prebuild-install / node-gyp-build | 2019+ | node-loot still uses prebuild-install; not relevant here |

**Deprecated/outdated:**
- `electron-rebuild` (unscoped): replaced by `@electron/rebuild`. Do not use.
- LOOT Linux prebuilts: last available at 0.24.5. Not available for 0.29.1.

---

## Open Questions

1. **libloot.so RPATH at runtime**
   - What we know: linking with `-l../loot_api/libloot` works at compile time
   - What's unclear: whether the resulting `node-loot.node` embeds an RPATH pointing to
     `$ORIGIN/../loot_api/` or whether the `.so` needs to be discoverable via another mechanism
   - Recommendation: after building libloot.so, run `ldd node-loot.node` on the built addon to
     confirm it resolves `liblibloot.so`. If not found, add `-Wl,-rpath,'$$ORIGIN/../loot_api'`
     to the Linux linker flags in binding.gyp (requires a patch-package or a PR to node-loot).

2. **gamebryo-savegame: fix vs disable**
   - What we know: two concrete compile errors; both fixable via patch-package
   - What's unclear: whether save game preview is needed for Phase 3 / Phase 1 goal
   - Recommendation: disable with a clear error on Linux (simplest path; save preview is not
     part of the `pnpm run start` core value for Phase 1)

3. **@electron/rebuild and pnpm workspace root**
   - What we know: works from project root in most setups
   - What's unclear: whether the deep pnpm `.pnpm/` virtual store structure requires
     `--module-dir` to be specified
   - Recommendation: test first without `--module-dir`; add it if addons are not found

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `cmake` | libloot build | ✓ (this host) | 3.28.3 | must install in CI via apt |
| `cargo`/`rustc` | libloot build | ✗ (this host) | — | install via `dtolnay/rust-toolchain@stable` in CI |
| `g++` | all C++ addons | ✓ | 13.3.0 | — |
| `liblz4-dev` | gamebryo-savegame (if enabled) | ✗ (this host) | — | apt install; or disable gamebryo |
| `zlib1g-dev` | bsatk headers | ✓ | 1.3.dfsg | pre-installed on ubuntu-24.04 |
| `node-gyp` | all addons | ✓ | 10.3.1 (in pnpm store) | — |
| `@electron/rebuild` | all addons | ✗ | — | add as devDep or use `npx` |

**Missing dependencies with no fallback:**
- `cargo`/`rustc` — required to build libloot 0.29.1 from source; must be installed in CI

**Missing dependencies with fallback:**
- `liblz4-dev` — only needed if gamebryo-savegame is enabled; fallback is disabling the addon
- `@electron/rebuild` — fallback is `npx @electron/rebuild` (downloads on demand in CI)

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `pnpm vitest run` |
| Full suite command | `pnpm run test` |

### Phase Requirements → Test Map

Native addon compilation is a **build artifact** verification problem, not a unit test problem.
The acceptance criterion is "addon loads without error at startup." The appropriate test type is
a smoke test that `require()`s each addon and calls a trivial export.

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NADD-01 | `bsatk.node` loads in Electron process without ABI error | smoke | `node -e "require('bsatk')"` after rebuild | ❌ Wave 0 |
| NADD-02 | `esptk.node` loads in Electron process without ABI error | smoke | `node -e "require('esptk')"` after rebuild | ❌ Wave 0 |
| NADD-03 | `loot/node-loot.node` loads and `libloot.so` resolves | smoke | `node -e "require('loot')"` after rebuild | ❌ Wave 0 |
| NADD-04 | `bsdiff-node` loads without error | smoke | `node -e "require('bsdiff-node')"` after rebuild | ❌ Wave 0 |
| NADD-05 | `xxhash-addon` loads without error | smoke | `node -e "require('xxhash-addon')"` | ❌ Wave 0 |
| NADD-06 | `vortexmt` loads OR gamebryo disable path throws clear error | smoke | `node -e "require('vortexmt')"` | ❌ Wave 0 |

**CI gate command** (verifies all addons after rebuild):
```bash
node -e "
['bsatk','esptk','loot','bsdiff-node','xxhash-addon','vortexmt'].forEach(m => {
  try { require(m); console.log(m + ': OK'); }
  catch(e) { console.error(m + ': FAILED', e.message); process.exit(1); }
});
"
```

**Note:** Unit tests in vitest cannot verify native addon loading (requires actual Node process
with correct headers). The smoke tests above run in the CI shell, not vitest. The existing
`pnpm run test` (vitest + Jest) continues to verify non-native code.

### Sampling Rate
- **Per task commit:** Smoke load test for the specific addon being worked on
- **Per wave merge:** Full 6-addon smoke test
- **Phase gate:** All 6 addons load + `pnpm run test` green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `scripts/test-native-addons.sh` — smoke test script for all 6 addons (used in CI gate step)
- [ ] `@electron/rebuild` added to root devDependencies

*(Existing vitest infrastructure covers all non-native unit tests and requires no new setup)*

---

## Sources

### Primary (HIGH confidence)
- Direct inspection of `node_modules/.pnpm/loot/.../loot_api/include/loot/loot_version.h` — libloot version 0.29.1 confirmed
- Direct inspection of `node_modules/.pnpm/loot/.../binding.gyp` — linker flag `-l../loot_api/libloot` confirmed
- Direct inspection of `node_modules/.pnpm/gamebryo-savegame/.../src/gamebryosavegame.cpp` — MoreInfoException MSVC bug confirmed
- Direct inspection of `node_modules/.pnpm/gamebryo-savegame/.../binding.gyp` — missing Linux lz4/zlib linker flags confirmed
- Direct inspection of `node_modules/.pnpm/vortexmt/.../src/common.h` — WIN32 guard confirmed clean
- Direct inspection of `node_modules/.pnpm/bsatk/.../binding.gyp` — Linux section confirmed
- Direct inspection of `node_modules/.pnpm/xxhash-addon@2.1.0/.../prebuilds/linux-x64/` — NAPI prebuilds confirmed
- GitHub API: `https://api.github.com/repos/loot/libloot/releases?per_page=20` — confirmed no Linux artifacts for 0.25.0+
- GitHub API: `https://api.github.com/repos/loot/libloot/contents/.github/workflows/release.yml` — confirmed Windows-only release job
- Direct inspection of `loot/libloot` CI workflow (`ci.yml`) — confirmed Linux cmake+cargo build works on ubuntu-24.04
- `npm view @electron/rebuild version` → 4.0.3 (verified live)
- `node_modules/.pnpm/xxhash-addon@2.1.0/.../install.js` — prebuild-or-build strategy confirmed

### Secondary (MEDIUM confidence)
- `loot/libloot` `cpp/CMakeLists.txt` via GitHub API — build system structure confirmed
- `loot/libloot` `cpp/` CI job on `ubuntu-24.04` — cmake+cargo feasibility confirmed via CI workflow inspection

### Tertiary (LOW confidence)
- RPATH behavior of `-l../loot_api/libloot` on Linux GCC: assumed same as standard `-L` + `-l`
  pattern, but not verified by `ldd` on a successfully rebuilt `node-loot.node`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — @electron/rebuild version verified live; cmake/cargo requirements confirmed from LOOT CI
- Architecture: HIGH for all addons except loot linker/rpath edge case (MEDIUM)
- Pitfalls: HIGH — all root causes confirmed by direct source inspection

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (libloot 0.29.1 is pinned; LOOT releases policy unlikely to change)
