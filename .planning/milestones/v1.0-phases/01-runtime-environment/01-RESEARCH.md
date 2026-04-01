# Phase 1: Runtime Environment - Research

**Researched:** 2026-03-30
**Domain:** Linux dev environment bootstrap — Electron runtime libs, XDG path fixes, electron-builder packaging config
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Add the following apt packages to `docker/linux/Dockerfile.devcontainer` in the existing `RUN apt-get install -y` block:
`libglib2.0-0, libnss3, libatk1.0-0, libatk-bridge2.0-0, libcups2, libdrm2, libxkbcommon0, libxcomposite1, libxdamage1, libxfixes3, libxrandr2, libgbm1, libasound2t64, libpango-1.0-0, libcairo2, libexpat1`

**D-02:** Do NOT add these libs to the GitHub Actions CI runner (`main.yml`). The devcontainer is the Linux dev/test environment for Phase 1. CI runner gets Electron libs when native addon compilation is added in Phase 3.

**D-03:** Add a Linux branch to `localAppData()` in `src/main/src/getVortexPath.ts`:
```typescript
if (process.platform === 'linux') {
  return process.env.XDG_DATA_HOME ?? path.join(os.homedir(), '.local', 'share');
}
```
Use `os.homedir()` (already available via `node:os`) rather than `cachedAppPath("home")` to avoid the Electron app dependency in forked child processes.

**D-04:** Do NOT create the directory — just return the path string. Callers that need the directory to exist are responsible for creating it.

**D-05:** Add a comment noting that game extension usage of `localAppData` (BG3, Bethesda INI paths) will be superseded by Proton-prefix resolution in Phase 2.

**D-06:** Move ONLY the two Windows-only `.exe` entries from root `extraResources` to `win.extraResources`:
- `"./build/VC_redist.x64.exe"`
- `"./build/windowsdesktop-runtime-win-x64.exe"`

**D-07:** Do NOT touch `./nsis/**/*`, `asarUnpack` FOMD `.dll`/`.exe` patterns, or any other entries. Those belong to Phase 4 (FOMD-01).

**D-08:** The locales entry `{ "from": "../../locales", "to": "locales" }` stays in root `extraResources` — it is cross-platform.

### Claude's Discretion

- How to structure the `win.extraResources` block in `electron-builder.config.json` — the `win` key already exists with `target`, `icon`, `publish`, etc. Merge `extraResources` into the existing `win` object.
- Whether to use `os.homedir()` or `app.getPath('home')` for the Linux `localAppData` fallback — use `os.homedir()` for robustness in child process contexts (where `app` may not be available).
- Import style for `os` module — already imported elsewhere in the main process; follow existing pattern.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RENV-01 | Devcontainer includes all Electron 39 runtime shared libraries | D-01 gives exact library list; Dockerfile structure verified — single `apt-get install -y` block at line 10-20 |
| RENV-02 | `getVortexPath("localAppData")` returns valid XDG path on Linux | D-03 gives exact code; `getVortexPath.ts` audited — `localAppData()` at line 123 needs `os.homedir()` import and platform guard |
| RENV-03 | `electron-builder.config.json` Windows-only `.exe` extraResources moved to `win.extraResources` | D-06/D-08 give exact entries; config audited — `win` block already exists at line 10, `extraResources` at line 47 |
</phase_requirements>

---

## Summary

Phase 1 is three surgical file edits with no new runtime dependencies affecting Windows. All three changes are narrowly scoped, code-verified against actual repo files, and have zero Windows code path impact.

**RENV-01** adds 16 apt packages (15 from REQUIREMENTS.md plus `libexpat1` from PROTON-VORTEX.md §1.1) to the single `RUN apt-get install -y` block already present in `docker/linux/Dockerfile.devcontainer`. The block is at lines 10-20. The packages are the standard Chromium/Electron runtime library set for Ubuntu 24.04, confirmed by cross-referencing STACK.md and the Electron documentation.

**RENV-02** adds a 3-line Linux branch to `localAppData()` in `src/main/src/getVortexPath.ts` (line 123) before the existing `return` statement. The function currently has no `os` import — `import * as os from "node:os"` must be added. The pattern (`process.platform === 'linux'`, nullish coalescing for env var) matches established patterns already used in the file and throughout the codebase.

**RENV-03** moves two `.exe` entries from root `extraResources` (lines 47-54 of `electron-builder.config.json`) into the already-existing `win` object (line 10). The `./nsis/**/*` entry and the cross-platform `locales` entry remain at root level per D-07/D-08.

**Primary recommendation:** Execute all three changes in a single atomic commit. They are independent but naturally grouped as "Phase 1: Linux dev environment bootstrap."

---

## Standard Stack

### Core (Already in Project)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| Electron | 39.8.0 | Desktop runtime | Already present; Electron 39 has full Linux support |
| electron-builder | 24.13.3 | Packaging | Already present; `linux` block already exists in config |
| node:os | Node 22 built-in | `os.homedir()` for Linux path fallback | Must be imported in `getVortexPath.ts` — currently not imported there |

### Supporting (No Changes Needed)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| node:path | Node built-in | Path construction | Already imported in `getVortexPath.ts` |
| Ubuntu 24.04 apt packages | OS-provided | Electron runtime libs | Added to Dockerfile only |

---

## Architecture Patterns

### Pattern 1: Platform Guard in `getVortexPath.ts`

**What:** Insert a Linux branch before the Windows fallback in `localAppData()`.

**Current code (lines 123-128):**
```typescript
function localAppData(): string {
  return (
    process.env.LOCALAPPDATA ||
    path.resolve(cachedAppPath("appData"), "..", "Local")
  );
}
```

**After change:**
```typescript
function localAppData(): string {
  if (process.platform === 'linux') {
    // NOTE: BG3 and Bethesda game extensions use localAppData for config paths.
    // On Linux these resolve to XDG_DATA_HOME. Proton-prefix resolution
    // for these games will be handled in Phase 2.
    return process.env.XDG_DATA_HOME ?? path.join(os.homedir(), '.local', 'share');
  }
  return (
    process.env.LOCALAPPDATA ||
    path.resolve(cachedAppPath("appData"), "..", "Local")
  );
}
```

**Import to add at top of file:**
```typescript
import * as os from "node:os";
```

**Why `os.homedir()` not `cachedAppPath("home")`:** `cachedAppPath` calls `app.getPath()` which requires the Electron app to be initialised. In forked child processes (where `typeof process.send === 'function'`), the electron `app` is not available. `os.homedir()` works in all contexts. The `electronAppInfoEnv` pattern at the top of the file already handles the fork case for `localAppData` by reading from `ELECTRON_APPDATA` env — but the non-fork path must be robust independently.

**Confidence:** HIGH — verified against actual file at lines 6-29, 109-128.

### Pattern 2: Dockerfile Append

**What:** Append the 16 library names to the existing `apt-get install -y` block.

**Current block (lines 10-20):**
```dockerfile
RUN apt-get update && apt-get install -y \
    curl \
    git \
    libfontconfig1-dev \
    ca-certificates \
    xz-utils \
    python3 \
    python3-setuptools \
    build-essential \
    libicu-dev \
    && rm -rf /var/lib/apt/lists/*
```

**Pattern:** Append before the `&& rm -rf` terminator. Do NOT add a second `RUN` block (layers are more expensive than a longer package list for devcontainer images; single-layer install is established Dockerfile convention here).

**`libasound2t64` note:** Ubuntu 24.04 renamed the ALSA package from `libasound2` to `libasound2t64`. The devcontainer base is `ubuntu:24.04` (line 5 of Dockerfile), so `libasound2t64` is correct. If the base image is ever downgraded to 22.04, this becomes `libasound2`.

**Confidence:** HIGH — verified against actual Dockerfile (base image confirmed ubuntu:24.04 at line 5).

### Pattern 3: `win.extraResources` Merge

**What:** Move two `.exe` entries from root `extraResources` into the `win` object.

**Current `win` block (lines 10-25):**
```json
"win": {
  "target": "nsis",
  "icon": "nsis/icon.ico",
  "publish": [...],
  "publisherName": [...],
  "signingHashAlgorithms": ["sha256"],
  "rfc3161TimeStampServer": "...",
  "timeStampServer": "..."
}
```

**After change — add `extraResources` key inside `win`:**
```json
"win": {
  "target": "nsis",
  "icon": "nsis/icon.ico",
  "publish": [...],
  "publisherName": [...],
  "signingHashAlgorithms": ["sha256"],
  "rfc3161TimeStampServer": "...",
  "timeStampServer": "...",
  "extraResources": [
    "./build/VC_redist.x64.exe",
    "./build/windowsdesktop-runtime-win-x64.exe"
  ]
}
```

**Root `extraResources` after change (remove just the two `.exe` entries):**
```json
"extraResources": [
  "./nsis/**/*",
  {
    "from": "../../locales",
    "to": "locales"
  }
]
```

**Note:** The `electron-builder` schema (referenced at line 1 of the config: `$schema: ...scheme.json`) supports per-platform `extraResources` inside the `win`, `linux`, and `mac` blocks. The `win` block already exists — merge into it. Do not create a new top-level `win` key.

**Confidence:** HIGH — verified against actual config file lines 1-72; `win` block exists and its full content is known.

### Anti-Patterns to Avoid

- **Adding a second `RUN apt-get` block in Dockerfile:** Increases layer count; existing convention is a single combined install block.
- **Using `cachedAppPath("home")` for the Linux localAppData fallback:** Requires Electron `app` to be available; breaks in forked child processes.
- **Moving `./nsis/**/*` to `win.extraResources`:** Explicitly out of scope (D-07). It stays at root even though it is Windows-only.
- **Using `||` instead of `??` for env var check:** `process.env.XDG_DATA_HOME || fallback` incorrectly treats empty string as falsy. Use `??` (nullish coalescing) consistent with the existing `process.env.LOCALAPPDATA ||` pattern in the same function — though even that could be argued; `??` is strictly more correct for env var checks per the codebase nullish coalescing convention.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Linux home dir | Custom env var parsing | `os.homedir()` | Handles `passwd` lookup, all edge cases including containers |
| XDG base dir | Custom `$XDG_DATA_HOME` logic | One-liner `process.env.XDG_DATA_HOME ?? path.join(os.homedir(), '.local', 'share')` | This IS the XDG spec; no library needed |
| Per-platform builder config | Custom build scripts | `electron-builder` per-platform config blocks (`win.extraResources`) | Natively supported by the schema already in use |

---

## Common Pitfalls

### Pitfall 1: `os` module not imported in `getVortexPath.ts`

**What goes wrong:** Adding `os.homedir()` without the import causes a TypeScript compilation error. The file has `import * as path from "node:path"` and `import { app, type App } from "electron"` but no `os` import.

**How to avoid:** Add `import * as os from "node:os";` at the top of the file alongside the existing `path` import. Use the `node:` prefix form to match `path`'s import style.

**Confidence:** HIGH — verified by reading `getVortexPath.ts` imports (lines 1-4).

### Pitfall 2: `libasound2t64` is Ubuntu 24.04-specific

**What goes wrong:** The package name changed between Ubuntu 22.04 (`libasound2`) and 24.04 (`libasound2t64`). Using `libasound2` in the Dockerfile for a 24.04 base will fail with a package-not-found error; using `libasound2t64` on a 22.04 base will also fail.

**How to avoid:** Devcontainer base is confirmed `ubuntu:24.04` — use `libasound2t64`. If the base image ever changes, this must be updated.

**Confidence:** HIGH — STACK.md explicitly documents this; Dockerfile base image verified as `ubuntu:24.04`.

### Pitfall 3: `./nsis/**/*` in `extraResources` must stay at root level

**What goes wrong:** Moving `./nsis/**/*` to `win.extraResources` (alongside the `.exe` files) would be logically correct but is explicitly out of scope (D-07). An implementer might be tempted to "clean up" by also moving the NSIS glob.

**How to avoid:** D-07 explicitly prohibits this. Phase 4 (FOMD-01) touches `asarUnpack` and related packaging entries; do not pre-empt that work.

**Confidence:** HIGH — explicit decision in CONTEXT.md D-07.

### Pitfall 4: The fork-path case is already handled for `localAppData`

**What goes wrong:** An implementer might think the `electronAppInfoEnv` block at lines 143-148 of `getVortexPath.ts` means no code change is needed — if a forked process sets `ELECTRON_APPDATA`, the function returns early before reaching `localAppData()`.

**What is actually true:** The fork path (when `typeof process.send === 'function'`) reads `localAppData` from `process.env.ELECTRON_APPDATA`. The non-fork path (normal main process execution) calls `localAppData()` directly. The fix targets the non-fork path — it is needed and cannot be skipped.

**Confidence:** HIGH — verified by reading lines 6-29 and 143-157 of `getVortexPath.ts`.

### Pitfall 5: electron-builder schema validation

**What goes wrong:** The config file references the electron-builder schema (`$schema` at line 1). If the `extraResources` key name is misspelled or placed at wrong nesting level inside `win`, electron-builder may warn or produce incorrect output silently.

**How to avoid:** The exact key name is `extraResources` (camelCase). The `win` object is a `PlatformSpecificBuildOptions` type in the schema which accepts `extraResources`. This is a documented and supported pattern.

**Confidence:** HIGH — electron-builder 24.x documentation; schema URL is in the file itself.

---

## Code Examples

### Complete `localAppData()` after change

```typescript
// Source: src/main/src/getVortexPath.ts lines 123-128 (current) → replacement
function localAppData(): string {
  if (process.platform === 'linux') {
    // NOTE: BG3 and Bethesda game extensions use localAppData for config paths.
    // On Linux these resolve to XDG_DATA_HOME. Proton-prefix resolution
    // for these games will be handled in Phase 2.
    return process.env.XDG_DATA_HOME ?? path.join(os.homedir(), '.local', 'share');
  }
  return (
    process.env.LOCALAPPDATA ||
    path.resolve(cachedAppPath("appData"), "..", "Local")
  );
}
```

### Import line to add

```typescript
// Source: getVortexPath.ts — add alongside existing imports at top of file
import * as os from "node:os";
```

### Dockerfile block after change (lines 10-22 approximate)

```dockerfile
RUN apt-get update && apt-get install -y \
    curl \
    git \
    libfontconfig1-dev \
    ca-certificates \
    xz-utils \
    python3 \
    python3-setuptools \
    build-essential \
    libicu-dev \
    libglib2.0-0 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2t64 \
    libpango-1.0-0 \
    libcairo2 \
    libexpat1 \
    && rm -rf /var/lib/apt/lists/*
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `src/main/vitest.config.ts` (included in root `vitest.config.ts` projects array) |
| Quick run command | `pnpm vitest run --project @vortex/main` |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RENV-01 | Dockerfile adds correct libs | Manual / build smoke | Docker build: `docker build -f docker/linux/Dockerfile.devcontainer .` | N/A — Dockerfile change |
| RENV-02 | `localAppData()` returns XDG path on Linux | Unit | `pnpm vitest run --project @vortex/main src/main/src/getVortexPath.test.ts` | ❌ Wave 0 |
| RENV-03 | electron-builder dry-run passes on Linux | Manual / build smoke | `pnpm exec electron-builder --linux --dir` (in devcontainer) | N/A — config file change |

### Sampling Rate

- **Per task commit:** `pnpm vitest run --project @vortex/main`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/main/src/getVortexPath.test.ts` — covers RENV-02; must mock `process.platform`, `process.env.XDG_DATA_HOME`, and `os.homedir()` to test the Linux branch independently
- [ ] No shared fixtures needed — existing Vitest setup in `src/main/vitest.config.ts` is sufficient

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | Devcontainer build test | Assumed present | — | Manual apt-get verification |
| pnpm | All build/test commands | ✓ | 10.33.0 | — |
| Node.js | All build/test commands | ✓ | 22.22.0 (Volta) | — |
| Vitest | Unit tests | ✓ | 4.1.0 | — |
| electron-builder | Packaging dry-run | ✓ | 24.13.3 | — |

**Missing dependencies with no fallback:** None for the three file edits themselves. Docker is needed to validate RENV-01 but not to make the edit.

**Missing dependencies with fallback:** RENV-01 validation requires a Docker build; if Docker is unavailable, the lib list can be verified by cross-referencing against STACK.md and the Electron documentation (already done — HIGH confidence).

---

## Open Questions

1. **Does `libasound2` need to be listed alongside `libasound2t64` for compatibility?**
   - What we know: The devcontainer base is `ubuntu:24.04`; `libasound2t64` is the correct package name on that distro.
   - What's unclear: If the devcontainer base is ever changed to 22.04, the package name changes.
   - Recommendation: Use only `libasound2t64` since the base is pinned to 24.04. Add a comment in the Dockerfile noting the Ubuntu 24.04 dependency.

2. **Should `./nsis/**/*` eventually move to `win.extraResources`?**
   - What we know: It is Windows-only but explicitly out of scope (D-07).
   - What's unclear: Whether Phase 4 will handle this or it will stay as technical debt.
   - Recommendation: Out of scope for Phase 1. Leave a `// TODO: move to win.extraResources in Phase 4 (FOMD-01)` comment if helpful.

---

## Sources

### Primary (HIGH confidence)

- Direct codebase read: `docker/linux/Dockerfile.devcontainer` — confirmed ubuntu:24.04 base, single `apt-get install -y` block
- Direct codebase read: `src/main/src/getVortexPath.ts` — confirmed `localAppData()` at line 123, no `os` import, fork-path env var handling
- Direct codebase read: `src/main/electron-builder.config.json` — confirmed `win` block at line 10, `extraResources` at line 47 with exact entries
- `.planning/research/PITFALLS.md` — §4 (localAppData), §5 (extraResources) — code-verified analysis
- `.planning/research/STACK.md` — Electron runtime library list with libasound2t64 note verified
- `PROTON-VORTEX.md` §1.1 — confirms `libexpat1` addition beyond REQUIREMENTS.md list
- `src/main/vitest.config.ts` — confirmed test framework and include pattern

### Secondary (MEDIUM confidence)

- `.planning/phases/01-runtime-environment/01-CONTEXT.md` — decision rationale for all three changes

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified against actual files
- Architecture patterns: HIGH — all code patterns verified against actual file contents at specific line numbers
- Pitfalls: HIGH — verified against actual file contents; one pitfall (P2) verified against Dockerfile base image

**Research date:** 2026-03-30
**Valid until:** 2026-06-30 (stable domain — Electron runtime deps, XDG spec, electron-builder config format all change slowly)
