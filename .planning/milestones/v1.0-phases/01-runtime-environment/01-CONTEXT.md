# Phase 1: Runtime Environment - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Three targeted surgical changes to make the Linux dev environment buildable and ready to test:
1. Add Electron 39 runtime shared libraries to the devcontainer Dockerfile
2. Fix `getVortexPath("localAppData")` to return a valid XDG path on Linux
3. Move Windows-only `.exe` extraResources in `electron-builder.config.json` to `win.extraResources`

No changes to Windows code paths. No new dependencies affecting Windows. CI (ubuntu-latest) already exists in `main.yml` matrix — no new CI jobs needed for Phase 1.

</domain>

<decisions>
## Implementation Decisions

### RENV-01: Devcontainer Electron Runtime Libraries

- **D-01:** Add the following apt packages to `docker/linux/Dockerfile.devcontainer` in the existing `RUN apt-get install -y` block:
  `libglib2.0-0, libnss3, libatk1.0-0, libatk-bridge2.0-0, libcups2, libdrm2, libxkbcommon0, libxcomposite1, libxdamage1, libxfixes3, libxrandr2, libgbm1, libasound2t64, libpango-1.0-0, libcairo2, libexpat1`
- **D-02:** Do NOT add these libs to the GitHub Actions CI runner (`main.yml`). The devcontainer is the Linux dev/test environment for Phase 1. CI runner gets Electron libs when native addon compilation is added in Phase 3.

### RENV-02: localAppData XDG Path Fix

- **D-03:** Add a Linux branch to `localAppData()` in `src/main/src/getVortexPath.ts`:
  ```typescript
  if (process.platform === 'linux') {
    return process.env.XDG_DATA_HOME ?? path.join(os.homedir(), '.local', 'share');
  }
  ```
  Use `os.homedir()` (already available via `node:os`) rather than `cachedAppPath("home")` to avoid the Electron app dependency in forked child processes.
- **D-04:** Do NOT create the directory — just return the path string. Callers that need the directory to exist are responsible for creating it (consistent with how `appData` and `userData` work in Electron).
- **D-05:** Add a comment noting that game extension usage of `localAppData` (BG3, Bethesda INI paths) will be superseded by Proton-prefix resolution in Phase 2. This makes the Phase 2 scope clear to future developers.

### RENV-03: electron-builder extraResources

- **D-06:** Move ONLY the two Windows-only `.exe` entries from root `extraResources` to `win.extraResources`:
  - `"./build/VC_redist.x64.exe"`
  - `"./build/windowsdesktop-runtime-win-x64.exe"`
- **D-07:** Do NOT touch `./nsis/**/*` (Windows-only but not in scope for this phase), `asarUnpack` FOMD `.dll`/`.exe` patterns, or any other entries. Those belong to Phase 4 (FOMD-01).
- **D-08:** The locales entry `{ "from": "../../locales", "to": "locales" }` stays in root `extraResources` — it is cross-platform.

### Claude's Discretion

- How to structure the `win.extraResources` block in `electron-builder.config.json` — the `win` key already exists with `target`, `icon`, `publish`, etc. Merge `extraResources` into the existing `win` object.
- Whether to use `os.homedir()` or `app.getPath('home')` for the Linux `localAppData` fallback — use `os.homedir()` for robustness in child process contexts (where `app` may not be available).
- Import style for `os` module — already imported elsewhere in the main process; follow existing pattern.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Files Being Modified

- `docker/linux/Dockerfile.devcontainer` — Devcontainer build config; the `RUN apt-get install` block is where libs are added
- `src/main/src/getVortexPath.ts` — `localAppData()` function at line 123; `os` import must be added
- `src/main/electron-builder.config.json` — `extraResources` at root level; `win` block already exists at line 10

### Requirements

- `.planning/REQUIREMENTS.md` §RENV-01, §RENV-02, §RENV-03 — the exact acceptance criteria to satisfy

### Research Context

- `.planning/research/PITFALLS.md` §4 (localAppData fallback) and §5 (extraResources) — code-verified analysis of what breaks and why
- `PROTON-VORTEX.md` §1.1 — confirms exact lib list including `libexpat1` (not in REQUIREMENTS.md but listed there)

### Related (do not modify in Phase 1)

- `src/main/src/ipcHandlers.ts:60` — passes `localAppData` to renderer via IPC; this will return the fixed XDG path after RENV-02
- `extensions/games/game-baldursgate3/src/util.ts:28` — uses `localAppData` for BG3 config path; will get XDG path in Phase 1, Proton-prefix path in Phase 2

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `os.homedir()` — available via `node:os`; use for `localAppData` Linux fallback to avoid Electron app dependency in forked child processes
- The `win` block already exists in `electron-builder.config.json` — merge `extraResources` into it, don't create a new top-level `win` key

### Established Patterns

- `process.platform === 'linux'` — the existing platform guard pattern used throughout the codebase (see `CONCERNS.md`, `elevated.ts`, game extensions)
- `process.env.XDG_DATA_HOME ?? fallback` — nullish coalescing preferred over `||` for env var checks (consistent with `process.env.LOCALAPPDATA` pattern already in `localAppData()`)
- The Dockerfile already has a single multi-package `RUN apt-get install -y` block — append libs to it, don't add a second `RUN`

### Integration Points

- `src/main/src/getVortexPath.ts` `localAppData()` at line 123 — surgical 3-line addition before the existing `return` statement
- `docker/linux/Dockerfile.devcontainer` — append to the existing `apt-get install -y` list at line 11
- `src/main/electron-builder.config.json` — the `win` object is at line 10; add `extraResources` key inside it

</code_context>

<specifics>
## Specific Ideas

- PROTON-VORTEX.md §1.1 lists `libexpat1` in addition to the 15 libs in REQUIREMENTS.md — include it in the Dockerfile add
- `localAppData` must work in forked child process contexts (see `getVortexPath.ts` lines 6-29: the `electronAppInfoEnv` path for forks). The XDG path is passed via `ELECTRON_APPDATA` env when forking — the fix only needs to cover the non-fork path, since the fork path reads from env vars already.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-runtime-environment*
*Context gathered: 2026-03-30*
