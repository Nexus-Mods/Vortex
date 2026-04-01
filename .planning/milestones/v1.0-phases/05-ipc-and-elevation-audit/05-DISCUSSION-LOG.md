# Phase 5: IPC and Elevation Audit - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 05-ipc-and-elevation-audit
**Areas discussed:** Named pipe sites scope

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Named pipe sites scope | Which parent server sites get getIPCPath(), startup vs all | ✓ |
| Serialization trap approach | How to patch elevatedMain child closure | |
| Elevation audit outcome | runElevated call sites, pkexec scope | |
| getIPCPath utility location | renderer util vs shared | |

**User's choice:** Named pipe sites scope only — all other areas deferred to Claude's discretion.

---

## Named Pipe Sites Scope

### Q1: Which parent server sites get patched?

| Option | Description | Selected |
|--------|-------------|----------|
| Patch all 3 (Recommended) | Fix fs.ts, ExtensionManager.ts, symlink_activator_elevate even though deployment-triggered | ✓ |
| Startup path only | Technically IPC-02 satisfied without patching — defer to later phase | |
| Patch all + document startup vs deploy | Patch all and clarify in audit which are startup vs user-triggered | |

**User's choice:** Patch all 3 — Linux would crash on mod deployment if left unpatched.

### Q2: Serialization trap — how does child get the platform-correct path?

| Option | Description | Selected |
|--------|-------------|----------|
| Parent computes, injects as literal (Recommended) | getIPCPath(ipcPath) called in parent before injection; result baked in as string literal | ✓ |
| Pass getIPCPath as serialized arg | Serialize function body and pass as argument to child | |
| Platform check inside elevatedMain | Inline process.platform check directly in the serialized closure | |

**User's choice:** Parent computes, injects as literal — simplest, no function smuggling, works with webpack.

---

## Claude's Discretion

- getIPCPath utility location (renderer util vs shared)
- IPC-04 audit format (inline SUMMARY.md section vs separate doc)
- Whether to add unit tests for getIPCPath
- Whether symlink_activator_elevate client-side runElevated calls need socket updates beyond server patch

## Deferred Ideas

- pkexec / full elevation model — v2 requirements (ELEV-01/ELEV-02)
- FOMOD IPC named pipe cleanup — upstream package work
- Connection strategy optimization for Linux (skip NamedPipe on Linux) — deferred from Phase 4
