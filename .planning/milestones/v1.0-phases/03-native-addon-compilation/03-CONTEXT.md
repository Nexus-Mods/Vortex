# Phase 3: Native Addon Compilation - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Compile all five C++ native addons (bsatk, esptk, loot, bsdiff-node, xxhash-addon) for Linux in
CI so they load without error when the app starts. Also audit vortexmt and gamebryo-savegame for
Windows-specific API usage (NADD-06). Windows CI addon compilation must continue to pass.

This phase does NOT cover FOMOD, IPC, or elevation — those are Phases 4 and 5.

</domain>

<decisions>
## Implementation Decisions

### loot Linux strategy

- **D-01:** Get loot working on Linux by adding a Linux `libloot.so` to the `node-loot` npm
  package. The binding.gyp already links against `-l../loot_api/libloot` — adding the `.so`
  alongside the existing Windows DLL is sufficient to enable compilation.
- **D-02:** Source the Linux libloot from **LOOT's published GitHub release artifacts** (prebuilt
  `libloot.so` + headers). Do not compile libloot from source in CI. Version must match the
  `libloot.dll` already shipped in the package.
- **D-03:** Deliver the `.so` via a **postinstall script** (or patch-package) that downloads and
  drops `libloot.so` into `node_modules/loot/loot_api/` after `pnpm install`. No fork of
  node-loot required. The existing `binding.gyp` path (`-l../loot_api/libloot`) will find it on
  Linux automatically.

### Rebuild approach (Claude's Discretion)

- No explicit preference stated. The standard approach for Electron native addons is
  `@electron/rebuild` after `pnpm install`. Addons compiled by pnpm install use the system
  Node.js ABI — `@electron/rebuild` recompiles them against Electron's headers so they load
  at runtime.

### vortexmt / gamebryo-savegame (NADD-06)

- No explicit preference stated (area not selected for discussion). Planner should:
  1. Audit both modules for Windows-only API usage.
  2. For vortexmt: compiled successfully on this Linux host (`vortexmt.node` exists in pnpm
     store) — likely clean; verify and add to CI.
  3. For gamebryo-savegame: produces `nothing.a` stub — source has `#ifdef _WIN32` guards
     but lz4/zlib bundled paths are Windows-only. Planner should determine whether system
     lz4+zlib fix the build or whether it should be shimmed/disabled on Linux.

### Claude's Discretion

- CI structure (where in main.yml to add the rebuild step, what apt packages to install) is
  left to the planner.
- How to fail CI cleanly if an addon fails to build is left to the planner.
- Whether to run `@electron/rebuild` once globally or per-workspace is left to the planner.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` §Native Addons — NADD-01 through NADD-06 (acceptance criteria
  for each addon, including the vortexmt/gamebryo-savegame audit requirement)

### CI Workflow
- `.github/workflows/main.yml` — Current CI matrix (ubuntu-latest + windows-latest); this is
  where the Linux rebuild step must be added

### Electron Builder Config
- `src/main/electron-builder.config.json` — Has `"npmRebuild": false` and
  `"asarUnpack": ["**/*.node"]`; all `.node` files are already unpacked from asar

### Native Addon Source
- `node_modules/loot/binding.gyp` — Links against `-l../loot_api/libloot`; confirms where
  `libloot.so` must be placed
- `node_modules/loot/loot_api/` — Currently contains only `libloot.dll`, `libloot.lib`,
  `libloot.pdb`, `readme.txt` — the Linux `.so` goes here

### Roadmap
- `.planning/ROADMAP.md` §Phase 3 — Success criteria and plan list

No external specs beyond the above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/manage-node-modules.js` — Manages all native module repos; provides `status` and
  `summary` commands useful for verifying the audit outcome
- `pnpm-workspace.yaml` catalog — All native addon versions pinned here (bsatk, esptk, loot,
  vortexmt, bsdiff-node, xxhash-addon, gamebryo-savegame)

### Established Patterns
- All native addons live in pnpm catalog with git tarball URLs (except xxhash-addon which is a
  semver range with prebuilds)
- `electron-builder.config.json` already has `"asarUnpack": ["**/*.node"]` — all .node files
  are unpacked from asar at runtime without any further config
- `"npmRebuild": false` — electron-builder does NOT auto-rebuild; a manual `@electron/rebuild`
  step is needed
- The CI `main.yml` already installs `libfontconfig1-dev` on Linux (fontconfig for font-scanner)
  — the same pattern applies for addon build deps (lz4, zlib, etc.)

### Addon status after `pnpm install` on this Linux host
| Addon | .node produced | Notes |
|-------|---------------|-------|
| bsatk | ✓ | Compiled for system Node ABI — needs @electron/rebuild |
| esptk | ✓ | Compiled for system Node ABI — needs @electron/rebuild |
| vortexmt | ✓ | Compiled for system Node ABI — needs @electron/rebuild |
| bsdiff-node | ✓ | Compiled for system Node ABI — needs @electron/rebuild |
| xxhash-addon | ✓ | Ships prebuilds for linux-x64 (glibc + musl) — no rebuild needed |
| loot | ✗ (nothing.a) | Missing libloot.so — blocked until D-01/D-02/D-03 satisfied |
| gamebryo-savegame | ✗ (nothing.a) | Likely missing system lz4/zlib — needs investigation |

### Integration Points
- `.github/workflows/main.yml` — Add Linux-specific `apt-get install` step for addon build deps
  and an `@electron/rebuild` step (Linux-only, after `pnpm install`)
- `postinstall` script or `patch-package` — Deliver `libloot.so` into
  `node_modules/loot/loot_api/` on Linux

</code_context>

<specifics>
## Specific Ideas

- For loot: the postinstall script should be conditional (`if (process.platform === 'linux')`) so
  it does not affect Windows or macOS builds.
- The libloot prebuilt version to download must match the libloot version already in the
  Windows `loot_api/` directory (check `loot_api/readme.txt` or the embedded version string).

</specifics>

<deferred>
## Deferred Ideas

- gamebryo-savegame and vortexmt deeper audit — discussed briefly but not a user decision;
  planner handles per NADD-06
- Forking node-loot to add Linux support upstream — noted as a future improvement; the
  postinstall approach is the Phase 3 solution
- CI structure details (apt packages, rebuild invocation flags) — Claude's discretion

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-native-addon-compilation*
*Context gathered: 2026-03-30*
