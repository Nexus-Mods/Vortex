# Phase 2: winapi-bindings Shim - Research

**Researched:** 2026-03-30
**Domain:** TypeScript module shim, Webpack/Rolldown alias configuration, Node.js fs APIs
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Main Process Shim Coverage**
- Rolldown gets the same alias as webpack, pointing to the same shim file (`src/renderer/src/util/winapi-shim.ts`). Both build systems are configured — one shim covers all 18 import sites across renderer and main process.

**D-02: Rolldown alias wiring**
- `rolldown.base.mjs` `createConfig()` receives a platform-conditional `resolve.alias` entry: `"winapi-bindings"` → absolute path to `src/renderer/src/util/winapi-shim.ts` on Linux, no-op on Windows.

**D-03: Shim File Location**
- Shim lives at `src/renderer/src/util/winapi-shim.ts`. Webpack alias in `src/renderer/webpack.config.cjs` resolves this via `path.resolve(__dirname, "src", "util", "winapi-shim.ts")`. Rolldown alias in `rolldown.base.mjs` uses the same absolute path.

**D-04: Alias Activation (Platform-Conditional)**
- Both aliases activate only when `process.platform === 'linux'` at bundle time. Windows builds must not include the alias — `winapi-bindings` must resolve to the real native module on Windows.

### Claude's Discretion

- Exact shape of `GetVolumePathName` Linux implementation — `stat.dev` comparison; whether this uses `fs.statSync` walking up the directory tree or a simpler approximation.
- Exact error type thrown by `ShellExecuteEx` stub — whether this is `new Error('elevation not supported on Linux')`, `new UserCanceled()`, or a named class.
- `RegGetValue` stub shape — whether it throws (callers all `try/catch`) or returns `{ type: 'REG_SZ', value: null }`.
- How to pass the conditional alias into rolldown — the `createConfig()` function signature may need an optional `alias` parameter, or it may be injected at the call site in `build.mjs`.
- Import style compatibility: main.ts uses `import winapi from "winapi-bindings"` (default import) while renderer uses `import * as winapi from "winapi-bindings"`. The shim must export both a default export and named exports, or use `export =` syntax.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WAPI-01 | webpack alias maps `winapi-bindings` → `./util/winapi-shim.ts` on Linux builds — no MODULE_NOT_FOUND crash | Webpack `resolve.alias` confirmed; `__dirname` relative path with `path.resolve` is the correct syntax; platform guard via `process.platform === 'linux'` |
| WAPI-02 | `GetDiskFreeSpaceEx` shim returns valid data via `fs.statfs()` — firststeps_dashlet renders without crashing | `fs.statfsSync` confirmed available in Node 22; return shape `{ total, free, freeToCaller }` mapped from `bavail * bsize` |
| WAPI-03 | `GetVolumePathName` shim returns correct path root via `stat.dev` comparison — firststeps_dashlet renders without crashing | `fs.statSync().dev` walk verified runnable on Linux; synchronous path required (callers use return value directly) |
| WAPI-04 | `ShellExecuteEx` shim throws a clear error on Linux | Caller in `elevated.ts` — all call sites already guard with try/catch; shim can throw named error |
| WAPI-05 | All remaining winapi-bindings exports shimmed as no-ops or safe stubs — no unhandled throw on import | Full export inventory documented from `index.d.ts`; return shapes and caller patterns analysed |
</phase_requirements>

---

## Summary

Phase 2 creates a single TypeScript shim at `src/renderer/src/util/winapi-shim.ts` that replaces `winapi-bindings` on Linux via build-system aliases. The webpack alias is added to `src/renderer/webpack.config.cjs`; the rolldown alias is added to `rolldown.base.mjs`. Both activate conditionally on `process.platform === 'linux'` at build time, leaving Windows untouched.

The shim must satisfy two distinct concerns: (1) functional stubs for `GetDiskFreeSpaceEx` and `GetVolumePathName` that use Node.js native APIs so the `firststeps_dashlet` renders correctly on first launch, and (2) safe no-ops or throwing stubs for the remaining 15+ functions so the app loads without an unhandled exception.

The critical compatibility constraint is export style: `src/main/src/main.ts` uses a default import (`import winapi from "winapi-bindings"`) while all renderer files use namespace imports (`import * as winapi from "winapi-bindings"`). The shim must export both named exports and a default object to satisfy both call patterns through the same module file.

**Primary recommendation:** Write `winapi-shim.ts` with all named exports plus `export default { ...all named exports }` at the end. Add the alias to both build configs behind a `process.platform === 'linux'` guard. Extend `createConfig()` in `rolldown.base.mjs` with an optional `alias` parameter.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `fs` built-in | 22.22.0 (in use) | `statfsSync` for disk space, `statSync` for volume path walk | Already in runtime; no dependency needed |
| TypeScript | 5.9.3 (in use) | Shim authored as `.ts` — type-safe against `index.d.ts` | Already in toolchain |
| Webpack 5 | 5.94.0 (in use) | `resolve.alias` for renderer bundle Linux redirect | Already configured in `webpack.config.cjs` |
| Rolldown | 1.0.0-rc.9 (in use) | `resolve.alias` for main process bundle Linux redirect | Already configured in `rolldown.base.mjs` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `winapi-bindings` `index.d.ts` | installed | Type source for shim interface | Reference only — shim implements the types without the native module |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `fs.statfsSync` | `diskusage` npm package | `diskusage` is already a dependency but `fs.statfsSync` is zero-dep and available in Node 22 |
| Walking `stat.dev` for volume path | Always return `path.parse(p).root` | `path.parse(p).root` always returns `/` on Linux; `stat.dev` walk is more accurate for future bind-mount scenarios and matches the WAPI-03 spec |

**Installation:** No new packages required.

---

## Architecture Patterns

### Files Being Modified

```
src/renderer/webpack.config.cjs        # Add resolve.alias on Linux
rolldown.base.mjs                      # Add resolve.alias parameter to createConfig()
src/main/build.mjs                     # Pass alias to createConfig() on Linux
```

### Files Being Created

```
src/renderer/src/util/winapi-shim.ts   # The shim — single file, covers both processes
```

### Pattern 1: Webpack Platform-Conditional Alias

**What:** Add an `alias` key to the existing `resolve` block in `webpack.config.cjs`, guarded by `process.platform`.

**When to use:** Renderer process bundle only; `webpack.config.cjs` uses CommonJS so `process.platform` is evaluated at build time.

**Example:**

```javascript
// src/renderer/webpack.config.cjs — inside the config object
resolve: {
  plugins: [new TsconfigPathsPlugin()],
  extensions: [".js", ".jsx", ".ts", ".tsx", ".json"],
  // ADD THIS:
  ...(process.platform === "linux" && {
    alias: {
      "winapi-bindings": path.resolve(
        __dirname, "src", "util", "winapi-shim.ts"
      ),
    },
  }),
},
```

### Pattern 2: Rolldown Optional Alias Parameter

**What:** Extend `createConfig()` in `rolldown.base.mjs` to accept an optional `alias` parameter and spread it into the `resolve` key.

**When to use:** Main process bundle — `build.mjs` calls `createConfig()` and must pass alias on Linux.

**Rolldown `resolve.alias` type (verified from source):**

```typescript
// From rolldown/dist/shared/define-config-cG45vHwf.d.mts line 3272+
resolve?: {
  alias?: Record<string, string[] | string | false>;
  // ...
}
```

**Example:**

```javascript
// rolldown.base.mjs — updated createConfig signature
export function createConfig(
  input,
  output,
  format,
  customPlugins = [],
  external = undefined,
  alias = undefined,          // NEW optional param
) {
  return defineConfig({
    input,
    platform: "node",
    plugins: customPlugins,
    external,
    resolve: alias ? { alias } : undefined,   // NEW conditional
    // ... rest unchanged
  });
}
```

```javascript
// src/main/build.mjs — pass alias on Linux
const linuxAlias = process.platform === "linux"
  ? { "winapi-bindings": path.resolve(import.meta.dirname, "../../src/renderer/src/util/winapi-shim.ts") }
  : undefined;

const config = createConfig(INPUT, OUTPUT, "cjs", [], externalFn, linuxAlias);
```

### Pattern 3: Dual-Export Shim Structure

**What:** Named exports for namespace imports (`import * as winapi`) plus a default re-export for default imports (`import winapi from`).

**When to use:** Required because `main.ts` uses default import and renderer uses namespace import — same shim must satisfy both.

```typescript
// src/renderer/src/util/winapi-shim.ts — structural pattern
import * as fs from "fs";
import * as path from "path";

// --- Functional stubs (WAPI-02, WAPI-03) ---
export function GetDiskFreeSpaceEx(filePath: string): { total: number; free: number; freeToCaller: number } {
  const stats = fs.statfsSync(filePath);
  const freeToCaller = stats.bavail * stats.bsize;
  const free = stats.bfree * stats.bsize;
  const total = stats.blocks * stats.bsize;
  return { total, free, freeToCaller };
}

export function GetVolumePathName(filePath: string): string {
  const targetDev = fs.statSync(filePath).dev;
  let current = path.resolve(filePath);
  while (true) {
    const parent = path.dirname(current);
    if (parent === current) return current;  // reached filesystem root
    if (fs.statSync(parent).dev !== targetDev) return current;
    current = parent;
  }
}

// --- Throwing stub (WAPI-04) ---
export function ShellExecuteEx(_options: unknown): void {
  throw new Error("ShellExecuteEx is not supported on Linux");
}

// --- Safe no-op stubs (WAPI-05) ---
export function RegGetValue(_hive: unknown, _path: string, _key: string) {
  return undefined;
}
export function GetNativeArch() {
  return { nativeMachineCode: 0, nativeArch: process.arch, usedFallback: false };
}
export function SetProcessPreferredUILanguages(_langs: string[]): void { /* no-op */ }
// ... (all remaining exports from index.d.ts)

// Default export for `import winapi from "winapi-bindings"` (main.ts pattern)
const winapiShim = {
  GetDiskFreeSpaceEx,
  GetVolumePathName,
  ShellExecuteEx,
  RegGetValue,
  GetNativeArch,
  SetProcessPreferredUILanguages,
  // ... all others
};
export default winapiShim;
```

### Anti-Patterns to Avoid

- **Partial export coverage:** Any named export missing from the shim causes a runtime crash when that import site is reached — even if that function is behind a `process.platform === 'win32'` guard at the call site, the module must still load cleanly.
- **Async implementation of `GetVolumePathName`:** All call sites use the return value directly in synchronous context (see `todos.tsx` lines 99, 132; `discovery.ts` line 857). `statfsSync` and `statSync` must be used — not their promise variants.
- **Using `import.meta.dirname` in `build.mjs` for the shim path:** `import.meta.dirname` in `build.mjs` resolves to `src/main/` — the relative path to `winapi-shim.ts` is `../../src/renderer/src/util/winapi-shim.ts` from there. Use `path.resolve(import.meta.dirname, "../../src/renderer/src/util/winapi-shim.ts")`.
- **Skipping the default export:** Forgetting `export default` causes `import winapi from "winapi-bindings"` in `main.ts` to receive `undefined`, making the optional-chained call `winapi?.SetProcessPreferredUILanguages?.()` silently do nothing — which appears correct but hides a missing export.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Disk free space query | Custom `/proc/mounts` parser | `fs.statfsSync(path)` | Built into Node 22; handles bind mounts, overlay fs, and tmpfs correctly |
| Volume/mount point detection | `df -P` child process | `fs.statSync(p).dev` comparison walk | Synchronous, no subprocess, same semantic result (mount boundary detection) |
| Module aliasing | Per-file `process.platform` guards at every import site | Webpack `resolve.alias` + Rolldown `resolve.alias` | One config change covers all 18 import sites without touching any source file |

**Key insight:** Build-system aliasing is strictly superior to per-file guards for this pattern — it requires zero changes to the 18 import sites and is invisible to Windows builds.

---

## Common Pitfalls

### Pitfall 1: `GetVolumePathName` Called on a Non-Existent Path

**What goes wrong:** `firststeps_dashlet/todos.tsx` calls `GetVolumePathName(props.dlPath)` where `dlPath` is from Redux state and may be set to a path that doesn't yet exist (e.g., a newly configured staging folder). `fs.statSync` throws `ENOENT`.

**Why it happens:** The function is called before the directory is created.

**How to avoid:** Wrap the `statSync` call in a try/catch and fall back to `path.parse(filePath).root` on `ENOENT`. The caller in `todos.tsx` (line 99) has its own try/catch that rethrows, and the outer component catches it and returns `t("<Invalid Drive>")`, so throwing is also safe — but the fallback provides better UX.

**Warning signs:** `<Invalid Drive>` appearing in the firststeps dashboard when a valid path is configured.

### Pitfall 2: `statfsSync` Path Must Exist

**What goes wrong:** `fs.statfsSync` throws `ENOENT` if the path doesn't exist, unlike the Windows `GetDiskFreeSpaceEx` which accepts a path to a drive root.

**Why it happens:** `GetDiskFreeSpaceEx` in `todos.tsx` is called via `minDiskSpace()` which guards `checkPath === undefined` but not `ENOENT`.

**How to avoid:** Wrap `statfsSync` in try/catch inside `GetDiskFreeSpaceEx` and let the exception propagate — `minDiskSpace()` already catches and returns `false` (line 33: `catch (err) { return false; }`).

**Warning signs:** Dashboard showing no disk space warning on a full drive — indicates the catch branch was hit silently.

### Pitfall 3: Rolldown Alias Format Difference from Webpack

**What goes wrong:** Webpack `resolve.alias` values are strings: `{ "winapi-bindings": "/abs/path/to/shim.ts" }`. Rolldown `resolve.alias` values can be strings OR arrays: `Record<string, string[] | string | false>`. Using the wrong format causes a type error or silent failure.

**Why it happens:** The two bundlers have different internal resolver implementations (Rolldown uses oxc-resolver which inherits from enhanced-resolve).

**How to avoid:** Use a plain string for the alias value in both cases — the string form is supported by both.

**Warning signs:** TypeScript compile error in `rolldown.base.mjs` if types are imported, or `UNRESOLVED_IMPORT` error during rolldown build.

### Pitfall 4: `lazyRequire` Import Site in EpicGamesLauncher.ts

**What goes wrong:** `EpicGamesLauncher.ts` uses `lazyRequire(() => require("winapi-bindings"))` instead of a static import. Some bundler alias implementations only intercept static `import` statements.

**Why it happens:** The file was written to defer loading the native module.

**How to avoid:** Webpack aliases intercept both `import` and `require()` calls — no special handling needed. The alias resolves at bundle time regardless of import form.

**Warning signs:** `MODULE_NOT_FOUND` error thrown at runtime from `EpicGamesLauncher.ts` despite the alias being in place — would indicate the alias is not intercepting dynamic `require()`.

### Pitfall 5: `SHGetKnownFolderPath` and Windows-Specific Functions Not Listed in CONTEXT.md

**What goes wrong:** CONTEXT.md lists 17 named exports required by the shim. The actual `index.d.ts` exposes additional functions (`SHGetKnownFolderPath`, `WalkDir`, `AddFileACE`, `GetFileVersionInfo`, `WhoLocks`, `GetModuleList`, `CreateAppContainer`, etc.) that are not explicitly called in the 18 import sites but are part of the module surface.

**Why it happens:** The module is loaded as a whole — TypeScript destructuring means unused exports don't cause errors. However, if any calling code uses a function not stubbed at runtime, it will throw.

**How to avoid:** Stub the full public surface from `index.d.ts`, not just the 17 listed in CONTEXT.md. Mark infrequently-called functions as no-ops or returning `undefined`.

**Warning signs:** Runtime `TypeError: winapi.SomeFunction is not a function` from any import site.

---

## Full Function Inventory (from `index.d.ts`)

The following is the complete function surface of `winapi-bindings`. The shim must export all of them.

### Functional (Implement with real Linux equivalent)

| Function | Return Shape | Linux Implementation | Notes |
|----------|-------------|---------------------|-------|
| `GetDiskFreeSpaceEx(filePath)` | `{ total: number, free: number, freeToCaller: number }` | `fs.statfsSync(p)` → `bavail*bsize` = freeToCaller | WAPI-02 |
| `GetVolumePathName(filePath)` | `string` (mount point path) | `stat.dev` walk up directory tree | WAPI-03; must be sync |
| `GetNativeArch()` | `{ nativeMachineCode: number, nativeArch: string, usedFallback: boolean }` | `{ nativeMachineCode: 0, nativeArch: process.arch, usedFallback: false }` | `process.arch` returns `'x64'` on Linux x64 |
| `SetProcessPreferredUILanguages(langs)` | `void` | No-op (Electron handles i18n on Linux) | Optional-chained at call site |

### Throwing Stub (Clear error, callers handle it)

| Function | Reason to Throw | Call Sites |
|----------|----------------|------------|
| `ShellExecuteEx(opts)` | Elevation not supported on Linux in Phase 2 | `elevated.ts` — callers catch and handle gracefully |
| `CreateTask`, `RunTask`, `StopTask`, `DeleteTask` | Windows Task Scheduler API | No Linux call sites found; safe to throw |
| `InitiateSystemShutdown`, `AbortSystemShutdown` | Windows-specific shutdown API | No Linux call sites found |
| `CreateAppContainer`, `DeleteAppContainer`, `GrantAppContainer`, `RunInContainer` | Windows app container API | No Linux call sites found |
| `CreateProcessWithIntegrity` | Windows process integrity levels | No Linux call sites found |
| `AddUserPrivilege`, `RemoveUserPrivilege`, `GetUserPrivilege` | Windows privilege manipulation | Elevated process only |

### No-Op / Null-Return Stubs (callers handle undefined/null gracefully)

| Function | Safe Return | Notes |
|----------|------------|-------|
| `RegGetValue(hive, path, key)` | `undefined` (throw is also safe) | All callers are wrapped in try/catch |
| `RegSetKeyValue` | `void` | Setter, no callers on Linux startup path |
| `RegEnumKeys(hkey)` | `[]` | No callers on Linux startup path |
| `RegEnumValues(hkey)` | `[]` | No callers on Linux startup path |
| `WithRegOpen(hive, path, cb)` | Call `cb` with null/never call it | No callers on Linux startup path |
| `GetProcessList()` | `[]` | No startup-path callers |
| `GetModuleList(pid)` | `[]` | No startup-path callers |
| `GetProcessWindowList(pid)` | `[]` | No startup-path callers |
| `SetForegroundWindow(hwnd)` | `false` | No startup-path callers |
| `GetUserSID()` | `""` | Callers check for truthy value |
| `LookupAccountName(name)` | `undefined` | No startup-path callers |
| `CheckYourPrivilege()` | `[]` | Returns empty privilege list |
| `GetTasks(path?)` | `[]` | No startup-path callers |
| `SupportsAppContainer()` | `false` | Windows 8+ feature check |
| `IsThisWine()` | `false` | Linux native, not Wine |
| `WhoLocks(filePath)` | `[]` | File lock query |
| `WalkDir(basePath, progress, ...)` | Call `cb(null)` immediately | Used by turbowalk replacement |
| `SetFileAttributes(filePath, attrs)` | `void` | No-op; Linux uses chmod |
| `AddFileACE(acc, filePath)` | `void` | No-op; Linux uses chmod/setfacl |
| `GetFileVersionInfo(filePath)` | `undefined` or throw | PE/DLL format; no Linux callers |
| `GetProcessToken(type, pid?)` | `{ isElevated: false }` | Callers use for elevation check |
| `GetPrivateProfileSection`, `GetPrivateProfileSectionNames`, `GetPrivateProfileString`, `WritePrivateProfileString` | `""` / `[]` / no-op | INI file operations; callers typically have Linux alternatives |
| `SHGetKnownFolderPath(folder, flag?)` | `""` or throw | Windows known folder paths; no Linux equivalents |
| `GetSystemPreferredUILanguages()`, `GetUserPreferredUILanguages()`, `GetProcessPreferredUILanguages()` | `[]` | Language preference; Electron handles on Linux |

---

## Code Examples

### GetDiskFreeSpaceEx Implementation

```typescript
// Source: Node.js docs (https://nodejs.org/api/fs.html#fsstatfssyncpath-options)
// Verified: fs.statfsSync available Node 19+, confirmed present in Node 22.22.0
import * as fs from "fs";

export function GetDiskFreeSpaceEx(
  filePath: string
): { total: number; free: number; freeToCaller: number } {
  const stats = fs.statfsSync(filePath);
  return {
    total: stats.blocks * stats.bsize,
    free: stats.bfree * stats.bsize,
    freeToCaller: stats.bavail * stats.bsize,
  };
}
```

`bavail` (blocks available to unprivileged users) maps to `freeToCaller` — the value that `firststeps_dashlet` uses for the disk space warning check.

### GetVolumePathName Implementation

```typescript
// Source: CONTEXT.md D-03 spec + verification (stat.dev walk confirmed correct on Linux)
import * as fs from "fs";
import * as path from "path";

export function GetVolumePathName(filePath: string): string {
  const targetDev = fs.statSync(filePath).dev;
  let current = path.resolve(filePath);
  while (true) {
    const parent = path.dirname(current);
    if (parent === current) return current;          // at filesystem root
    try {
      if (fs.statSync(parent).dev !== targetDev) {
        return current;                              // crossed a mount boundary
      }
    } catch {
      return current;                               // parent inaccessible
    }
    current = parent;
  }
}
```

Manual verification on this machine: `getVolumePathName('/tmp')` returns `/`, `getVolumePathName('/home')` returns `/`. On a system with `/home` on a separate partition it would return `/home`.

### Rolldown createConfig with alias

```javascript
// rolldown.base.mjs — extended signature
export function createConfig(
  input,
  output,
  format,
  customPlugins = [],
  external = undefined,
  alias = undefined,        // optional: Record<string, string>
) {
  return defineConfig({
    input,
    platform: "node",
    plugins: customPlugins,
    external,
    ...(alias && { resolve: { alias } }),
    // ... rest unchanged
  });
}
```

```javascript
// src/main/build.mjs — platform-conditional alias injection
import * as path from "node:path";
import { rolldown } from "rolldown";
import { createConfig, mainOutputDirectory } from "../../rolldown.base.mjs";

const INPUT = path.resolve(import.meta.dirname, "src", "main.ts");
const OUTPUT = path.join(mainOutputDirectory, "main.cjs");

const SHIM_PATH = path.resolve(
  import.meta.dirname,
  "../../src/renderer/src/util/winapi-shim.ts",
);

const linuxAlias =
  process.platform === "linux"
    ? { "winapi-bindings": SHIM_PATH }
    : undefined;

const config = createConfig(INPUT, OUTPUT, "cjs", [], externalFn, linuxAlias);
```

### Webpack alias addition

```javascript
// src/renderer/webpack.config.cjs — inside the config object's resolve block
resolve: {
  plugins: [new TsconfigPathsPlugin()],
  extensions: [".js", ".jsx", ".ts", ".tsx", ".json"],
  ...(process.platform === "linux" && {
    alias: {
      "winapi-bindings": path.resolve(
        __dirname,
        "src",
        "util",
        "winapi-shim.ts",
      ),
    },
  }),
},
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-file `process.platform` guards at every call site | Build-system alias — one config change | Phase 2 decision | 18 import sites untouched |
| `fs.statfs` (callback) | `fs.statfsSync` (synchronous) | Node 19+ | Required for synchronous call sites |

**Deprecated/outdated:**

- `require('diskusage')` for disk space: already a project dependency but unnecessary here since `fs.statfsSync` provides the same data without an extra module.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js `fs.statfsSync` | `GetDiskFreeSpaceEx` shim | Yes | Node 22.22.0 | None needed |
| Node.js `fs.statSync` | `GetVolumePathName` shim | Yes | Node 22.22.0 | None needed |
| `process.platform` at build time | Webpack/Rolldown alias guard | Yes | Always available | None needed |
| TypeScript compiler | Building `winapi-shim.ts` | Yes | 5.9.3 | None needed |

No missing dependencies.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `src/renderer/vitest.config.mts` |
| Quick run command | `pnpm --filter renderer test -- src/util/winapi-shim.test.ts` |
| Full suite command | `pnpm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WAPI-01 | No MODULE_NOT_FOUND at startup | smoke (build verification) | `pnpm run build && node src/main/out/main.cjs --version 2>&1 \| grep -v MODULE_NOT_FOUND` | N/A (build artifact) |
| WAPI-02 | `GetDiskFreeSpaceEx` returns `{ freeToCaller: number > 0 }` | unit | `pnpm --filter renderer test -- src/util/winapi-shim.test.ts` | Wave 0 gap |
| WAPI-03 | `GetVolumePathName('/tmp/somefile')` returns `/` | unit | same | Wave 0 gap |
| WAPI-04 | `ShellExecuteEx({})` throws | unit | same | Wave 0 gap |
| WAPI-05 | All 17 named exports are functions | unit | same | Wave 0 gap |

### Sampling Rate

- **Per task commit:** `pnpm --filter renderer test -- src/util/winapi-shim.test.ts`
- **Per wave merge:** `pnpm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/renderer/src/util/winapi-shim.test.ts` — covers WAPI-02, WAPI-03, WAPI-04, WAPI-05
  - Test: `GetDiskFreeSpaceEx('/tmp')` returns `{ total, free, freeToCaller }` with all numbers > 0
  - Test: `GetVolumePathName('/tmp')` returns a non-empty string
  - Test: `ShellExecuteEx({})` throws
  - Test: All named exports are typeof function (or valid constant)
  - Test: Default export contains the same named exports

Note: WAPI-01 (alias activation) is a build-level test, not a unit test. Confirmed by running `pnpm run build` on Linux and checking `src/main/out/main.cjs` does not contain the string `"winapi-bindings"` as a require call.

---

## Project Constraints (from CLAUDE.md)

- Windows build must never break — platform guards, not replacements (alias is Linux-only, evaluated at build time)
- Prefer small, additive changes — the shim is a new file; build config diffs are minimal
- No new runtime dependencies that affect Windows — `fs.statfsSync` is Node built-in, zero new packages
- TypeScript code style: named exports preferred; `const` preferred; explicit return types; double quotes; semicolons required
- Error handling: typed error classes or `new Error(msg)` with descriptive message; log context strings
- Follow `src/renderer/src/util/` naming conventions: camelCase filename (`winapi-shim.ts`)
- `@typescript-eslint/consistent-type-imports`: type imports must use `import type` syntax

---

## Open Questions

1. **`SHGetKnownFolderPath` call sites**
   - What we know: It is not in the 18 listed import sites but is in the module's public API
   - What's unclear: Whether any bundled extension (outside `src/`) imports and calls it on startup
   - Recommendation: Stub as throwing `new Error("SHGetKnownFolderPath not available on Linux")` — a safe conservative choice

2. **`WalkDir` stub completeness**
   - What we know: `WalkDir` uses a callback pattern; stubbing it as `cb(null)` (no entries) is safe for startup
   - What's unclear: Whether any startup-critical code path depends on WalkDir finding at least one entry
   - Recommendation: Stub as immediate `cb(null)` call with empty progress results; revisit if game discovery fails silently

3. **`GetPrivateProfileString` / INI functions**
   - What we know: These parse Windows-style INI files (`.ini` sections); on Linux there may be valid use cases for reading Bethesda game INI files
   - What's unclear: Whether any startup path reads INI before the user selects a game
   - Recommendation: Stub as returning empty string / empty array for now (safe stubs per WAPI-05); Phase 2 does not require INI functionality on Linux

---

## Sources

### Primary (HIGH confidence)

- `src/renderer/node_modules/winapi-bindings/index.d.ts` — complete function inventory and type signatures, verified directly
- `rolldown.base.mjs` — current `createConfig()` signature, verified directly
- `src/renderer/webpack.config.cjs` — existing `resolve` block structure, verified directly
- `src/main/build.mjs` — `createConfig()` call site, verified directly
- Node.js 22 built-in `fs` module — `statfsSync`/`statSync` availability confirmed by running `node -e "..."` on this machine
- `node_modules/.pnpm/rolldown@1.0.0-rc.9/.../define-config-cG45vHwf.d.mts` line 3272 — `resolve.alias` type confirmed as `Record<string, string[] | string | false>`

### Secondary (MEDIUM confidence)

- `src/renderer/src/__mocks__/winapi-bindings.js` — Jest mock shows minimum viable surface; shim extends this
- `src/renderer/src/extensions/firststeps_dashlet/todos.tsx` lines 31, 99, 132 — exact call sites and return value usage confirmed
- `src/main/src/Application.ts` line 507 — `RegGetValue` call site with try/catch confirmed
- `src/renderer/src/util/nativeArch.ts` — `GetNativeArch` call site with try/catch confirmed

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all versions and APIs verified from installed packages and Node runtime
- Architecture: HIGH — all four files to be modified read and understood; rolldown alias type confirmed from type definitions
- Pitfalls: HIGH — derived from direct code reading of call sites, not speculation
- Function inventory: HIGH — taken verbatim from `index.d.ts`, not from documentation or training data

**Research date:** 2026-03-30
**Valid until:** 2026-06-30 (stable APIs: Node built-ins, Webpack 5 alias, Rolldown resolve.alias)
