# Phase 5: IPC and Elevation Audit - Research

**Researched:** 2026-03-31
**Domain:** Node.js IPC (named pipes vs Unix domain sockets), Electron elevated process serialization
**Confidence:** HIGH — all claims verified directly against source files in the repository

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: getIPCPath utility (IPC-01)**
Extract a `getIPCPath(id: string): string` utility:
- Windows: `path.join('\\\\?\\pipe', id)` — existing behavior, unchanged
- Linux: `path.join(os.tmpdir(), \`vortex-\${id}.sock\`)` — Unix domain socket path

Location: `src/renderer/src/util/ipc.ts` (new file, renderer-side — all call sites are in renderer).

**D-02: Patch all three parent server sites (IPC-02)**
All three sites that call `.listen(path.join("\\\\?\\pipe", ipcPath))` must be updated to use `getIPCPath(ipcPath)`:
1. `src/renderer/src/util/fs.ts:1077`
2. `src/renderer/src/ExtensionManager.ts:2889`
3. `src/renderer/src/extensions/symlink_activator_elevate/index.ts:94` (`startIPCServer()`)

**D-03: Serialization trap — parent computes, injects as literal (IPC-03)**
- The parent (`runElevated()`) calls `getIPCPath(ipcPath)` before serializing the script
- The resolved path is injected as a string literal: `let ipcPath = '/tmp/vortex-xyz.sock';`
- The child's `client.connect(path.join("\\\\?\\pipe", ipcPath))` at `elevated.ts:54` changes to `client.connect(ipcPath)`

**D-04: IPC-04 Elevation audit outcome**
The audit documents that `runElevated()` is not on the startup path. All four call sites are user-triggered (mod deployment). pkexec is NOT needed for Phase 1.

### Claude's Discretion

- Whether to add a unit test for `getIPCPath()` — utility is simple enough for a unit test; planner decides
- Whether `symlink_activator_elevate`'s client-side `runElevated` calls also need socket path updates or whether patching the server (startIPCServer) and child (elevatedMain) is sufficient for IPC-01/02/03
- The exact IPC-04 audit format — a short markdown section in the phase SUMMARY.md is sufficient; no separate doc needed

### Deferred Ideas (OUT OF SCOPE)

- pkexec / full elevation model — v2 requirement ELEV-01/ELEV-02; not in Phase 1 scope
- FOMOD IPC named pipe cleanup — BaseIPCConnection in fomod-installer-ipc npm package; upstream package work, out of scope
- Connection strategy optimization for Linux — skip NamedPipe/Sandbox strategies in connectionStrategy.ts; deferred from Phase 4
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IPC-01 | `getIPCPath(id)` utility returns `\\?\pipe\{id}` on Windows, `path.join(os.tmpdir(), 'vortex-{id}.sock')` on Linux | New file `src/renderer/src/util/ipc.ts`; pattern consistent with existing `process.platform === 'linux'` guards from Phases 1-4 |
| IPC-02 | `elevated.ts` parent `startIPCServer()` uses `getIPCPath()` — no hardcoded UNC prefix on Linux | Three `.listen(path.join("\\\\?\\pipe", ipcPath))` call sites verified in source: fs.ts:1077, ExtensionManager.ts:2889, symlink_activator_elevate/index.ts:94 |
| IPC-03 | Serialised `elevatedMain` closure connects to Unix socket on Linux | Injection point verified at elevated.ts:132 (`let ipcPath = '${ipcPath}'`); child connect at elevated.ts:54 (`client.connect(path.join("\\\\?\\pipe", ipcPath))`) |
| IPC-04 | Elevation audit complete — documents whether `runElevated()` is on any startup path | All `runElevated` call sites enumerated and verified as user-triggered (deployment ops); startup path analysis complete |
</phase_requirements>

## Summary

Phase 5 is a focused four-task phase: create one new utility file, patch three call sites, patch one serialization injection point, and write an audit document. There is no ambiguity about what code to change — the CONTEXT.md provides exact file paths and line numbers verified against the actual source.

The core technical challenge is the **serialization trap** in `elevated.ts`. The `elevatedMain` function is extracted via `.toString()` and written to a temp `.js` file for execution in a separate elevated Node process. This child process cannot `require` any module from the parent's webpack bundle, and cannot call `getIPCPath()` — it only receives what was baked in as string literals at construction time. The fix is to resolve the platform-correct path in the parent before injection, so the child sees a fully-resolved path string with no logic to execute.

The elevation audit (IPC-04) is a documentation task requiring code-reading rather than code-writing. All `runElevated` call sites have been enumerated: four total (fs.ts:1078, ExtensionManager.ts:2659, symlink_activator_elevate/index.ts:566/806/930/1057). All are inside user-triggered mod deployment code paths, none are in startup code paths.

**Primary recommendation:** Plan as two implementation tasks (utility + patches, then audit doc) with one optional bonus task (unit test for `getIPCPath`).

## Standard Stack

### Core (already present — no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:net` | Node.js built-in | TCP/Unix socket server | Already used in all three server sites |
| `node:os` | Node.js built-in | `os.tmpdir()` for Linux socket path | Standard cross-platform temp dir |
| `node:path` | Node.js built-in | `path.join()` for constructing IPC paths | Already used at all call sites |
| `process.platform` | Node.js built-in | Platform guard | Established pattern from Phases 1-4 |

**Installation:** None required — no new dependencies.

## Architecture Patterns

### Recommended Project Structure (changes only)
```
src/renderer/src/util/
├── ipc.ts           # NEW — getIPCPath(id) utility
├── elevated.ts      # PATCH — injection point line 132 + child connect line 54
├── fs.ts            # PATCH — .listen() at line 1077
└── ExtensionManager.ts  # PATCH — .listen() at line 2889

src/renderer/src/extensions/symlink_activator_elevate/
└── index.ts         # PATCH — startIPCServer() .listen() at line 94
```

### Pattern 1: getIPCPath Utility (IPC-01)

**What:** Single exported function in `src/renderer/src/util/ipc.ts` — Windows keeps existing UNC pipe path, Linux uses Unix domain socket in tmpdir.
**When to use:** Any time a named pipe path is needed for IPC between processes.

```typescript
// src/renderer/src/util/ipc.ts
import * as os from "os";
import * as path from "path";

/**
 * Returns the platform-correct IPC path for the given identifier.
 * - Windows: \\?\pipe\{id}  (UNC named pipe)
 * - Linux:   /tmp/vortex-{id}.sock  (Unix domain socket)
 */
export function getIPCPath(id: string): string {
  if (process.platform === "linux") {
    return path.join(os.tmpdir(), `vortex-${id}.sock`);
  }
  return path.join("\\\\?\\pipe", id);
}
```

### Pattern 2: Patching Parent Server Sites (IPC-02)

**What:** Replace three identical hardcoded `.listen(path.join("\\\\?\\pipe", ipcPath))` calls with `.listen(getIPCPath(ipcPath))`.
**When to use:** Anywhere a `net.Server` listens on a named pipe.

Three sites — exact transformation in each case:
```typescript
// BEFORE (all three sites, identical pattern):
.listen(path.join("\\\\?\\pipe", ipcPath))

// AFTER:
.listen(getIPCPath(ipcPath))
```

Each file also needs an import added:
```typescript
import { getIPCPath } from "./ipc";      // for fs.ts and elevated.ts
import { getIPCPath } from "../../util/ipc";  // for symlink_activator_elevate/index.ts
```

### Pattern 3: Serialization Trap Fix (IPC-03)

**What:** The `elevatedMain` function is a closure extracted via `.toString()`. It cannot call `getIPCPath()` at runtime — the function body is plain text injected into a script file. Fix: resolve the path in the parent, inject the result as a string literal.

**Injection point** — `elevated.ts:132` (verified in source):
```typescript
// BEFORE:
let ipcPath = '${ipcPath}';\n

// AFTER — parent resolves path before serialization:
let ipcPath = '${getIPCPath(ipcPath)}';\n
```

**Child connect** — `elevated.ts:54` (verified in source):
```typescript
// BEFORE — child tries to re-add Windows pipe prefix to an already-resolved path:
client.connect(path.join("\\\\?\\pipe", ipcPath));

// AFTER — child uses the already-fully-resolved path literal:
client.connect(ipcPath);
```

The child also requires `path` via `__non_webpack_require__("path")` on line 51. After the fix, the `path.join("\\\\?\\pipe", ipcPath)` call at line 54 is gone, but the `path` require can remain (it may be used elsewhere in `elevatedMain`). If it is the only use, it can also be cleaned up — planner's discretion.

### Pattern 4: Unit Test for getIPCPath (IPC-01, optional)

**What:** Co-located Vitest test at `src/renderer/src/util/ipc.test.ts`.
**Framework setup:** Renderer Vitest config picks up `src/**/*.test.ts` automatically — no config changes needed.

```typescript
// src/renderer/src/util/ipc.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import * as os from "os";
import * as path from "path";

describe("getIPCPath", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a named pipe path on Windows", () => {
    vi.stubGlobal("process", { ...process, platform: "win32" });
    const { getIPCPath } = await import("./ipc");
    expect(getIPCPath("my-id")).toBe(path.join("\\\\?\\pipe", "my-id"));
  });

  it("returns a Unix socket path in os.tmpdir() on Linux", () => {
    vi.stubGlobal("process", { ...process, platform: "linux" });
    const { getIPCPath } = await import("./ipc");
    expect(getIPCPath("my-id")).toBe(
      path.join(os.tmpdir(), "vortex-my-id.sock"),
    );
  });
});
```

Note: `process.platform` is read-only in Node.js; the test needs `vi.stubGlobal` or a factory function to override it. An alternative is to pass the platform as a parameter during testing, but D-01 specifies `getIPCPath(id: string): string` with no platform parameter — so the test must mock `process.platform`.

### Anti-Patterns to Avoid

- **Hand-rolling platform detection at each call site:** Do not add `if (process.platform === 'linux')` at each of the three server sites. That is what `getIPCPath()` is for.
- **Passing getIPCPath into the child:** The child is serialized text — it cannot receive a function reference. Only string literals survive serialization. D-03 is the correct approach.
- **Changing the IPC path format on Windows:** The Windows behavior must remain `\\?\pipe\{id}` — changing it would break the Windows build.
- **Using `path.join("\\\\?\\pipe", id)` directly in the new utility:** On Linux, `path.join` would corrupt the Windows UNC prefix. The conditional is required.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Platform socket path | Per-site if/else | `getIPCPath()` utility | Three sites become one canonical location; single change point for future platforms |
| IPC path cleanup | Manual `fs.unlinkSync` in teardown | Let OS reap on reboot | Unix domain sockets in `/tmp` are ephemeral; OS cleans up on reboot; trying to unlink is fragile and already not done on Windows |

## Common Pitfalls

### Pitfall 1: Forgetting the Child Process Path

**What goes wrong:** Parent is patched to use `getIPCPath()`, but `elevated.ts:54` (child connect) still has `path.join("\\\\?\\pipe", ipcPath)`. On Linux, the parent opens `/tmp/vortex-xyz.sock` and the child tries to connect to `\\?\pipe\/tmp/vortex-xyz.sock` — connection refused.

**Why it happens:** The child and parent code are in the same source file but execute in completely different contexts. A text search for the pattern finds both, but the child connect is inside the `elevatedMain` function body which visually looks like the same scope.

**How to avoid:** Any change to `runElevated`'s injection point (line 132) MUST be paired with the change to `elevatedMain`'s connect call (line 54). Treat them as an atomic pair.

**Warning signs:** IPC timeout errors on Linux when `runElevated` is called. The parent server starts successfully but the child never connects.

### Pitfall 2: Import Path Errors

**What goes wrong:** `symlink_activator_elevate/index.ts` is in a subdirectory — the import path for `getIPCPath` is different from the other two sites.

**Why it happens:** Flat relative imports don't account for directory depth differences.

**How to avoid:**
- `fs.ts` → `import { getIPCPath } from "./ipc";`
- `ExtensionManager.ts` → `import { getIPCPath } from "./util/ipc";`
- `symlink_activator_elevate/index.ts` → `import { getIPCPath } from "../../util/ipc";`

### Pitfall 3: The path.join Corruption on Linux

**What goes wrong:** Using `path.join("\\\\?\\pipe", id)` on Linux. On Linux, `path.join` treats backslashes as literal characters (not separators), so the result is `\\?\pipe\my-id` as a literal string — which is not a valid filesystem path on Linux.

**Why it happens:** `path.join` is platform-specific. On Windows it handles both `/` and `\`; on Linux it only handles `/`.

**How to avoid:** The `getIPCPath` utility must use a conditional branch, not `path.join`, for the Windows case: `return path.join("\\\\?\\pipe", id)` is fine on Windows but the `linux` branch must use the `os.tmpdir()` path.

### Pitfall 4: Audit Scope Creep

**What goes wrong:** The elevation audit uncovers more than IPC-04 requires — e.g., discovering symlink_activator elevation is also broken on Linux — and the plan tries to fix those things in this phase.

**Why it happens:** Audit turns into design review.

**How to avoid:** IPC-04 requires only that the audit document answers two questions: (1) is `runElevated()` called on any startup path? (2) is pkexec needed for Phase 1? If the answer to both is "no" and "no", the requirement is satisfied. Future elevation work is v2 (ELEV-01/ELEV-02).

## Code Examples

Verified from source files:

### Current State — elevated.ts injection point (line 128-133)
```typescript
// Source: src/renderer/src/util/elevated.ts lines 128-133
let prog = `
  const __non_webpack_require__ = require;\n
  const __webpack_require__ = require;\n
  let moduleRoot = ${JSON.stringify(modulePaths)};\n
  let ipcPath = '${ipcPath}';\n
`;
```

### Current State — elevatedMain child connect (line 54)
```typescript
// Source: src/renderer/src/util/elevated.ts line 54 (inside elevatedMain, serialized)
client.connect(path.join("\\\\?\\pipe", ipcPath));
```

### Current State — fs.ts server listen (line 1077)
```typescript
// Source: src/renderer/src/util/fs.ts line 1077
.listen(path.join("\\\\?\\pipe", ipcPath));
```

### Current State — ExtensionManager.ts server listen (line 2889)
```typescript
// Source: src/renderer/src/ExtensionManager.ts line 2889
.listen(path.join("\\\\?\\pipe", ipcPath));
```

### Current State — symlink_activator_elevate startIPCServer (line 94)
```typescript
// Source: src/renderer/src/extensions/symlink_activator_elevate/index.ts line 94
.listen(path.join("\\\\?\\pipe", ipcPath))
```

### runElevated Call Sites (for IPC-04 audit)
```
Confirmed call sites of runElevated():
1. src/renderer/src/util/fs.ts:1078         — elevated() helper, user-triggered file ops
2. src/renderer/src/ExtensionManager.ts:2659 — runElevated() via startIPC(), user-triggered custom tools
3. src/renderer/src/extensions/symlink_activator_elevate/index.ts:566  — mod deployment
4. src/renderer/src/extensions/symlink_activator_elevate/index.ts:806  — mod deployment
5. src/renderer/src/extensions/symlink_activator_elevate/index.ts:930  — mod deployment
6. src/renderer/src/extensions/symlink_activator_elevate/index.ts:1057 — mod deployment

None are in main.ts, Application.ts, renderer.tsx, or any bootstrap/init code.
```

## Environment Availability

Step 2.6: SKIPPED — This phase is pure source code and documentation changes. No external tools, services, databases, or CLIs beyond what already exists in the development environment. All changes are to TypeScript source files.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `src/renderer/vitest.config.mts` |
| Quick run command | `pnpm -F @vortex/renderer vitest run src/renderer/src/util/ipc.test.ts` |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IPC-01 | `getIPCPath()` returns correct path per platform | unit | `pnpm -F @vortex/renderer vitest run src/renderer/src/util/ipc.test.ts` | ❌ Wave 0 |
| IPC-02 | Parent server `.listen()` uses platform-correct path | manual smoke | `pnpm run start` on Linux + attempt mod deployment | ❌ manual only |
| IPC-03 | Serialized child closure connects to Unix socket on Linux | manual smoke | Same as IPC-02 | ❌ manual only |
| IPC-04 | Audit document exists and answers scope questions | manual verification | Read audit doc | ❌ Wave 0 (doc task) |

### Sampling Rate
- **Per task commit:** `pnpm -F @vortex/renderer vitest run src/renderer/src/util/ipc.test.ts` (if test file exists)
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/renderer/src/util/ipc.test.ts` — covers IPC-01 (planner discretion: create or skip per CONTEXT.md)
- [ ] IPC-04 audit document — required as part of phase deliverables (written as markdown, not a test)

*(IPC-02 and IPC-03 are integration-level behaviors requiring a live Linux Electron process with mod deployment — no automated unit test is feasible for these in the current test infrastructure.)*

## Open Questions

1. **Unit test for getIPCPath — worth creating?**
   - What we know: The utility is a pure function with two branches; it's trivially testable. The CONTEXT.md explicitly marks this as "Claude's Discretion."
   - What's unclear: Whether the `process.platform` mocking complexity (read-only property) outweighs the benefit for a 4-line utility.
   - Recommendation: Create the test. The `vi.stubGlobal` pattern is established in the codebase (vitest). A 2-test file provides a regression guard at near-zero cost.

2. **symlink_activator_elevate client-side runElevated calls**
   - What we know: Lines 566, 806, 930, 1057 call `runElevated()` which in turn calls `getIPCPath()` via the patched `runElevated`. The client-side code (`runElevatedCustomTool.ts`) does not hardcode any pipe path — it receives the `ipc` socket as a parameter from `elevatedMain`.
   - What's unclear: Whether there are any other hardcoded pipe paths in the serialized functions passed as `func` to `runElevated()`.
   - Recommendation: The four call sites in symlink_activator_elevate pass `remoteCode` or local lambdas as the elevated function. Inspect each for hardcoded pipe paths before declaring IPC-03 done. Based on the codebase review, `runElevatedCustomTool.ts` (the only named elevated function) does not contain any pipe path references — it only uses the `ipcClient` passed to it.

## Sources

### Primary (HIGH confidence)
- `src/renderer/src/util/elevated.ts` — read in full; line numbers verified against actual source
- `src/renderer/src/util/fs.ts` — lines 1020-1093 read; `.listen` pattern confirmed at line 1077
- `src/renderer/src/ExtensionManager.ts` — lines 2858-2890 read; `.listen` pattern confirmed at line 2889
- `src/renderer/src/extensions/symlink_activator_elevate/index.ts` — lines 75-98 read; `startIPCServer()` confirmed at lines 80-98
- `src/renderer/src/util/runElevatedCustomTool.ts` — read in full; no hardcoded pipe paths found
- `src/renderer/vitest.config.mts` — read in full; test include pattern confirmed
- `.planning/codebase/TESTING.md` — test framework conventions confirmed
- `.planning/phases/05-ipc-and-elevation-audit/05-CONTEXT.md` — locked decisions authoritative

### Secondary (MEDIUM confidence)
- `grep runElevated` across `src/renderer/src` — all six call sites enumerated

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all changes are to Node.js built-ins already in use
- Architecture: HIGH — exact line numbers verified in source; no ambiguity in what to change
- Pitfalls: HIGH — identified from source code analysis of the serialization mechanism
- Validation: MEDIUM — IPC-02/03 require live Linux process; no automated coverage possible in unit test harness

**Research date:** 2026-03-31
**Valid until:** 2026-06-01 (stable domain; only invalidated if elevated.ts is refactored)
