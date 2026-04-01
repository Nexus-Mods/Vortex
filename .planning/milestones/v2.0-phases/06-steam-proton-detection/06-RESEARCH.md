# Phase 6: Steam/Proton Detection - Research

**Researched:** 2026-03-31
**Domain:** Steam/Proton Linux integration — VDF parsing, multi-root scan, Wine prefix paths, game extension audit
**Confidence:** HIGH — all findings from direct codebase inspection

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**STAM-01: VDF parsing validation**
- D-01: STAM-01 is validate-only. `Steam.ts` already parses `libraryfolders.vdf` and `appmanifest_*.acf`. Confirm via test run / manual verification pass; no code changes expected.

**STAM-02: Multi-root Steam scanning**
- D-02: Change `findLinuxSteamPath()` (or add parallel `findAllLinuxSteamPaths(): string[]`) to enumerate ALL valid Steam roots, not just first hit.
- D-03: `Steam.ts` constructor: set `mBaseFolder` to primary root (first valid hit, existing behavior) but separately enumerate all roots for `resolveSteamPaths()` so `libraryfolders.vdf` is read from each root.
- D-04: Deduplicate by `appid` — when same game appears in both Flatpak and native, keep first occurrence.

**STAM-03: Never-launched game Proton detection**
- D-05: Supplement `detectProtonUsage()` with `oslist` ACF field check: if `AppState.oslist` does NOT contain `"linux"`, game will use Proton even if `compatdata/<appid>/` doesn't exist yet.
- D-06: For never-launched Proton games: return `usesProton: true` with pre-populated `compatDataPath` — even if directory doesn't exist.
- D-07: `protonPath` may be `undefined` for never-launched games — acceptable; callers handle `protonPath: undefined`.

**STAM-04: `{mygames}` Wine prefix path fix**
- D-08: Add `getMyGamesPath(steamEntry: ISteamEntry): Promise<string>` to `proton.ts`. On Linux with `steamEntry.usesProton === true`: return `compatDataPath + "/pfx/drive_c/users/steamuser/Documents/My Games"` using constant `PROTON_USERNAME = "steamuser"`. Fallback: return `path.join(os.homedir(), "Documents", "My Games")`.
- D-09: Make `iniFiles()` in `gameSupport.ts` async — returns `Promise<string[]>`. (NOTE: this applies to `ini_prep/gameSupport.ts`, not `local-gamesettings/gameSupport.ts`)
- D-10: In `iniFiles()`, add Linux platform guard: `if (process.platform === 'linux' && steamEntry?.usesProton)` → call `getMyGamesPath(steamEntry)`.
- D-11: Fallback when `steamEntry` absent or `usesProton` false: use existing behavior unchanged.
- D-12: Export `PROTON_USERNAME = "steamuser"` as named constant from `proton.ts`.

**STAM-05: Top-4 game extension audit**
- D-13: Skyrim SE and Fallout 4 inherit STAM-04. Audit both after STAM-04 implemented.
- D-14: Cyberpunk 2077 — `index.js` has no winapi-bindings usage; confirmed unblocked.
- D-15: Stardew Valley — native Linux game. Confirmed unblocked; validate by inspection.
- D-16: Fallout 4 scope: `extensions/games/game-fallout4/src/index.js:4` has `const winapi = require('winapi-bindings')`. Verify whether Phase 2 webpack alias reaches bundled game extension context. **If alias doesn't reach it: fix in Phase 6**.

### Claude's Discretion
- Whether to add `findAllLinuxSteamPaths()` as new function or rename/extend existing `findLinuxSteamPath()` — keep backward compat for external callers.
- Exact signature for threading `steamEntry` into async `iniFiles()`.
- Unit test scope for `getMyGamesPath()`.
- Whether `oslist` check uses `includes("linux")` or `!== "linux"` — be precise; some games list multiple OSes.

### Deferred Ideas (OUT OF SCOPE)
- Fallout 4 winapi fix (if webpack scope confirmed) — moot if alias already covers it.
- Cyberpunk 2077 native Linux detection.
- SMAPI Linux installer validation for Stardew Valley.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STAM-01 | Steam game library VDF parsing works on Linux (native Steam install paths) | Validate-only: `Steam.ts` + `steamPaths.ts` already operational; `findLinuxSteamPath()` reads `config/libraryfolders.vdf` as the validity check |
| STAM-02 | All valid Steam library roots scanned; Flatpak paths resolved; dual-install handled | `findLinuxSteamPath()` stops at first hit; `resolveSteamPaths()` only reads vdf from `mBaseFolder`; need new `findAllLinuxSteamPaths(): string[]` + multi-root iteration in `resolveSteamPaths()` |
| STAM-03 | Proton prefix resolved per-game; never-launched games detected via `oslist` ACF field | `detectProtonUsage()` only checks if `compatdata/<appid>/` exists; must add `oslist` check to `parseManifests()` → `getProtonInfo()` path; `oslist` field is already parsed in ACF |
| STAM-04 | `{mygames}` resolves to correct Wine prefix location on Linux | Two separate `gameSupport.ts` files: `local-gamesettings` has sync `mygamesPath()` with wrong path (`"My Documents"` not `"Documents"`); `ini_prep` has sync `iniFiles()` using `{mygames}` template variable with no Linux guard |
| STAM-05 | Top-4 extensions confirmed working: Skyrim SE, Fallout 4, Cyberpunk 2077, Stardew Valley | Fallout 4 has dead `require('winapi-bindings')` at line 4 (imported, never used); webpack alias doesn't reach bundled extensions; Cyberpunk is a stub with no winapi; Stardew is native Linux |
</phase_requirements>

## Summary

Phase 6 is predominantly a correctness-fix and validation phase with ~80% of the foundation already present. The codebase has full Steam VDF parsing (`Steam.ts`), candidate Flatpak path enumeration (`steamPaths.ts`), and Proton detection infrastructure (`proton.ts`). Four specific gaps require code changes.

The most critical finding is that there are TWO separate `gameSupport.ts` files with different responsibilities: `extensions/local-gamesettings/src/util/gameSupport.ts` owns `mygamesPath()` (used by the game settings UI), while `src/renderer/src/extensions/ini_prep/gameSupport.ts` owns `iniFiles()` (used by INI tweak baking). The CONTEXT.md decisions (D-08 through D-12) primarily apply to `ini_prep/gameSupport.ts` for STAM-04. However, `local-gamesettings/gameSupport.ts` already HAS a Linux platform guard in its `mygamesPath()` function (lines 150-182) but uses the wrong path segment `"My Documents"` — the correct Wine prefix path is `pfx/drive_c/users/steamuser/Documents/My Games` not `pfx/drive_c/users/steamuser/My Documents/My Games`.

For STAM-05, the Fallout 4 extension has `const winapi = require('winapi-bindings')` at line 4 that is imported but never used anywhere in the file — this is dead code that causes MODULE_NOT_FOUND on Linux. The webpack alias that was implemented in Phase 2 is in `src/renderer/webpack.config.cjs` and only applies to the renderer bundle; bundled game extensions use `copyfiles` (no webpack), so the alias never applies to them.

**Primary recommendation:** STAM-04 has two separate fix points — both `local-gamesettings/gameSupport.ts` (path segment bug) and `ini_prep/gameSupport.ts` (no Linux guard at all). Both must be fixed. STAM-05 Fallout 4 fix is removing a dead import.

## Standard Stack

### Core (already present — no new installations needed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `simple-vdf` | (workspace) | Parse Steam VDF/ACF files | Already imported in `Steam.ts` and `proton.ts` |
| `bluebird` | 3.7.2 | Promise utilities; `PromiseBB.map/mapSeries` used in `Steam.ts` | Already used throughout |
| `path` | (node built-in) | Path construction for Wine prefix paths | Used everywhere |
| `fs` (vortex wrapper) | — | `statAsync`, `readFileAsync`, `readdirAsync` | Already imported in all relevant files |

**No new npm packages required for this phase.**

### Test Infrastructure

| Tool | Config File | Run Command |
|------|-------------|-------------|
| Vitest 4.1.0 | `src/renderer/vitest.config.mts` | `pnpm run test` (project: `./src/renderer`) |
| Root vitest | `vitest.config.ts` | `pnpm run test` (runs all projects) |

Test files go in `src/renderer/src/util/linux/` as `*.test.ts` — matches the `include: ["src/**/*.test.{ts,tsx}"]` pattern in renderer vitest config.

## Architecture Patterns

### Recommended Project Structure (files to modify)

```
src/renderer/src/util/linux/
├── steamPaths.ts           # STAM-02: add findAllLinuxSteamPaths(): string[]
├── proton.ts               # STAM-03/04: add oslist check, PROTON_USERNAME, getMyGamesPath()
└── proton.test.ts          # NEW: unit tests for getMyGamesPath() (Wave 0 gap)

src/renderer/src/util/
└── Steam.ts                # STAM-02: resolveSteamPaths() iterates all roots + dedup

src/renderer/src/extensions/ini_prep/
└── gameSupport.ts          # STAM-04: make iniFiles() async + Linux guard

extensions/local-gamesettings/src/util/
└── gameSupport.ts          # STAM-04: fix "My Documents" → "Documents" path segment

extensions/games/game-fallout4/src/
└── index.js                # STAM-05: remove dead require('winapi-bindings') at line 4
```

### Pattern 1: `findAllLinuxSteamPaths()` (STAM-02)

**What:** Add a function that returns ALL valid Steam roots, not just the first.
**When to use:** Called from `Steam.ts` constructor and `resolveSteamPaths()`.
**Key insight:** `getLinuxSteamPaths()` already lists all candidates including Flatpak paths. Just filter all valid ones instead of stopping at first.

```typescript
// Source: src/renderer/src/util/linux/steamPaths.ts (extend existing pattern)
export function findAllLinuxSteamPaths(): string[] {
  return getLinuxSteamPaths().filter(isValidSteamPath);
}
```

Keep `findLinuxSteamPath()` for backward compatibility — it should call `findAllLinuxSteamPaths()[0]` or remain as-is.

### Pattern 2: `resolveSteamPaths()` multi-root (STAM-02)

**What:** Iterate all valid Steam roots, read `libraryfolders.vdf` from each.
**Current behavior:** `resolveSteamPaths()` uses `mBaseFolder` (single path) as the starting point. It reads one `libraryfolders.vdf` and extracts additional library folders from it.
**New behavior:** On Linux, initialize `steamPaths` from `findAllLinuxSteamPaths()` (all valid Steam roots). Then for EACH root, read its `libraryfolders.vdf` to collect library folders.

```typescript
// In resolveSteamPaths() — Linux branch pseudocode
// Replace: const steamPaths: string[] = [basePath];
// With: const steamPaths: string[] = process.platform === 'linux'
//         ? findAllLinuxSteamPaths()
//         : [basePath];
```

### Pattern 3: Dedup by appid (STAM-02)

**What:** After `PromiseBB.mapSeries` across all steam paths, deduplicate entries.
**Location:** `parseManifests()` at the `.then((games) => games.reduce(...))` call (line ~412 in Steam.ts).
**Pattern:**

```typescript
// After reducing all games into one flat array, deduplicate by appid
.then((games) => {
  const seen = new Set<string>();
  return games.filter(entry => {
    if (seen.has(entry.appid)) return false;
    seen.add(entry.appid);
    return true;
  });
})
```

### Pattern 4: `oslist` check in `getProtonInfo()` (STAM-03)

**What:** `detectProtonUsage()` only checks if `compatdata/<appid>/` exists. A never-launched Proton game has no compatdata yet. The `oslist` field in the ACF manifest indicates whether the game is Windows-only.
**The `oslist` field:** Multi-value string like `"windows"` or `"windows,linux"`. Check if it does NOT contain `"linux"`.

```typescript
// In getProtonInfo() or detectProtonUsage() — extend to accept oslist
export async function getProtonInfo(
  steamPath: string,
  steamAppsPath: string,
  appId: string,
  oslist?: string,          // NEW: from AppState.oslist in ACF
): Promise<IProtonInfo> {
  const compatDataExists = await detectProtonUsage(steamAppsPath, appId);
  const compatDataPath = getCompatDataPath(steamAppsPath, appId);

  // Game is Windows-only (uses Proton) if:
  // 1. compatdata directory exists (launched before), OR
  // 2. oslist does not include "linux" (never launched, but will use Proton)
  const isWindowsGame = oslist
    ? !oslist.toLowerCase().includes("linux")
    : compatDataExists;

  if (!isWindowsGame) {
    return { usesProton: false };
  }
  // ...rest of Proton path resolution...
  return { usesProton: true, compatDataPath, protonPath };
}
```

**Call site in `parseManifests()`:** Pass `obj["AppState"]["oslist"]` when calling `getProtonInfo()` (line ~378 in Steam.ts).

### Pattern 5: `PROTON_USERNAME` constant and `getMyGamesPath()` (STAM-04)

**What:** Export the canonical Wine username constant and a helper that builds the correct path.
**Location:** Add to `src/renderer/src/util/linux/proton.ts`.

```typescript
// Source: proton.ts — add these exports
export const PROTON_USERNAME = "steamuser";

export function getMyGamesPath(compatDataPath: string): string {
  return path.join(
    compatDataPath,
    "pfx", "drive_c", "users", PROTON_USERNAME, "Documents", "My Games",
  );
}
```

Note: `ISteamEntry` already has `compatDataPath?: string` — the caller passes `entry.compatDataPath`.

### Pattern 6: Fix `mygamesPath()` in `local-gamesettings/gameSupport.ts` (STAM-04)

**Existing bug (line 167-168):**
```typescript
// WRONG — "My Documents" is not the correct Wine prefix path
const wineDocuments = path.join(
  steamAppsPath, "compatdata", steamAppId.toString(),
  "pfx", "drive_c", "users", "steamuser", "My Documents",
);
return path.join(wineDocuments, "My Games", ...);
```

**Fix:**
```typescript
// CORRECT — use "Documents" not "My Documents"
const wineDocuments = path.join(
  steamAppsPath, "compatdata", steamAppId.toString(),
  "pfx", "drive_c", "users", "steamuser", "Documents",
);
return path.join(wineDocuments, "My Games", ...);
```

The correct path is `pfx/drive_c/users/steamuser/Documents/My Games/<game>/`. The Wine prefix maps Windows `%USERPROFILE%\Documents` to `pfx/drive_c/users/steamuser/Documents`, not `My Documents`.

### Pattern 7: `iniFiles()` async + Linux guard in `ini_prep/gameSupport.ts` (STAM-04)

**Current `iniFiles()` (line 209):** Sync, returns `string[]`, substitutes `{mygames}` with `getVortexPath("documents")`. No Linux guard.

**Required change:**
1. Make `iniFiles()` async, returning `Promise<string[]>`
2. Accept an optional `ISteamEntry` parameter (or the relevant fields)
3. On Linux with a Proton entry: substitute `{mygames}` with `getMyGamesPath(entry.compatDataPath)`
4. All call sites in `ini_prep/index.ts` must be updated to `await iniFiles(...)` or `.then(files => ...)`

**Call sites in `ini_prep/index.ts`:**
- Line 38: `PromiseBB.map(iniFiles(gameMode, discovery), ...)`
- Line 112: `PromiseBB.map(iniFiles(gameMode, discovery), ...)`
- Line 194: `const baseFiles = iniFiles(gameMode, discovery)`
- Line 316: `PromiseBB.map(iniFiles(gameMode, discovery), ...)`

**Threading `steamEntry` through:** `discovery: IDiscoveryResult` already contains `store` and `path`. Look up the Steam entry by `discovery.appid` or by app's `steamAppId` detail + `steamapps` path derivation (same pattern as existing `mygamesPath()` in local-gamesettings uses).

**Async signature change note:** Lines 38, 112, 316 call `PromiseBB.map(iniFiles(...), ...)` — `PromiseBB.map` accepts a thenable so no structural change needed. Line 194 uses sync result assignment `const baseFiles = iniFiles(...)` — this is the only site needing `await`.

### Pattern 8: Fallout 4 winapi dead import fix (STAM-05)

**Root cause:** `extensions/games/game-fallout4/src/index.js` line 4 requires `winapi-bindings` but never calls any method on the `winapi` variable — it's a dead import from earlier code that was removed.

**Why webpack alias doesn't help:** The Phase 2 webpack alias in `src/renderer/webpack.config.cjs` only applies during renderer bundle compilation. Bundled game extensions in `extensions/games/` use `copyfiles` to copy JS directly (no webpack bundling for these JS-only extensions) — the webpack alias never applies at runtime `require()`.

**Fix:** Remove line 4 entirely from `src/index.js` (and rebuild to `dist/index.js`). This is safer than adding a platform guard around a dead import.

### Anti-Patterns to Avoid

- **Using `os.userInfo().username` for Wine prefix paths:** The Wine prefix home directory is always `steamuser`, regardless of the Linux username. Never construct `pfx/drive_c/users/{os.userInfo().username}/`.
- **Using `"My Documents"` instead of `"Documents"`:** Windows `My Documents` is a display name; the Wine prefix file system path is `Documents`.
- **Assuming `compatdata/` exists for Proton detection:** Never-launched games have no `compatdata/` yet; use `oslist` as the primary signal for whether a game needs Proton.
- **Checking `oslist === "windows"` exactly:** `oslist` can be multi-value: `"windows"`, `"linux"`, `"windows,linux"`. Use `.toLowerCase().includes("linux")`.
- **Making `iniFiles()` changes break sync callers on Windows:** The function is called in PromiseBB chains on all platforms; making it async still works since PromiseBB.map accepts thenables. The `.baked`/`.base` backup logic is Windows-only (guarded by winapi format), but the file list must remain correct for all platforms.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| VDF/ACF parsing | Custom VDF parser | `simple-vdf` (already present) | Steam VDF format has subtle escaping rules |
| Steam path candidates | Hardcode paths in detection logic | `getLinuxSteamPaths()` in `steamPaths.ts` | Already covers 5 install variants including Snap |
| Proton path resolution | Custom version scanner | `resolveProtonPath()` + `findLatestProton()` in `proton.ts` | Already implements fuzzy match for GE-Proton, official Proton |

## Runtime State Inventory

This is not a rename/refactor phase. No runtime state inventory required.

## Common Pitfalls

### Pitfall 1: Wrong Path Segment — "My Documents" vs "Documents"
**What goes wrong:** INI files for Skyrim SE / Fallout 4 are not found; Vortex falls back to `~/Documents/My Games` or writes to wrong location.
**Why it happens:** Windows virtualizes `My Documents` as a display name, but the Wine prefix filesystem uses `Documents` as the actual directory name under `pfx/drive_c/users/steamuser/`.
**How to avoid:** Use `path.join(..., "Documents", "My Games", ...)`. Never `"My Documents"`.
**Warning signs:** `ENOENT` errors on INI files for Proton games at startup; STAM-04 acceptance test fails.

### Pitfall 2: `oslist` Multi-Value Format
**What goes wrong:** Game that is available on both Windows and Linux (like Stardew Valley) gets detected as "needs Proton" because `oslist === "windows"` check passes superficially.
**Why it happens:** `oslist` is a comma-separated string: `"linux,windows"` for dual-platform games.
**How to avoid:** Use `!oslist.toLowerCase().includes("linux")` — if `"linux"` is anywhere in the string, the game is native.
**Warning signs:** Stardew Valley gets `usesProton: true` on Linux.

### Pitfall 3: webpack Alias Scope Mismatch
**What goes wrong:** Assuming the Phase 2 winapi-bindings webpack alias covers all extension files.
**Why it happens:** The alias is in `src/renderer/webpack.config.cjs` — applies only to the renderer bundle. Bundled game extensions under `extensions/games/` are JavaScript files copied directly via `copyfiles`, not processed by webpack. Their `require()` calls hit Node's native module resolution.
**How to avoid:** For extensions distributed as plain JS, remove the dead import. For TypeScript extensions bundled with webpack, the alias covers them.
**Warning signs:** Game extension fails to load on Linux with MODULE_NOT_FOUND for winapi-bindings.

### Pitfall 4: `mBaseFolder` vs All Roots Confusion in Steam.ts
**What goes wrong:** `mBaseFolder` is set to the first valid Steam root (single path). Using it as the sole source for `resolveSteamPaths()` means Flatpak game libraries are never scanned.
**Why it happens:** `mBaseFolder` was designed as a single-path concept (Windows registry lookup). On Linux with multiple Steam installs, the concept doesn't extend naturally.
**How to avoid:** Keep `mBaseFolder` as-is (first valid root, used for `STEAM_EXEC` path and single-path operations). In `resolveSteamPaths()`, derive the starting set from `findAllLinuxSteamPaths()` on Linux.
**Warning signs:** Games in Flatpak Steam installation not appearing in Vortex game list.

### Pitfall 5: Async `iniFiles()` Signature Breaking Call at Line 194
**What goes wrong:** `const baseFiles = iniFiles(gameMode, discovery)` at line 194 of `ini_prep/index.ts` will be a Promise, not an array — `baseFiles.filter(...)` at line 197 will silently be empty or throw.
**Why it happens:** Line 194 uses the result as a sync array. Three other call sites use `PromiseBB.map(iniFiles(...), ...)` which works because `PromiseBB.map` accepts a Promise as its first argument.
**How to avoid:** Change line 194 to `const baseFiles = await iniFiles(gameMode, discovery)` inside the appropriate async context.
**Warning signs:** INI tweak baking silently does nothing; no error but tweaks not applied.

### Pitfall 6: Never-Launched Game Has No Proton Version
**What goes wrong:** Code tries to access `protonPath` for a never-launched game and crashes.
**Why it happens:** A game with `usesProton: true` from the `oslist` path has no `compatdata/` yet and may have no Proton version installed.
**How to avoid:** `IProtonInfo.protonPath` is already typed as `protonPath?: string` (optional). Callers already check `gameEntry.protonPath` before use (see `runToolWithProton()` guard in Steam.ts line 436).
**Warning signs:** TypeScript error if new code treats `protonPath` as required.

## Code Examples

### Verified: Current `mygamesPath()` bug in `local-gamesettings/gameSupport.ts` (lines 159-169)

```typescript
// Source: extensions/local-gamesettings/src/util/gameSupport.ts:159-169
// BUG: "My Documents" should be "Documents"
const wineDocuments = path.join(
  steamAppsPath,
  "compatdata",
  steamAppId.toString(),
  "pfx",
  "drive_c",
  "users",
  "steamuser",
  "My Documents",   // <-- WRONG. Correct path is "Documents"
);
return path.join(
  wineDocuments,
  "My Games",
  gameSupport.get(gameMode, "mygamesPath"),
);
```

### Verified: Current `iniFiles()` in `ini_prep/gameSupport.ts` (lines 209-227)

```typescript
// Source: src/renderer/src/extensions/ini_prep/gameSupport.ts:209-227
// No Linux guard — {mygames} always resolves to ~/Documents/My Games
export function iniFiles(gameMode: string, discovery: IDiscoveryResult) {
  const mygames = path.join(getVortexPath("documents"), "My Games");
  // ...
  return (gameSupport.get(gameMode, "iniFiles", store) ?? []).map((filePath) =>
    format(filePath, { mygames, game: discovery.path }),
  );
}
```

### Verified: `detectProtonUsage()` in `proton.ts` — only checks directory existence

```typescript
// Source: src/renderer/src/util/linux/proton.ts:15-26
// Missing: oslist check for never-launched games
export async function detectProtonUsage(
  steamAppsPath: string,
  appId: string,
): Promise<boolean> {
  const compatDataPath = path.join(steamAppsPath, "compatdata", appId);
  try {
    await fs.statAsync(compatDataPath);
    return true;
  } catch {
    return false;  // returns false for never-launched games (no compatdata yet)
  }
}
```

### Verified: `parseManifests()` call site for Proton info (Steam.ts ~line 378)

```typescript
// Source: src/renderer/src/util/Steam.ts:376-390
// oslist is available at obj["AppState"]["oslist"] but not passed to getProtonInfo()
const protonInfo = await getProtonInfo(
  basePath,
  steamAppsPath,
  entry.appid,  // oslist should be a 4th argument: obj["AppState"]["oslist"]
);
```

### Verified: Fallout 4 dead import (confirmed never used)

```javascript
// Source: extensions/games/game-fallout4/src/index.js:4
const winapi = require('winapi-bindings');
// winapi is never referenced after this line in the entire 141-line file
// Fix: remove this line
```

### Verified: `findLinuxSteamPath()` — stops at first valid root

```typescript
// Source: src/renderer/src/util/linux/steamPaths.ts:49-56
export function findLinuxSteamPath(): string | undefined {
  for (const steamPath of getLinuxSteamPaths()) {
    if (isValidSteamPath(steamPath)) {
      return steamPath;  // returns immediately — misses Flatpak if native found first
    }
  }
  return undefined;
}
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| No Linux Steam detection | `findLinuxSteamPath()` returns first valid root | Works for single-install; misses dual-install |
| No Proton detection | `detectProtonUsage()` checks `compatdata/` existence | Works for launched games; misses never-launched |
| `{mygames}` → `~/Documents/My Games` always | `local-gamesettings` has Linux guard (since Phase 1+) but uses wrong segment | Partially correct; path segment bug causes ENOENT |

## Open Questions

1. **Should `iniFiles()` receive `ISteamEntry` or just the fields it needs?**
   - What we know: `ini_prep/index.ts` call sites have `discovery: IDiscoveryResult` available, which contains `store`, `path`, and (post-discovery) the game's `steamAppId` in `game.details`.
   - What's unclear: Whether `IDiscoveryResult` already carries enough to look up the Steam entry, or if a direct `ISteamEntry` parameter is cleaner.
   - Recommendation: Accept `steamEntry?: ISteamEntry` as optional parameter. Thread it from the event handler in `ini_prep/index.ts` by looking up the game's Steam entry via `context.api` or deriving `compatDataPath` from `discovery.path` (game is always under `steamapps/common/<name>` so `steamAppsPath = path.dirname(path.dirname(discovery.path))`).

2. **Should `findLinuxSteamPath()` delegate to `findAllLinuxSteamPaths()[0]` or remain independent?**
   - What we know: `findLinuxSteamPath()` is exported and may be called by external callers via the public API.
   - Recommendation: Keep both as independent exports. `findLinuxSteamPath()` stays as-is (backward compat). `findAllLinuxSteamPaths()` is a new named export that `Steam.ts` adopts.

3. **Does `parseManifests()` need to pass `oslist` through `ISteamEntry` for the `iniFiles()` Linux guard?**
   - What we know: `ISteamEntry.manifestData` already carries the full parsed ACF object — `oslist` is at `entry.manifestData?.["AppState"]?.["oslist"]`. `ISteamEntry` also has `usesProton?: boolean` set after the Proton info pass.
   - Recommendation: Use `entry.usesProton` in `iniFiles()` guard — it's already set correctly after the Proton info enrichment in `parseManifests()`. No need to pass `oslist` separately.

## Environment Availability

Step 2.6: SKIPPED — this phase is code/config changes only. No external dependencies beyond the project's own code and pnpm packages (already installed).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `src/renderer/vitest.config.mts` |
| Quick run command | `pnpm --filter ./src/renderer test --run src/renderer/src/util/linux` |
| Full suite command | `pnpm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STAM-01 | VDF parsing works on Linux | manual inspect | — | n/a (validate-only) |
| STAM-02 | `findAllLinuxSteamPaths()` returns all valid roots | unit | `pnpm --filter ./src/renderer test --run steamPaths` | ❌ Wave 0 |
| STAM-02 | Dual-install dedup keeps first occurrence | unit | `pnpm --filter ./src/renderer test --run Steam` | ❌ Wave 0 |
| STAM-03 | `oslist=windows` game gets `usesProton: true` without compatdata | unit | `pnpm --filter ./src/renderer test --run proton` | ❌ Wave 0 |
| STAM-03 | `oslist=linux,windows` game gets `usesProton: false` | unit | `pnpm --filter ./src/renderer test --run proton` | ❌ Wave 0 |
| STAM-04 | `getMyGamesPath()` returns correct path for Proton game | unit | `pnpm --filter ./src/renderer test --run proton` | ❌ Wave 0 |
| STAM-04 | `mygamesPath()` in local-gamesettings uses `"Documents"` not `"My Documents"` | unit | manual inspect / path assertion | n/a (inspect) |
| STAM-04 | `iniFiles()` resolves to Wine prefix path on Linux+Proton | unit | `pnpm --filter ./src/renderer test --run gameSupport` | ❌ Wave 0 |
| STAM-05 | Cyberpunk stub confirmed no winapi | inspect | — | n/a (already confirmed) |
| STAM-05 | Stardew Valley native Linux executable confirmed | inspect | — | n/a (already confirmed) |
| STAM-05 | Fallout 4 loads without MODULE_NOT_FOUND on Linux | smoke | manual / `pnpm run start` | n/a (runtime) |

### Sampling Rate
- **Per task commit:** `pnpm --filter ./src/renderer test --run src/renderer/src/util/linux`
- **Per wave merge:** `pnpm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/renderer/src/util/linux/proton.test.ts` — covers `getMyGamesPath()`, `getProtonInfo()` oslist branch, `PROTON_USERNAME` constant
- [ ] `src/renderer/src/util/linux/steamPaths.test.ts` — covers `findAllLinuxSteamPaths()` with mocked `fs.statSync`
- [ ] `src/renderer/src/extensions/ini_prep/gameSupport.test.ts` — covers async `iniFiles()` Linux+Proton branch

## Project Constraints (from CLAUDE.md)

- **Platform guards, not replacements:** All Linux additions use `process.platform === 'linux'`; Windows code paths must remain untouched
- **No new runtime deps that affect Windows:** No new npm packages in this phase
- **PROTON_USERNAME:** Must be a named export constant, never `os.userInfo().username`
- **Diff size:** Prefer small, additive changes; no gutting existing modules
- **TypeScript:** `@typescript-eslint/consistent-type-imports` error-level — use `import type` for type-only imports
- **Naming:** camelCase functions, PascalCase interfaces with `I` prefix
- **Async/Await:** `Promise<T>` return types explicitly typed
- **Logging:** `log("debug"|"info"|"warn"|"error", context, data)` pattern
- **Testing:** Test files use `*.test.ts` suffix; renderer tests go in `src/renderer/src/**/*.test.ts`
- **GSD workflow:** Code changes only through `/gsd:execute-phase`

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `src/renderer/src/util/linux/steamPaths.ts` — candidate paths, `findLinuxSteamPath()` behavior
- `src/renderer/src/util/linux/proton.ts` — full Proton detection implementation
- `src/renderer/src/util/Steam.ts` — `ISteamEntry`, `parseManifests()`, `resolveSteamPaths()`
- `extensions/local-gamesettings/src/util/gameSupport.ts` — existing Linux platform guard + "My Documents" bug
- `src/renderer/src/extensions/ini_prep/gameSupport.ts` — `iniFiles()` sync implementation
- `src/renderer/src/extensions/ini_prep/index.ts` — all 4 call sites (lines 38, 112, 194, 316)
- `extensions/games/game-fallout4/src/index.js` — dead `require('winapi-bindings')` at line 4
- `extensions/games/game-cyberpunk2077/src/index.js` — stub with no winapi, confirmed unblocked
- `extensions/games/game-stardewvalley/src/game/StardewValleyGame.ts` — native Linux executable
- `src/renderer/webpack.config.cjs` — alias scope confirmed renderer-only
- `vitest.config.ts` + `src/renderer/vitest.config.mts` — test infrastructure

### Secondary (MEDIUM confidence)
- Proton Wine prefix path documentation: `pfx/drive_c/users/steamuser/Documents/` is the canonical path for all Proton versions (community-verified, consistent with existing code comments)
- `.planning/research/SUMMARY.md` — previous research summary for cross-reference

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all existing
- Architecture: HIGH — all integration points verified by direct file reads
- Pitfalls: HIGH — all grounded in actual code bugs found by inspection
- One MEDIUM item: `oslist` field format is community-verified (Valve has no formal spec), but consistent behavior across all known Proton versions

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable codebase, no fast-moving dependencies)
