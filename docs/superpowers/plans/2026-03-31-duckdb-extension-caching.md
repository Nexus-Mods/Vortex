# DuckDB Extension Pre-Caching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bundle DuckDB extensions (e.g. `level_pivot`) inside the Vortex installer so they are loaded fully offline at runtime — no network call on startup.

**Architecture:** A config-driven TypeScript build script downloads platform-specific `.duckdb_extension` binaries at build time into `src/main/build/duckdb-extensions/`. Electron-builder picks them up via `extraResources` and places them outside the asar at `resources/duckdb-extensions/`. At runtime, `DuckDBSingleton` sets DuckDB's `extension_directory` to this path and calls `LOAD` directly, skipping the network install.

**Tech Stack:** TypeScript, `tsx` (script runner), `@duckdb/node-api`, Vitest, Electron, electron-builder, pnpm

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `scripts/duckdb-extensions.json` | Create | Config: platforms, outputDir, extension list |
| `scripts/download-duckdb-extensions.ts` | Create | Build script: detect version, download binaries |
| `scripts/download-duckdb-extensions.test.ts` | Create | Unit tests for pure logic (version parsing, URL construction) |
| `scripts/vitest.config.ts` | Create | Vitest project config for scripts directory |
| `vitest.config.ts` | Modify | Add `./scripts` to projects list |
| `src/main/src/store/DuckDBSingleton.ts` | Modify | Add `extensionDir` param to `initialize()`, replace FORCE INSTALL with LOAD |
| `src/main/src/store/LevelPersist.ts` | Modify | Add `extensionDir` param to `create()`, forward to `initialize()` |
| `src/main/src/Application.ts` | Modify | Add `getExtensionDir()`, pass to all `LevelPersist.create()` call sites |
| `src/main/electron-builder.config.json` | Modify | Add `extraResources` entry for `duckdb-extensions` |
| `package.json` | Modify | Add `duckdb:extensions` script; update `dist:all` and `build:assets` |
| `.gitignore` | Modify | Add `src/main/build/` |

---

## Task 1: Config file and gitignore

**Files:**
- Create: `scripts/duckdb-extensions.json`
- Modify: `.gitignore`

- [ ] **Step 1: Create the extension config**

Create `scripts/duckdb-extensions.json`:

```json
{
  "platforms": ["windows_amd64", "linux_amd64"],
  "outputDir": "src/main/build/duckdb-extensions",
  "extensions": [
    {
      "name": "level_pivot",
      "type": "http",
      "repository": "https://halgari.github.io/duckdb-level-pivot/current_release"
    }
  ]
}
```

- [ ] **Step 2: Gitignore the build output**

Open `.gitignore` (repo root) and add a line for the specific extension output directory (not the whole `build/` folder, to avoid silently ignoring unrelated future build artifacts):

```
src/main/build/duckdb-extensions/
```

- [ ] **Step 3: Commit**

```bash
git add scripts/duckdb-extensions.json .gitignore
git commit -m "feat(APP-204): add duckdb extension config and gitignore build output"
```

---

## Task 2: Download script with tests

The script has pure, testable logic (version parsing, URL construction) and impure I/O (reading package.json, downloading files, writing to disk). Export the pure functions so they can be tested without hitting the network or filesystem.

**Files:**
- Create: `scripts/download-duckdb-extensions.ts`
- Create: `scripts/download-duckdb-extensions.test.ts`
- Create: `scripts/vitest.config.ts`
- Modify: `vitest.config.ts`

### Step group A — Vitest project for scripts

- [ ] **Step 1: Create `scripts/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "scripts",
    environment: "node",
    include: ["*.test.ts"],
  },
});
```

- [ ] **Step 2: Add scripts project to root `vitest.config.ts`**

Open `vitest.config.ts` (repo root). In the `projects` array, add `"./scripts"` after `"./src/main"`:

```ts
projects: [
  "./src/main",
  "./scripts",          // <-- add this line
  "./src/main/vitest.integration.config.ts",
  "./src/renderer",
  // ...rest unchanged
],
```

### Step group B — Version parsing tests first (TDD)

- [ ] **Step 3: Write failing tests for version parsing**

Create `scripts/download-duckdb-extensions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseDuckDBVersion, buildExtensionUrl } from "./download-duckdb-extensions";

describe("parseDuckDBVersion", () => {
  it("strips the -r.X suffix and prepends v", () => {
    expect(parseDuckDBVersion("1.5.1-r.1")).toBe("v1.5.1");
  });

  it("works with higher revision numbers", () => {
    expect(parseDuckDBVersion("1.10.0-r.42")).toBe("v1.10.0");
  });

  it("throws on unexpected version format", () => {
    expect(() => parseDuckDBVersion("1.5.1")).toThrow(/unexpected/i);
    expect(() => parseDuckDBVersion("1.5.1-rc.1")).toThrow(/unexpected/i);
    expect(() => parseDuckDBVersion("not-a-version")).toThrow(/unexpected/i);
  });
});

describe("buildExtensionUrl", () => {
  it("builds a correct http extension URL", () => {
    const url = buildExtensionUrl({
      type: "http",
      name: "level_pivot",
      repository: "https://halgari.github.io/duckdb-level-pivot/current_release",
      version: "v1.5.1",
      platform: "windows_amd64",
    });
    expect(url).toBe(
      "https://halgari.github.io/duckdb-level-pivot/current_release/v1.5.1/windows_amd64/level_pivot.duckdb_extension"
    );
  });

  it("builds a correct community extension URL", () => {
    const url = buildExtensionUrl({
      type: "community",
      name: "delta",
      version: "v1.5.1",
      platform: "linux_amd64",
    });
    expect(url).toBe(
      "https://community-extensions.duckdb.org/v1/v1.5.1/linux_amd64/delta.duckdb_extension"
    );
  });

  it("throws when http extension is missing repository", () => {
    expect(() =>
      buildExtensionUrl({
        type: "http",
        name: "my_ext",
        version: "v1.5.1",
        platform: "windows_amd64",
      })
    ).toThrow(/repository/i);
  });
});
```

- [ ] **Step 4: Run tests — expect them to fail (module not found)**

```bash
pnpm test --project scripts
```

Expected: FAIL — `Cannot find module './download-duckdb-extensions'`

### Step group C — Implement the download script

- [ ] **Step 5: Create `scripts/download-duckdb-extensions.ts`**

```ts
import * as fs from "node:fs";
import * as path from "node:path";
import * as https from "node:https";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExtensionConfig {
  platforms: string[];
  outputDir: string;
  extensions: ExtensionEntry[];
}

interface ExtensionEntry {
  name: string;
  type: "http" | "community";
  repository?: string;
}

interface BuildUrlOptions {
  type: "http" | "community";
  name: string;
  version: string;
  platform: string;
  repository?: string;
}

// ---------------------------------------------------------------------------
// Pure functions (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Parses a @duckdb/node-api version string (e.g. "1.5.1-r.1") into the
 * DuckDB core version string (e.g. "v1.5.1") used in extension download URLs.
 */
export function parseDuckDBVersion(rawVersion: string): string {
  const match = rawVersion.match(/^(\d+\.\d+\.\d+)-r\.\d+$/);
  if (match === null) {
    throw new Error(
      `Unexpected @duckdb/node-api version format: "${rawVersion}". ` +
        `Expected pattern: "<major>.<minor>.<patch>-r.<n>"`
    );
  }
  return `v${match[1]}`;
}

/**
 * Constructs the download URL for a single extension/platform combination.
 */
export function buildExtensionUrl(opts: BuildUrlOptions): string {
  const { type, name, version, platform, repository } = opts;

  if (type === "community") {
    return `https://community-extensions.duckdb.org/v1/${version}/${platform}/${name}.duckdb_extension`;
  }

  if (type === "http") {
    if (!repository) {
      throw new Error(
        `Extension "${name}" has type "http" but is missing a "repository" field.`
      );
    }
    return `${repository}/${version}/${platform}/${name}.duckdb_extension`;
  }

  throw new Error(`Unknown extension type: "${type as string}"`);
}

// ---------------------------------------------------------------------------
// I/O helpers
// ---------------------------------------------------------------------------

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(destPath);
    fs.mkdirSync(dir, { recursive: true });

    const file = fs.createWriteStream(destPath);

    const request = (url: string) => {
      https.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          // Follow redirect
          file.destroy();
          fs.unlinkSync(destPath);
          request(res.headers.location!);
          return;
        }
        if (res.statusCode !== 200) {
          file.destroy();
          fs.unlinkSync(destPath);
          reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
        file.on("error", (err) => {
          fs.unlinkSync(destPath);
          reject(err);
        });
      }).on("error", reject);
    };

    request(url);
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const configPath = path.resolve(import.meta.dirname, "duckdb-extensions.json");
  const config: ExtensionConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));

  // Detect DuckDB version from the installed @duckdb/node-api package
  const nodeApiPkgPath = path.resolve(
    import.meta.dirname,
    "../node_modules/@duckdb/node-api/package.json"
  );
  const nodeApiPkg = JSON.parse(fs.readFileSync(nodeApiPkgPath, "utf8"));
  const duckdbVersion = parseDuckDBVersion(nodeApiPkg.version as string);

  console.log(`DuckDB version: ${duckdbVersion}`);

  const outputDir = path.resolve(import.meta.dirname, "..", config.outputDir);

  for (const ext of config.extensions) {
    for (const platform of config.platforms) {
      const url = buildExtensionUrl({
        type: ext.type,
        name: ext.name,
        version: duckdbVersion,
        platform,
        repository: ext.repository,
      });

      const destPath = path.join(
        outputDir,
        duckdbVersion,
        platform,
        `${ext.name}.duckdb_extension`
      );

      if (fs.existsSync(destPath)) {
        console.log(`  skip  ${ext.name} [${platform}] — already exists`);
        continue;
      }

      console.log(`  download  ${ext.name} [${platform}]`);
      console.log(`    from: ${url}`);
      console.log(`    to:   ${destPath}`);
      await downloadFile(url, destPath);
      console.log(`  ✓ ${ext.name} [${platform}]`);
    }
  }

  console.log("Done.");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 6: Run tests — expect them to pass**

```bash
pnpm test --project scripts
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/download-duckdb-extensions.ts scripts/download-duckdb-extensions.test.ts scripts/vitest.config.ts vitest.config.ts
git commit -m "feat(APP-204): add duckdb extension download script with tests"
```

---

## Task 3: DuckDBSingleton — add `extensionDir` parameter

**Files:**
- Modify: `src/main/src/store/DuckDBSingleton.ts`

The `initialize()` method gains an `extensionDir: string` parameter. It is passed to `DuckDBInstance.create()` as `extension_directory`. The `FORCE INSTALL ... FROM '...'` + `LOAD` pair is replaced with `LOAD` only.

> **Validation note:** After this task, manually verify that DuckDB's `extension_directory` config + bare `LOAD level_pivot` resolves a pre-downloaded `.duckdb_extension` file from disk without hitting the network. See Task 6 for the smoke-test steps.

- [ ] **Step 1: Update `initialize()` in `DuckDBSingleton.ts`**

File: `src/main/src/store/DuckDBSingleton.ts`

Change the signature and body of `initialize()`. Replace lines 32–64:

```ts
public initialize(extensionDir: string): Promise<void> {
  if (this.#mInitialized) {
    return Promise.resolve();
  }

  if (this.#mInitPromise !== undefined) {
    return this.#mInitPromise;
  }

  this.#mInitPromise = (async () => {
    log("debug", "duckdb-singleton: creating shared instance");
    this.#mDuckDB = await DuckDBInstance.create(":memory:", {
      allow_unsigned_extensions: "true",
      extension_directory: extensionDir,
    });

    const connection = await this.#mDuckDB.connect();
    try {
      log("debug", "duckdb-singleton: loading level_pivot");
      await connection.run("LOAD level_pivot");
    } finally {
      connection.closeSync();
    }

    this.#mInitialized = true;
    this.#mInitPromise = undefined;
    log("debug", "duckdb-singleton: initialized");
  })();

  return this.#mInitPromise;
}
```

- [ ] **Step 2: Build to catch TypeScript errors**

```bash
pnpm run build
```

Expected: Build fails because `LevelPersist.ts` still calls `singleton.initialize()` without an argument. That is expected — it will be fixed in Task 4.

- [ ] **Step 3: Commit the DuckDBSingleton change**

```bash
git add src/main/src/store/DuckDBSingleton.ts
git commit -m "feat(APP-204): add extensionDir param to DuckDBSingleton.initialize, remove FORCE INSTALL"
```

---

## Task 4: LevelPersist — thread `extensionDir`

**Files:**
- Modify: `src/main/src/store/LevelPersist.ts`

Add `extensionDir: string` as the second parameter of `LevelPersist.create()`, after `persistPath`. Update the call to `singleton.initialize()` and the recursive retry call.

- [ ] **Step 1: Update `LevelPersist.create()` signature and body**

File: `src/main/src/store/LevelPersist.ts`

Replace the `create` method signature and body (lines 25–63):

```ts
public static async create(
  persistPath: string,
  extensionDir: string,
  tries: number = 10,
  repair: boolean = false,
): Promise<LevelPersist> {
  if (repair) {
    log("warn", "duckdb: repair requested but not supported, ignoring", {
      path: persistPath,
    });
  }
  try {
    const singleton = DuckDBSingleton.getInstance();
    await singleton.initialize(extensionDir);

    const alias = singleton.nextAlias();
    const connection = await singleton.attachDatabase(persistPath, alias);
    return new LevelPersist(connection, alias);
  } catch (unknownErr) {
    const err = unknownToError(unknownErr);
    log("warn", "duckdb: openDB failed", {
      message: err.message,
      triesRemaining: tries,
      path: persistPath,
    });
    if (err instanceof DataInvalid) {
      throw err;
    }
    if (/corrupt/i.test(err.message)) {
      throw new DataInvalid(err.message);
    }
    if (tries === 0) {
      log("info", "failed to open db", err);
      throw new DatabaseLocked();
    }
    await delay(500);
    return LevelPersist.create(persistPath, extensionDir, tries - 1, false);
  }
}
```

- [ ] **Step 2: Build to check TypeScript errors**

```bash
pnpm run build
```

Expected: Build now fails in `Application.ts` because the `LevelPersist.create()` call sites are missing the `extensionDir` argument. That is expected — fixed in Task 5.

- [ ] **Step 3: Commit**

```bash
git add src/main/src/store/LevelPersist.ts
git commit -m "feat(APP-204): thread extensionDir through LevelPersist.create"
```

---

## Task 5: Application — wire `extensionDir`

**Files:**
- Modify: `src/main/src/Application.ts`

Add a private `getExtensionDir()` method that resolves the correct extension directory for the current environment. Update all six `LevelPersist.create()` call sites to pass it.

- [ ] **Step 1: Add `getExtensionDir()` method to `Application`**

File: `src/main/src/Application.ts`

Add this private method anywhere before `setupPersistence` (e.g. directly before it):

```ts
/**
 * Returns the directory containing pre-bundled DuckDB extension binaries.
 * In production (packaged app) extensions live in the Electron resources
 * directory outside the asar. In development they are built to
 * src/main/build/duckdb-extensions/ relative to the app package root.
 */
private getExtensionDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "duckdb-extensions");
  }
  return path.join(app.getAppPath(), "build", "duckdb-extensions");
}
```

- [ ] **Step 2: Update all `LevelPersist.create()` call sites**

There are **six** call sites in `Application.ts`. Update each one to pass `this.getExtensionDir()` as the second argument.

**Line ~660 (`handleGet`):**
```ts
const persist = await LevelPersist.create(dbPath, this.getExtensionDir());
```

**Line ~696 (`handleSet`):**
```ts
const persist = await LevelPersist.create(dbPath, this.getExtensionDir());
```

**Line ~716 (`handleDel`):**
```ts
const persist = await LevelPersist.create(dbPath, this.getExtensionDir());
```

**Line ~849 (`setupPersistence` — main persistor):**
```ts
const levelPersistor = await LevelPersist.create(
  path.join(this.mBasePath, currentStatePath),
  this.getExtensionDir(),
  undefined,
  repair ?? false,
);
```

**Line ~886 (`setupPersistence` — temp shared-mode check persistor):**
```ts
const tempPersistor = await LevelPersist.create(
  sharedStatePath,
  this.getExtensionDir(),
  undefined,
  false,
);
```

**Line ~960 (`setupPersistence` — multi-user/custom path persistor):**
```ts
const newLevelPersistor = await LevelPersist.create(
  path.join(dataPath, currentStatePath),
  this.getExtensionDir(),
  undefined,
  repair ?? false,
);
```

- [ ] **Step 3: Build — expect success**

```bash
pnpm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 4: Run tests**

```bash
pnpm run test
```

Expected: All existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/main/src/Application.ts
git commit -m "feat(APP-204): wire extensionDir through Application into LevelPersist"
```

---

## Task 6: Build pipeline and packaging

**Files:**
- Modify: `package.json`
- Modify: `src/main/electron-builder.config.json`

- [ ] **Step 1: Add `duckdb:extensions` script and update build hooks in `package.json`**

Open `package.json` (repo root).

Add the new script (insert alphabetically or near other `duckdb`/`dist` scripts):
```json
"duckdb:extensions": "npx tsx scripts/download-duckdb-extensions.ts",
```

Update `build:assets` — append `&& pnpm run duckdb:extensions` to the end of the existing value:
```json
"build:assets": "node ./scripts/dependency-report.mjs && node ./InstallAssets.mjs ./src/main/out && pnpm sass --style compressed --silence-deprecation=import ./src/stylesheets/loadingScreen.scss ./src/main/out/assets/css/loadingScreen.css && pnpm tailwindcss -i ./src/stylesheets/tailwind-v4.css -o ./src/main/out/assets/css/tailwind-v4.css -m && pnpm run duckdb:extensions",
```

Update `dist:all` — append `&& pnpm run duckdb:extensions`:
```json
"dist:all": "pnpm run dist && pnpm run dist:extensions && pnpm run dist:assets && pnpm run duckdb:extensions",
```

- [ ] **Step 2: Add `extraResources` entry in `src/main/electron-builder.config.json`**

Open `src/main/electron-builder.config.json`. In the `extraResources` array, add:

```json
{
  "from": "./build/duckdb-extensions",
  "to": "duckdb-extensions"
}
```

The full `extraResources` array becomes:
```json
"extraResources": [
  "./build/VC_redist.x64.exe",
  "./build/windowsdesktop-runtime-win-x64.exe",
  "./nsis/**/*",
  {
    "from": "../../locales",
    "to": "locales"
  },
  {
    "from": "./build/duckdb-extensions",
    "to": "duckdb-extensions"
  }
],
```

- [ ] **Step 3: Run the download script manually to populate `src/main/build/duckdb-extensions/`**

```bash
pnpm run duckdb:extensions
```

Expected output:
```
DuckDB version: v1.5.1
  download  level_pivot [windows_amd64]
    from: https://halgari.github.io/duckdb-level-pivot/current_release/v1.5.1/windows_amd64/level_pivot.duckdb_extension
    to:   .../src/main/build/duckdb-extensions/v1.5.1/windows_amd64/level_pivot.duckdb_extension
  ✓ level_pivot [windows_amd64]
  download  level_pivot [linux_amd64]
  ...
Done.
```

Verify the files exist:
```bash
ls src/main/build/duckdb-extensions/
```

- [ ] **Step 4: Smoke test — start Vortex in dev mode and confirm no network call for level_pivot**

```bash
pnpm run start
```

Watch the log output for:
```
duckdb-singleton: loading level_pivot
duckdb-singleton: initialized
```

There should be **no** `duckdb-singleton: installing level_pivot` line. If DuckDB throws an error loading the extension from disk, re-check whether `extension_directory` + bare `LOAD` works for custom extensions in `@duckdb/node-api@1.5.1-r.1` (the validation callout from the spec). If it doesn't, the fallback is to use `INSTALL level_pivot FROM 'file://{destPath}'` which forces DuckDB to load from the local file path.

- [ ] **Step 5: Re-run download script to verify idempotency**

```bash
pnpm run duckdb:extensions
```

Expected: All lines show `skip — already exists`. No files re-downloaded.

- [ ] **Step 6: Run full test suite**

```bash
pnpm run test
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add package.json src/main/electron-builder.config.json
git commit -m "feat(APP-204): hook duckdb:extensions into build pipeline and add extraResources for packaging"
```

---

## Done

The feature is complete when:
- `pnpm run duckdb:extensions` downloads binaries to `src/main/build/duckdb-extensions/`
- `pnpm run start` loads `level_pivot` from disk without any network call
- `pnpm run test` passes
- `pnpm run package:nosign` produces an installer that includes the extension binaries at `resources/duckdb-extensions/`
