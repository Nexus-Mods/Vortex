# Phase 2: winapi-bindings Shim - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Create a single TypeScript shim module at `src/renderer/src/util/winapi-shim.ts` that:
1. Intercepts all `winapi-bindings` imports on Linux via webpack alias (renderer) and rolldown alias (main)
2. Provides `GetDiskFreeSpaceEx` via `fs.statfs()` and `GetVolumePathName` via `stat.dev` walk
3. Stubs `ShellExecuteEx` with a clear error
4. Stubs all registry, process-list, file-ACL, and arch functions as no-ops or safe returns

All 18 import sites covered by the two build-system aliases — no per-file call-site guards needed.

Requirements in scope: WAPI-01, WAPI-02, WAPI-03, WAPI-04, WAPI-05.

</domain>

<decisions>
## Implementation Decisions

### D-01: Main Process Shim Coverage

- **D-01:** Rolldown gets the same alias as webpack, pointing to the same shim file (`src/renderer/src/util/winapi-shim.ts`). Both build systems are configured — one shim covers all 18 import sites across renderer and main process.
- **D-02:** `rolldown.base.mjs` `createConfig()` receives a platform-conditional `resolve.alias` entry: `"winapi-bindings"` → absolute path to `src/renderer/src/util/winapi-shim.ts` on Linux, no-op on Windows.

### D-03: Shim File Location

- **D-03:** Shim lives at `src/renderer/src/util/winapi-shim.ts` — per WAPI-01 spec. Webpack alias in `src/renderer/webpack.config.cjs` resolves this via `path.resolve(__dirname, "src", "util", "winapi-shim.ts")`. Rolldown alias in `rolldown.base.mjs` uses the same absolute path.

### D-04: Alias Activation (Platform-Conditional)

- **D-04:** Both aliases activate only when `process.platform === 'linux'` (or `LINUX` env/build flag at bundle time). Windows builds must not include the alias — `winapi-bindings` must resolve to the real native module on Windows.

### Claude's Discretion

- Exact shape of `GetVolumePathName` Linux implementation — WAPI-03 specifies `stat.dev` comparison; whether this uses `fs.statSync` walking up the directory tree or a simpler approximation is a planner/executor decision.
- Exact error type thrown by `ShellExecuteEx` stub — WAPI-04 requires "a clear error"; whether this is `new Error('elevation not supported on Linux')`, `new UserCanceled()`, or a named class is a planner decision.
- `RegGetValue` stub shape — WAPI-05 requires "safe stub"; whether it throws (callers all `try/catch`) or returns `{ type: 'REG_SZ', value: null }` is a planner decision. Callers in Steam.ts and Application.ts already handle both gracefully.
- How to pass the conditional alias into rolldown — the `createConfig()` function signature may need an optional `alias` parameter, or it may be injected at the call site in `build.mjs`.
- Import style compatibility: main.ts uses `import winapi from "winapi-bindings"` (default import) while renderer uses `import * as winapi from "winapi-bindings"`. The shim must export both a default export and named exports, or use `export =` syntax.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements

- `.planning/REQUIREMENTS.md` §WAPI-01 through §WAPI-05 — exact acceptance criteria for each shim function

### Files Being Modified

- `src/renderer/webpack.config.cjs` — add `resolve.alias` entry for `winapi-bindings` on Linux
- `rolldown.base.mjs` — add `resolve.alias` entry for `winapi-bindings` on Linux (shared by all rolldown builds)
- `src/main/build.mjs` — passes config through `createConfig()`; may need updating if alias is injected here

### Files Being Created

- `src/renderer/src/util/winapi-shim.ts` — the shim itself; replaces winapi-bindings on Linux for both processes

### Reference: Existing Test Mock

- `src/renderer/src/__mocks__/winapi-bindings.js` — existing Jest mock for winapi-bindings; shim must provide a superset of these exports (`ShellExecuteEx`, `RegGetValue`, `GetVolumePathName`), plus all other exports used in the real module

### Reference: Import Sites

All 18 import sites (both `import * as winapi` and `import winapi` default form):
- `src/main/src/main.ts` — default import; uses `SetProcessPreferredUILanguages` with optional chaining
- `src/main/src/Application.ts` — namespace import; uses `RegGetValue`, `GetVolumePathName`
- `src/renderer/src/renderer.tsx`
- `src/renderer/src/util/Steam.ts` — `RegGetValue` for Steam registry path
- `src/renderer/src/util/nativeArch.ts` — `GetNativeArch`
- `src/renderer/src/util/elevated.ts` — `ShellExecuteEx` for elevation
- `src/renderer/src/util/transferPath.ts` — `GetVolumePathName`
- `src/renderer/src/util/EpicGamesLauncher.ts` — lazy require; `RegGetValue`
- `src/renderer/src/util/GameStoreHelper.ts`
- `src/renderer/src/extensions/download_management/index.ts`
- `src/renderer/src/extensions/firststeps_dashlet/todos.tsx` — `GetDiskFreeSpaceEx`, `GetVolumePathName`
- `src/renderer/src/extensions/move_activator/index.ts`
- `src/renderer/src/extensions/symlink_activator_elevate/index.ts`
- `src/renderer/src/extensions/hardlink_activator/index.ts`
- `src/renderer/src/extensions/mod_management/stagingDirectory.ts`
- `src/renderer/src/extensions/mod_management/views/Settings.tsx`
- `src/renderer/src/extensions/installer_fomod_ipc/index.ts`
- `src/renderer/src/extensions/gamemode_management/util/discovery.ts` — `GetVolumePathName`

### Full Function Inventory (shim must export all)

Named exports used across codebase:
`GetDiskFreeSpaceEx`, `GetVolumePathName`, `ShellExecuteEx`, `RegGetValue`, `GetNativeArch`,
`SetProcessPreferredUILanguages`, `SetForegroundWindow`, `GetProcessList`, `GetProcessWindowList`,
`GetTasks`, `GetUserSID`, `CheckYourPrivilege`, `Privilege`, `AbortSystemShutdown`,
`InitiateSystemShutdown`, `SupportsAppContainer`, `RunTask`

Default export: the shim must also export a default (for `import winapi from "winapi-bindings"` in main.ts).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `src/renderer/src/__mocks__/winapi-bindings.js` — Jest mock defines the minimum viable surface: `ShellExecuteEx`, `RegGetValue`, `GetVolumePathName`. The shim extends this.
- `fs.statfs()` (Node.js 19+, available in Node 22) — use for `GetDiskFreeSpaceEx` stub (WAPI-02)
- `fs.statSync()` — use for synchronous `stat.dev` comparison in `GetVolumePathName` (WAPI-03)
- `process.arch` — available for `GetNativeArch` stub (returns `'x64'` for Vortex's Linux x64 target)

### Established Patterns

- `process.platform === 'linux'` guard — established in Phase 1; use in webpack/rolldown alias activation
- Optional chaining (`winapi?.method?.()`) — already used in main.ts for `SetProcessPreferredUILanguages`; the shim makes this unnecessary but doesn't break it
- `try/catch` around winapi calls — all `RegGetValue` and `ShellExecuteEx` callers already handle errors; shim that throws is safe

### Integration Points

- `src/renderer/webpack.config.cjs` `resolve` object — add `alias: { 'winapi-bindings': path.resolve(...) }` inside the existing `resolve` block
- `rolldown.base.mjs` `createConfig()` — add conditional `resolve.alias` to the `defineConfig()` call; activated by `process.platform === 'linux'` at build time
- `EpicGamesLauncher.ts` uses `lazyRequire(() => require("winapi-bindings"))` — the webpack alias handles `require()` calls too; no special handling needed

### Import Style Compatibility

- main.ts: `import winapi from "winapi-bindings"` → **default import** — shim needs `export default { ... }` or `export = { ... }`
- renderer: `import * as winapi from "winapi-bindings"` → **namespace import** — shim needs named exports
- Solution: export all functions as named exports AND re-export as default

</code_context>

<specifics>
## Specific Ideas

- The shim must handle both default and namespace import styles. A pattern like `export const GetDiskFreeSpaceEx = ...` plus `export default { GetDiskFreeSpaceEx, ... }` at the end covers both.
- `GetDiskFreeSpaceEx` on Linux: `fs.statfs(path)` returns `{ bsize, bfree, bavail, ... }`. Map `bavail * bsize` to `freeToCaller` (matching the Windows return shape that `firststeps_dashlet/todos.tsx` expects: `{ freeToCaller }`).
- `GetVolumePathName` callers expect a synchronous path string return. Use `fs.statSync` in a loop walking up the directory tree (synchronous is required — no `await` at call sites).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-winapi-bindings-shim*
*Context gathered: 2026-03-30*
