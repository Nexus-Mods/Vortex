# Phase 4: FOMOD Installer Integration - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Four surgical changes to make FOMOD mod installation work end-to-end on Linux:
1. Add Linux FOMOD binary patterns to `asarUnpack` so `ModInstaller.Native.so`, `ModInstallerIPC` ELF, and `dotnetprobe` ELF are accessible at runtime
2. Override `VortexIPCConnection.getExecutablePaths()` to resolve `ModInstallerIPC` (no extension) on Linux instead of `ModInstallerIPC.exe`
3. Verify `installer_dotnet/index.ts` Linux code path is complete and active (FOMD-03)
4. Validate the TCP transport handshake end-to-end on Linux (FOMD-04)

This phase does NOT cover IPC named pipe abstraction or elevation — that is Phase 5.

</domain>

<decisions>
## Implementation Decisions

### D-01: asarUnpack additions for Linux FOMOD binaries (FOMD-01)

Add the following three entries to `asarUnpack` in `src/main/electron-builder.config.json`:

```json
"node_modules/@nexusmods/fomod-installer-native/prebuilds/linux-x64/ModInstaller.Native.so",
"node_modules/@nexusmods/fomod-installer-ipc/dist/ModInstallerIPC",
"assets/dotnetprobe"
```

- `ModInstaller.Native.so` — already in `prebuilds/linux-x64/` inside the installed package
- `ModInstallerIPC` — ELF binary (no extension) in `dist/` of fomod-installer-ipc; current pattern `dist/*.exe` does NOT match it
- `assets/dotnetprobe` — Linux ELF already present in `assets/`; current pattern `assets/*.exe` does NOT match it
- Do NOT broaden to `prebuilds/**/*.so` — be explicit about what we're unpacking
- The `**/*.node` pattern already covers `prebuilds/linux-x64/modinstaller.napi.node` — no new entry needed for the NAPI addon

### D-02: dotnetprobe packaging (FOMD-02)

- `assets/dotnetprobe` is the Linux entry added in D-01
- No `linux.extraResources` entry needed — asarUnpack is sufficient; the file resolves via `getVortexPath("assets_unpacked")` at runtime
- `installer_dotnet/index.ts` already resolves to `path.join(getVortexPath("assets_unpacked"), "dotnetprobe")` on Linux (the `.exe`-less branch at line 220)
- Verify `assets/dotnetprobe` is executable (`chmod +x`) — CI may need this, check in packaging step

### D-03: installer_dotnet platform guard (FOMD-03)

- The Linux code path in `checkNetInstall()` already exists (`else if (process.platform === "linux")` branch, line 220)
- `installDotNet()` throws on non-Windows but is unreachable on Linux (the Linux branch of `checkNetInstall` does not set `automaticFix`)
- `main()` in `installer_dotnet/index.ts` has no platform guard — the `.NET check` test runs on Linux, which is correct (FOMOD requires .NET 9 on Linux too)
- **FOMD-03 is already satisfied** in the current code. No changes needed here. The task for the planner is to verify this with a test run.

### D-04: VortexIPCConnection executable name on Linux (FOMD-04 critical)

`BaseIPCConnection.findExecutable()` hardcodes `'ModInstallerIPC.exe'` as the search name. On Linux the binary is `ModInstallerIPC` (no `.exe`). `VortexIPCConnection.getExecutablePaths(exeName)` inherits this and will fail to locate the binary.

**Fix:** Override `getExecutablePaths` in `VortexIPCConnection` to substitute the platform-correct name:

```typescript
protected getExecutablePaths(exeName: string): string[] {
  // On Linux, the executable has no .exe extension
  const platformExeName = process.platform === 'linux'
    ? exeName.replace(/\.exe$/i, '')
    : exeName;
  const paths = super.getExecutablePaths(platformExeName);
  paths.push(
    path.join(
      getVortexPath("package_unpacked"),
      "node_modules",
      "@nexusmods/fomod-installer-ipc",
      "dist",
      platformExeName,
    ),
  );
  return paths;
}
```

This is a surgical platform-conditional change — Windows behavior is unchanged.

### D-05: Connection strategy on Linux (FOMD-04 transport)

- `SandboxProcessLauncher.launch()` explicitly throws on non-Windows (`process.platform !== 'win32'`) — `BaseIPCConnection.initialize()` catches this and falls through to the next strategy. No changes needed.
- `NamedPipeTransport` will also fail on Linux (Windows-specific named pipe path) — same fallback catches it.
- `RegularProcessLauncher` with `TCPTransport` is the strategy that succeeds on Linux. The existing fallback mechanism in `BaseIPCConnection.initialize()` reaches it automatically after the first two strategies fail.
- **Do NOT change `connectionStrategy.ts`** for now. The existing 3-strategy list with TCP fallback is correct. Optional optimization (skip to TCP on Linux immediately) is deferred to Phase 5 or later as a quality-of-life fix.
- `SupportsAppContainer?.() ?? false` (winapi shim Phase 2) returns `false` on Linux → `osSupportsAppContainer = false` in `installer_fomod_ipc/index.ts` → sandbox settings UI renders but sandbox is not available. Acceptable.

### Claude's Discretion

- Whether `assets/dotnetprobe` needs `chmod +x` in CI packaging — check `assets/dotnetprobe.exe` handling for comparison; add executable bit in Dockerfile or CI if needed
- The exact log messages when NamedPipe/Sandbox strategies fail on Linux — BaseIPCConnection already logs warnings; no new logging needed
- Whether to add a `getVortexPath("assets_unpacked")` path to `VortexIPCConnection.getExecutablePaths` for `dotnetprobe` — dotnetprobe is separate from ModInstallerIPC; leave to planner
- Unit test approach for FOMD-04 — planner decides whether to add integration test or rely on manual end-to-end validation per ROADMAP success criteria

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` §FOMOD Installer — FOMD-01 through FOMD-04 (exact acceptance criteria)

### Files Being Modified
- `src/main/electron-builder.config.json` — `asarUnpack` array at line 60; add three Linux binary entries (D-01)
- `src/renderer/src/extensions/installer_fomod_ipc/utils/VortexIPCConnection.ts` — `getExecutablePaths` override at line 85; add platform-conditional exe name (D-04)

### Files to Verify (no changes expected)
- `src/renderer/src/extensions/installer_dotnet/index.ts` — `checkNetInstall` Linux branch at line 220; `installDotNet` platform guard at line 94 (verify FOMD-03 is already satisfied)
- `src/renderer/src/extensions/installer_fomod_ipc/utils/connectionStrategy.ts` — strategy ordering; TCP is already the final fallback

### Package Internals (read-only, informs D-01)
- `node_modules/@nexusmods/fomod-installer-ipc@0.12.0/dist/ModInstallerIPC` — ELF x86-64 binary, confirmed via `file` command
- `node_modules/@nexusmods/fomod-installer-native@0.12.0/prebuilds/linux-x64/ModInstaller.Native.so` — Linux shared library, present in package
- `assets/dotnetprobe` — Linux ELF, confirmed present in project `assets/` directory

### Package API (informs D-04)
- `node_modules/@nexusmods/fomod-installer-ipc@0.12.0/dist/index.js` — `BaseIPCConnection` class, `findExecutable()` at line 377, `getExecutablePaths()` at line 110; `SandboxProcessLauncher.launch()` throws on non-Windows at line 1124; `RegularProcessLauncher.launch()` has mono fallback at line 948 (avoid by using no-extension name)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BaseIPCConnection.initialize()` — already implements try-each-strategy fallback loop; `SandboxProcessLauncher` and `NamedPipeTransport` failures are caught and logged as warnings, not fatal errors
- `VortexIPCConnection.getExecutablePaths()` at line 85 — the exact override point for D-04; already overrides with Vortex path; extend with platform-conditional name only
- `process.platform === 'linux'` guard — established pattern from Phases 1–3; use in D-04

### Established Patterns
- `asarUnpack` additions follow the existing pattern in `electron-builder.config.json` line 60 — string array entries for exact paths or globs
- `process.platform === 'linux'` guard in all platform-conditional code — consistent with Phase 1/2 decisions
- `getVortexPath("assets_unpacked")` — the runtime path for any file in `asarUnpack`; used by `installer_dotnet/index.ts` to locate `dotnetprobe`

### Integration Points
- `electron-builder.config.json` `asarUnpack` array (line 60) — add 3 entries, one per Linux binary
- `VortexIPCConnection.getExecutablePaths()` (line 85) — add platform-conditional `exeName` substitution before calling `super`
- `installer_dotnet/index.ts` `checkNetInstall()` (line 209) — verify Linux branch at line 220 runs correctly once dotnetprobe is accessible

### Strategy Fallback Chain on Linux (FOMD-04)
1. `SandboxProcessLauncher` + `NamedPipeTransport` → throws on non-Windows → caught → next
2. `RegularProcessLauncher` + `NamedPipeTransport` → NamedPipe init fails on Linux → caught → next
3. `RegularProcessLauncher` + `TCPTransport` → **succeeds** (once exe name is fixed by D-04)

</code_context>

<specifics>
## Specific Ideas

- `RegularProcessLauncher.launch()` has a mono fallback: `if (platform !== 'win32' && exePath.endsWith('.exe')) use mono`. By stripping `.exe` in D-04, we correctly bypass the mono path — `ModInstallerIPC` is a .NET 9 self-contained Linux binary that runs directly, not via mono.
- `file` command on `ModInstallerIPC` confirms: `ELF 64-bit LSB pie executable, x86-64, dynamically linked, for GNU/Linux 2.6.32`. It is a native binary, not a mono target.
- The `@nexusmods/fomod-installer-native` package also has a `ModInstaller.Native.so` at the package root (not in `prebuilds/`) — the root-level one appears to be a symlink or build artifact; the canonical one for asarUnpack is the `prebuilds/linux-x64/` version which is what `node-gyp-build` uses at runtime.

</specifics>

<deferred>
## Deferred Ideas

- **Optimize connection strategy for Linux** — skip NamedPipe/Sandbox strategies entirely on Linux in `connectionStrategy.ts` (2 failed attempts wasted per FOMOD install). Low priority: fallback mechanism already works; deferring to Phase 5 polish or later.
- **mono fallback cleanup** — `RegularProcessLauncher` has a dead code path (mono) on Linux since we'll never pass a `.exe` name. Upstream package fix; out of scope.
- **NamedPipe → Unix socket abstraction** — Named pipe IPC path (`\\?\pipe\...`) is used inside the FOMOD TCP transport for process coordination on Windows; Phase 5 addresses this for `elevated.ts` but not the FOMOD IPC package internals. Deferred.

</deferred>

---

*Phase: 04-fomod-installer-integration*
*Context gathered: 2026-03-31*
