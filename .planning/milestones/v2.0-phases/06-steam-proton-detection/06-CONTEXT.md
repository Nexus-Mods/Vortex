# Phase 6: Steam/Proton Detection - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the remaining correctness gaps in Steam/Proton game detection so Linux users can detect,
launch, and manage Steam/Proton games — including Bethesda titles whose INI and save files live
inside the Wine prefix, not in `~/Documents`. Five requirements: STAM-01 through STAM-05.

This phase does NOT touch packaging (Phase 7) or NXM protocol registration (Phase 8).

</domain>

<decisions>
## Implementation Decisions

### STAM-01: VDF parsing validation
- **D-01:** STAM-01 is validate-only. `Steam.ts` already parses `libraryfolders.vdf` and
  `appmanifest_*.acf` files. Confirm via a test run / manual verification pass; no code changes expected.

### STAM-02: Multi-root Steam scanning (dual Flatpak + native install)
- **D-02:** Change `findLinuxSteamPath()` (or add a parallel `findAllLinuxSteamPaths(): string[]`)
  to enumerate ALL valid Steam roots, not just the first hit.
- **D-03:** `Steam.ts` constructor: set `mBaseFolder` to the primary root (first valid hit, existing
  behavior) but separately enumerate all roots for `resolveSteamPaths()` so `libraryfolders.vdf`
  is read from each root.
- **D-04:** Deduplicate by `appid` — when the same game appears in both Flatpak and native installs,
  keep the first occurrence. User sees each game once, consistent with how Steam itself presents it.

### STAM-03: Never-launched game Proton detection
- **D-05:** Supplement `detectProtonUsage()` with an `oslist` ACF field check:
  if `AppState.oslist` does NOT contain `"linux"` (i.e., the game is Windows-only), the game will
  use Proton even if `compatdata/<appid>/` doesn't exist yet.
- **D-06:** For never-launched Proton games: return `usesProton: true` with a pre-populated
  `compatDataPath` (the path it will have once launched) — even if the directory doesn't exist yet.
  This lets Vortex present and configure the game before the user's first launch.
- **D-07:** `protonPath` may be `undefined` for never-launched games if no Proton version is
  installed yet — this is acceptable; callers already handle `protonPath: undefined`.

### STAM-04: `{mygames}` Wine prefix path fix
- **D-08:** Add `getMyGamesPath(steamEntry: ISteamEntry): Promise<string>` to `proton.ts`.
  - On Linux with `steamEntry.usesProton === true`: return
    `compatDataPath + "/pfx/drive_c/users/steamuser/Documents/My Games"` using the constant
    `PROTON_USERNAME = "steamuser"` — never use `os.userInfo().username`.
  - Fallback (no compatDataPath): return `path.join(os.homedir(), "Documents", "My Games")`
    (same as the current `~/Documents/My Games` behavior).
- **D-09:** Make `iniFiles()` in `gameSupport.ts` async — returns `Promise<string[]>`.
  The 4 call sites in `ini_prep/index.ts` are already in `PromiseBB` chains; change each to
  `await iniFiles(...)` or `.then(files => ...)`.
- **D-10:** In `iniFiles()`, add a Linux platform guard:
  `if (process.platform === 'linux' && steamEntry?.usesProton)` → call `getMyGamesPath(steamEntry)`
  instead of the static `getVortexPath("documents")` path.
- **D-11:** Fallback when `steamEntry` is absent or `usesProton` is false: use existing behavior
  (`~/Documents/My Games`) unchanged — Windows code path is untouched.
- **D-12:** Export `PROTON_USERNAME = "steamuser"` as a named constant from `proton.ts`.
  Never construct Wine prefix user paths with `os.userInfo().username`.

### STAM-05: Top-4 game extension audit
- **D-13:** Skyrim SE and Fallout 4 inherit STAM-04 (both use `{mygames}` INI paths).
  Audit both after STAM-04 is implemented.
- **D-14:** Cyberpunk 2077 — `index.js` has no `winapi-bindings` usage; confirmed unblocked on Linux.
  Validate in Phase 6 by inspection.
- **D-15:** Stardew Valley — native Linux game (has `StardewValley` executable path and explicit
  Linux SMAPI platform support). Confirmed unblocked; validate by inspection.
- **D-16:** Fallout 4 scope: `extensions/games/game-fallout4/src/index.js:4` has
  `const winapi = require('winapi-bindings')` at top level. Verify whether the Phase 2 webpack
  alias reaches the bundled game extension context. **If the alias doesn't reach it: fix in
  Phase 6** (extend the alias or add a platform guard at the require site). Fallout 4 is a
  top-4 title — it must work on Linux for v2.0.

### Claude's Discretion
- Whether to add `findAllLinuxSteamPaths()` as a new function or rename/extend the existing
  `findLinuxSteamPath()` — either is fine; keep backward compat for any external callers
- Exact signature for threading `steamEntry` into the async `iniFiles()` — could come from
  looking up the Steam entry by `discovery.appid` + `discovery.store`, or passed directly
- Unit test scope for `getMyGamesPath()` — a focused test for the Linux Proton branch is
  appropriate; planner decides whether to include it
- Whether `oslist` check uses `includes("linux")` or `!== "linux"` — be precise; some games
  list multiple OSes (e.g., `"linux,windows"`)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` §Steam/Proton Detection (STAM-01 through STAM-05) — exact
  acceptance criteria for all five requirements

### Research
- `.planning/research/SUMMARY.md` §Feature Reality Check and §Critical Gaps — verified
  completion state per requirement, exact files to modify, critical pitfalls

### Files Being Modified
- `src/renderer/src/util/linux/proton.ts` — add `getMyGamesPath()`, `PROTON_USERNAME` constant;
  extend `detectProtonUsage()` / `getProtonInfo()` with `oslist` check
- `src/renderer/src/util/linux/steamPaths.ts` — add `findAllLinuxSteamPaths(): string[]`
- `src/renderer/src/util/Steam.ts` — constructor + `resolveSteamPaths()` to iterate all roots;
  dedup by appid
- `src/renderer/src/extensions/ini_prep/gameSupport.ts` — make `iniFiles()` async; Linux
  platform guard using `getMyGamesPath()`

### Files to Audit (STAM-05)
- `extensions/games/game-fallout4/src/index.js` — line 4: `require('winapi-bindings')`;
  confirm webpack alias scope
- `extensions/games/game-cyberpunk2077/src/index.js` — no winapi usage; inspect and confirm
- `extensions/games/game-stardewvalley/src/game/StardewValleyGame.ts` — Linux executable
  detection; inspect and confirm
- `extensions/games/game-skyrimse/` — inherits STAM-04; audit INI path after fix

### Bundled Extensions Build Config (STAM-05 Fallout 4)
- `pnpm-workspace.yaml` — workspace structure; game extensions may have own webpack config
- Check `extensions/games/game-fallout4/` for webpack config or build script that needs alias

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `proton.ts` — `getCompatDataPath()`, `getWinePrefixPath()`, `getProtonInfo()`, `IProtonInfo`
  are already implemented; `getMyGamesPath()` extends the existing pattern
- `steamPaths.ts` — `getLinuxSteamPaths()` already lists all candidate paths including Flatpak;
  just needs to return ALL valid ones, not stop at first
- `Steam.ts` — `resolveSteamPaths()` already reads `libraryfolders.vdf` for additional library
  roots; the multi-root extension is additive to existing logic
- `Steam.ts` — `parseManifests()` already reads ACF `AppState` object; `oslist` field is already
  parsed alongside `appid`, `name`, `installdir`

### Established Patterns
- `process.platform === 'linux'` guard — all Linux additions use this; do not change Windows paths
- `PROTON_USERNAME = "steamuser"` — canonical Wine prefix home dir; never `os.userInfo().username`
- `PromiseBB.map(iniFiles(...))` → becomes `iniFiles(...).then(files => PromiseBB.map(files, ...))`
  or `(await iniFiles(...)).map(...)` — callers are already async
- ACF manifest structure: `obj["AppState"]["oslist"]` — already parsed; extend deduplication in
  the `.map()` at the end of `parseManifests()`

### Integration Points
- `gameSupport.ts:210` — `const mygames = path.join(getVortexPath("documents"), "My Games")`
  is the single fix point for STAM-04; wrap in platform guard
- `ini_prep/index.ts:38,112,194,316` — 4 sites that call `iniFiles()`; all 4 need async update
- `Steam.ts` constructor — `mBaseFolder` stays single-path; add separate `mAllRoots` or extend
  `resolveSteamPaths()` to source from all valid roots
- `game-fallout4/src/index.js:4` — `const winapi = require('winapi-bindings')` — if Phase 2
  alias doesn't apply, add a try/catch guard or extend the alias configuration

</code_context>

<specifics>
## Specific Ideas

- `PROTON_USERNAME = "steamuser"` must be a named export — downstream code that constructs
  Wine prefix paths (e.g., game extensions, test helpers) should import it, not hardcode the string
- `oslist` check: `oslist` can be multi-value (e.g., `"windows,linux"`) — check with
  `!oslist?.toLowerCase().includes("linux")` to determine "this game needs Proton"
- The research summary explicitly warns: "mygamesPath() async refactor must not break Windows
  callers (keep sync signature)" — this means the async change is Linux-gated; consider an
  overloaded or separately-named export if the signature change causes TypeScript issues for
  existing callers in non-async contexts

</specifics>

<deferred>
## Deferred Ideas

- **Fallout 4 winapi fix (if webpack scope confirmed):** If the Phase 2 alias already covers
  bundled extensions, no fix needed — this deferral is moot. Only becomes a real deferral if the
  audit finds the alias works and the extension loads cleanly.
- **Cyberpunk 2077 native Linux detection:** Cyberpunk ships a native Linux binary alongside the
  Windows one in the same steamapps folder. Detecting which binary to use (or letting Proton handle
  it) is a separate concern — deferred beyond STAM-05 audit scope.
- **SMAPI Linux installer validation for Stardew Valley:** SMAPI Linux install flow (install.dat,
  linux-install.dat) needs end-to-end testing; deferred to post-v2.0 quality pass.

</deferred>

---

*Phase: 06-steam-proton-detection*
*Context gathered: 2026-03-31*
