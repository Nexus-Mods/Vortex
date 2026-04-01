# Phase 5: IPC and Elevation Audit - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Two surgical changes to make IPC paths work on Linux and document the elevation scope:
1. Extract `getIPCPath(id)` utility that returns `\\?\pipe\{id}` on Windows and `path.join(os.tmpdir(), 'vortex-{id}.sock')` on Linux
2. Patch ALL three parent server sites that hardcode `\\?\pipe` (fs.ts, ExtensionManager.ts, symlink_activator_elevate) to use `getIPCPath()`
3. Patch the serialized `elevatedMain` child closure in `elevated.ts` (the serialization trap) — parent computes `getIPCPath(ipcPath)` before injection and passes the result as a string literal into the child script
4. Write the IPC-04 elevation audit document — confirms `runElevated()` is NOT on the startup path and pkexec is NOT needed for Phase 1

This phase does NOT implement pkexec elevation or a full Linux elevation model (v2 requirements).

</domain>

<decisions>
## Implementation Decisions

### D-01: getIPCPath utility (IPC-01)

Extract a `getIPCPath(id: string): string` utility:
- Windows: `path.join('\\\\?\\pipe', id)` — existing behavior, unchanged
- Linux: `path.join(os.tmpdir(), \`vortex-\${id}.sock\`)` — Unix domain socket path

Location: `src/renderer/src/util/ipc.ts` (new file, renderer-side — all call sites are in renderer).

### D-02: Patch all three parent server sites (IPC-02)

All three sites that call `.listen(path.join("\\\\?\\pipe", ipcPath))` must be updated to use `getIPCPath(ipcPath)`:
1. `src/renderer/src/util/fs.ts:1077`
2. `src/renderer/src/ExtensionManager.ts:2889`
3. `src/renderer/src/extensions/symlink_activator_elevate/index.ts:94` (`startIPCServer()`)

Rationale: although these are user-triggered (mod deployment), not startup, Linux will crash if a user tries to deploy mods. Patch all three while we're in this area.

### D-03: Serialization trap — parent computes, injects as literal (IPC-03)

`elevatedMain` is `.toString()`'d into a temp file and run in a child process — it cannot import `getIPCPath`. Fix:
- The **parent** (`runElevated()`) calls `getIPCPath(ipcPath)` to compute the platform-correct socket path **before** serializing the script
- The resolved path is injected as a string literal: `let ipcPath = '/tmp/vortex-xyz.sock';`
- The child's `client.connect(path.join("\\\\?\\pipe", ipcPath))` line at `elevated.ts:54` is changed to `client.connect(ipcPath)` — it simply uses the already-resolved path, no Windows pipe prefix logic in the child

This is the cleanest approach: no function smuggling, no complex reconstruction, no risk of webpack transforms breaking the child script.

### D-04: IPC-04 Elevation audit outcome

The audit documents that `runElevated()` is **not** on the startup path:
- Call sites: `fs.ts:1078` (fs copy/move ops), `ExtensionManager.ts:2659` (elevated custom tools), `symlink_activator_elevate:566,806,930,1057` (symlink deployment)
- All four call sites are user-triggered (mod deployment operations) — none execute during app startup
- pkexec is **NOT needed for Phase 1**. The `winapi.ShellExecuteEx` shim (Phase 2) already throws on Linux, which is acceptable — `runElevated()` is never called during normal "boots on Linux" startup

### Claude's Discretion

- Whether to add a test for `getIPCPath()` — utility is simple enough for a unit test; planner decides
- Whether `symlink_activator_elevate`'s client-side `runElevated` calls also need socket path updates or whether patching the server (startIPCServer) and child (elevatedMain) is sufficient for IPC-01/02/03
- The exact IPC-04 audit format — a short markdown section in the phase SUMMARY.md is sufficient; no separate doc needed

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` §IPC / Elevation — IPC-01 through IPC-04 (exact acceptance criteria)

### Files Being Modified
- `src/renderer/src/util/elevated.ts` — `elevatedMain` at line 24 (child closure, line 54 is the pipe connect); `runElevated()` at line 101 (parent — compute socket path before injection)
- `src/renderer/src/util/fs.ts` — `.listen(path.join("\\\\?\\pipe", ipcPath))` at line 1077 (parent server)
- `src/renderer/src/ExtensionManager.ts` — `.listen(path.join("\\\\?\\pipe", ipcPath))` at line 2889 (parent server)
- `src/renderer/src/extensions/symlink_activator_elevate/index.ts` — `startIPCServer()` at line 80; `.listen(path.join("\\\\?\\pipe", ipcPath))` at line 94

### New File
- `src/renderer/src/util/ipc.ts` — `getIPCPath(id)` utility (to be created per D-01)

### Files to Verify (read, inform audit)
- `src/renderer/src/util/runElevatedCustomTool.ts` — client-side elevated code, check for hardcoded pipe paths
- `src/renderer/src/types/IExtensionContext.ts` — IPC type definitions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `elevated.ts` `runElevated()` — the serialization mechanism is already well-understood: `elevatedMain.toString()` → temp JS file → `ShellExecuteEx`. The ipcPath variable is injected as a `let ipcPath = '...'` string literal (line 132) — so the fix is to replace `'${ipcPath}'` with the result of `getIPCPath(ipcPath)` at the parent injection point
- `process.platform === 'linux'` guard — established pattern from Phases 1–4; used inside `getIPCPath()`

### Established Patterns
- `path.join("\\\\?\\pipe", ipcPath)` appears in 3 parent server `.listen()` calls and 1 child `.connect()` call — consistent pattern, easy to find and replace
- All IPC call sites are in the renderer process — `getIPCPath` only needs to live in `src/renderer/src/util/`

### Integration Points
- `elevated.ts:132` — `let ipcPath = '${ipcPath}'` injection point; change to `let ipcPath = '${getIPCPath(ipcPath)}'`
- `elevated.ts:54` — `client.connect(path.join("\\\\?\\pipe", ipcPath))` in child; change to `client.connect(ipcPath)` (path already resolved by parent)
- `fs.ts:1077` — `.listen(path.join("\\\\?\\pipe", ipcPath))` → `.listen(getIPCPath(ipcPath))`
- `ExtensionManager.ts:2889` — `.listen(path.join("\\\\?\\pipe", ipcPath))` → `.listen(getIPCPath(ipcPath))`
- `symlink_activator_elevate/index.ts:94` — `.listen(path.join("\\\\?\\pipe", ipcPath))` → `.listen(getIPCPath(ipcPath))`

### Serialization Trap — How runElevated Works
1. `runElevated(ipcPath, func, args)` is called in the parent (renderer) process
2. `elevatedMain.toString()` extracts the function body as a string
3. A temp `.js` file is assembled: preamble (variable declarations) + `mainBody` + user `func.toString()`
4. `let ipcPath = '${ipcPath}'` at line 132 is where the ipcPath is baked in as a literal string
5. The child process connects to that path — it never runs platform detection itself
6. **Fix:** change line 132 to inject `getIPCPath(ipcPath)` result; change line 54 to just `client.connect(ipcPath)` (no pipe prefix logic)

</code_context>

<specifics>
## Specific Ideas

- The `runElevated` function already serializes `ipcPath` as a string literal at line 132 — this is the ONLY injection point. Changing `'${ipcPath}'` to `'${getIPCPath(ipcPath)}'` in the parent's string template is the complete fix for IPC-03.
- The child `client.connect(path.join("\\\\?\\pipe", ipcPath))` at line 54 must also change, but only to remove the now-redundant pipe prefix join — the path is already fully resolved by the parent.
- On Linux, `os.tmpdir()` returns `/tmp` — socket path will be `/tmp/vortex-{id}.sock`. These are ephemeral and cleaned up on reboot, which is correct behavior.

</specifics>

<deferred>
## Deferred Ideas

- **pkexec / full elevation model** — v2 requirement ELEV-01/ELEV-02; not in Phase 1 scope
- **FOMOD IPC named pipe cleanup** — `BaseIPCConnection` in the fomod-installer-ipc npm package uses named pipes internally on Windows; patching that is upstream package work, out of scope
- **Connection strategy optimization for Linux** — skip NamedPipe/Sandbox strategies on Linux in `connectionStrategy.ts`; deferred from Phase 4

</deferred>

---

*Phase: 05-ipc-and-elevation-audit*
*Context gathered: 2026-03-31*
