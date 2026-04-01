# Phase 4: FOMOD Installer Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 04-fomod-installer-integration
**Areas discussed:** asarUnpack patterns, TCP transport strategy, FOMD-03 guard status, installer_fomod_ipc Linux scope

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| asarUnpack patterns | How to glob Linux FOMOD binaries | ✓ (auto) |
| TCP transport strategy | Named pipe fallback vs Linux guard | ✓ (auto) |
| FOMD-03 guard status | Platform guard removal scope | ✓ (auto) |
| installer_fomod_ipc Linux scope | Whether shim is sufficient | ✓ (auto) |

**User's direction:** "Follow your best recommendations, research and analyze as necessary"
**Notes:** Full codebase analysis performed before writing decisions. No interactive Q&A — all decisions made by codebase inspection.

---

## asarUnpack Patterns (FOMD-01, FOMD-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Exact paths per binary | Add three specific entries | ✓ |
| Broad glob (`prebuilds/**/*.so`) | Catch-all for Linux prebuilds | |
| platform-conditional config | Split Linux/Windows electron-builder config | |

**Decision:** Exact paths — `prebuilds/linux-x64/ModInstaller.Native.so`, `dist/ModInstallerIPC`, `assets/dotnetprobe`
**Notes:** The `**/*.node` pattern already covers `modinstaller.napi.node`. Broad globs are avoided per project convention of explicit, surgical changes.

---

## TCP Transport Strategy (FOMD-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Trust existing fallback | BaseIPCConnection tries strategies in order; Sandbox/NamedPipe throw → TCP wins | ✓ |
| Linux guard in connectionStrategy.ts | Skip to TCP-only on Linux immediately | |
| Override initialize() in VortexIPCConnection | Custom strategy selection per platform | |

**Decision:** Trust existing fallback. `BaseIPCConnection.initialize()` already has a try-each-strategy loop that catches failures. Only critical fix is `getExecutablePaths()` exe name resolution.
**Notes:** Optimization (skip to TCP immediately on Linux) deferred — 2 failed attempts per install is acceptable for Phase 4.

---

## Executable Name Resolution (FOMD-04 critical)

**Finding from codebase analysis:** `BaseIPCConnection.findExecutable()` hardcodes `'ModInstallerIPC.exe'`. On Linux the binary is `ModInstallerIPC` (no extension). This is a blocker for FOMD-04.

| Option | Description | Selected |
|--------|-------------|----------|
| Override getExecutablePaths in VortexIPCConnection | Strip .exe on Linux before calling super | ✓ |
| Patch BaseIPCConnection (upstream) | Fix in the npm package | |
| Override findExecutable in VortexIPCConnection | Full replacement of search logic | |

**Decision:** Override `getExecutablePaths` in `VortexIPCConnection` — minimal surgical change, platform-conditional, doesn't affect Windows.

---

## FOMD-03 Platform Guard

**Finding from codebase analysis:** `installer_dotnet/index.ts` already has `else if (process.platform === "linux")` branch in `checkNetInstall()`. The `installDotNet()` throw-on-non-Windows is unreachable on Linux (no `automaticFix` set in Linux branch).

| Option | Description | Selected |
|--------|-------------|----------|
| Verify as-is (already done) | No code changes; planner verifies with test run | ✓ |
| Remove installDotNet throw | Cleanup guard even if unreachable | |

**Decision:** FOMD-03 is already satisfied. Planner should verify with a test invocation of `checkNetInstall` on Linux.

---

## installer_fomod_ipc Linux Scope

**Finding from codebase analysis:** `SupportsAppContainer?.() ?? false` (winapi shim, Phase 2) returns `false` on Linux. `osSupportsAppContainer = false` → sandbox settings show as unavailable. `SandboxProcessLauncher` fails gracefully via strategy fallback.

| Option | Description | Selected |
|--------|-------------|----------|
| No additional guards (shim sufficient) | Extension loads on Linux; sandbox unavailable | ✓ |
| Add platform guard to main() | Disable extension on Linux entirely | |

**Decision:** Shim is sufficient. Extension is functional on Linux (just without sandbox security).

---

## Claude's Discretion

- Whether `assets/dotnetprobe` needs `chmod +x` in CI
- Whether to add unit tests for the `getExecutablePaths` Linux path
- Log message wording for failed strategies on Linux

## Deferred Ideas

- Optimize connection strategy to skip Named Pipe/Sandbox on Linux (2 wasted attempts)
- Upstream fix to `BaseIPCConnection.findExecutable()` for platform-aware exe names
- Named Pipe → Unix socket abstraction inside the FOMOD IPC package internals
