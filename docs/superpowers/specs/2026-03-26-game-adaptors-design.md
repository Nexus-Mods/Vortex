# Game Adaptors: Data-Driven Game Definitions

**Date:** 2026-03-26
**Status:** Draft
**Scope:** Phase 0 (this work); Phases 1-3 documented as future roadmap

## Problem

All game extensions and game discovery currently run in the renderer process. Game definitions are imperative code (~130 extensions calling `registerGame()`), and store detection (Steam, GOG, Epic, Xbox, Registry) is tightly coupled to renderer-side `gamemode_management`. This creates unnecessary IPC chatter, puts I/O-heavy work in the wrong process, and makes game definitions hard to update without shipping new code.

## Vision

Game definitions become declarative YAML files loaded by the main process. Store discovery runs in main, writing results to DuckDB. DuckDB acts as a reactive data bus — writers insert data, readers watch queries, no imperative IPC. The renderer sees the same `IGame` objects it always has via a thin adaptor layer.

## Architecture Overview

```
Phase 0 (this work):

  Steam Scanner ──→ store_games table ──┐
  GOG Scanner ───→ store_games table ──┤
  Epic Scanner ──→ store_games table ──┤  DuckDB
  Xbox Scanner ──→ store_games table ──┤
  Registry ──────→ store_games table ──┘
                                        ↓ query watchers
                                   gamemode_management
                                   (consumes via Redux)

Phase 1 (next step, out of scope):

  Steam Scanner ──→ store_games table ──┐
  GOG Scanner ───→ store_games table ──┤
  Epic Scanner ──→ store_games table ──┤  DuckDB
  Xbox Scanner ──→ store_games table ──┤  watched query (JOIN)
  Registry ──────→ store_games table ──┤──→ discovered_games
                                        │
  YAML Loader ───→ game_definitions ───┘        ↓
                                           GameAdaptor
                                                ↓
                                           IGame → renderer
```

## Phase 0: Move All Game Detection to Main Process

### Goal

All store discovery services (Steam, GOG, Epic, Xbox, Registry) run in the main process. Each writes results to a DuckDB `store_games` table. Query watchers replace imperative discovery notifications. Renderer-side discovery code is removed from `gamemode_management`.

### Current State

Discovery runs entirely in the renderer:

1. **Store scanners** are registered via `registerGameStore()` in the renderer
2. **GameStoreHelper** (`src/renderer/src/util/GameStoreHelper.ts`) coordinates queries across stores
3. **Quick discovery** (`src/renderer/src/extensions/gamemode_management/util/discovery.ts`) runs on startup, queries each game's `queryArgs` against stores
4. **Results** dispatched to Redux: `settings.gameMode.discovered[gameId]`
5. **Store implementations:**
   - Steam: `src/renderer/src/util/Steam.ts` — registry + VDF parsing
   - Epic: `src/renderer/src/util/EpicGamesLauncher.ts` — registry + manifest files
   - GOG: `extensions/gamestore-gog/src/index.ts` — registry-based
   - Xbox: `extensions/gamestore-xbox/src/index.ts` — XML manifest parsing
   - Registry: inline in `src/renderer/src/util/GameStoreHelper.ts`

### Target State

Each store scanner becomes a main-process service that writes to DuckDB:

```
Main Process:
  SteamScanner.scan()    → INSERT INTO store_games ...
  GOGScanner.scan()      → INSERT INTO store_games ...
  EpicScanner.scan()     → INSERT INTO store_games ...
  XboxScanner.scan()     → INSERT INTO store_games ...
  RegistryScanner.scan() → INSERT INTO store_games ...

DuckDB:
  store_games table ← watched by query watchers
                    → results pushed to renderer via persist:push
```

### DuckDB Schema

#### `store_games` table

Populated by store discovery services. Each row is one game installation found by a store scanner.

| Column | Type | Notes |
|--------|------|-------|
| store_type | VARCHAR | `steam`, `gog`, `epic`, `xbox`, `registry` |
| store_id | VARCHAR | Store-specific identifier (app ID, manifest ID, etc.) |
| install_path | VARCHAR | Detected installation directory |
| name | VARCHAR | Game name as reported by the store |
| store_metadata | JSON | Store-specific extra data (launch args, DRM info, etc.) |
| **PK** | | `(store_type, store_id)` |

#### Setup SQL (`src/queries/setup/store_games.sql`)

```sql
CREATE TABLE IF NOT EXISTS store_games (
  store_type VARCHAR NOT NULL,
  store_id VARCHAR NOT NULL,
  install_path VARCHAR NOT NULL,
  name VARCHAR,
  store_metadata JSON,
  PRIMARY KEY (store_type, store_id)
);
```

### Main Process Components

#### Store Scanner Interface

```typescript
interface IStoreScanner {
  readonly storeType: string;
  scan(): Promise<IStoreGameEntry[]>;
  isAvailable(): Promise<boolean>;
}

interface IStoreGameEntry {
  storeId: string;
  installPath: string;
  name?: string;
  metadata?: Record<string, any>;
}
```

Each scanner implements this interface. The coordinator calls `isAvailable()` first (e.g., Xbox checks if the store is installed), then `scan()`.

#### Store Scanner Implementations

New files in `src/main/src/games/scanners/`:

- **`SteamScanner.ts`** — Migrated from `src/renderer/src/util/Steam.ts`. Registry lookup for Steam path, VDF library folder parsing, returns all installed Steam games.
- **`GOGScanner.ts`** — Migrated from `extensions/gamestore-gog/`. Registry scan under `SOFTWARE\WOW6432Node\GOG.com\Games`.
- **`EpicScanner.ts`** — Migrated from `src/renderer/src/util/EpicGamesLauncher.ts`. Reads `.item` manifest files.
- **`XboxScanner.ts`** — Migrated from `extensions/gamestore-xbox/`. XML manifest parsing in `ProgramData\Packages\`.
- **`RegistryScanner.ts`** — Generic registry-based detection for games that provide registry keys.

#### Discovery Coordinator

`src/main/src/games/DiscoveryCoordinator.ts`

Orchestrates all scanners:

1. On startup (and on manual rescan trigger), calls each scanner
2. Writes results to `store_games` table via DuckDB transaction
3. Handles scanner failures gracefully (one store failing doesn't block others)
4. Debounces rapid rescan requests

```typescript
class DiscoveryCoordinator {
  constructor(
    private scanners: IStoreScanner[],
    private database: Database
  ) {}

  async runDiscovery(): Promise<void> {
    const results = await Promise.allSettled(
      this.scanners.map(async (scanner) => {
        if (await scanner.isAvailable()) {
          const games = await scanner.scan();
          await this.writeToStore(scanner.storeType, games);
        }
      })
    );
    for (const result of results) {
      if (result.status === 'rejected') {
        log.warn('Scanner failed', result.reason);
      }
    }
  }

  private async writeToStore(
    storeType: string,
    games: IStoreGameEntry[]
  ): Promise<void> {
    await this.database.transaction(async (tx) => {
      const table = tx.createTable<StoreGame>('store_games');
      // Clear previous results for this store type, then insert fresh
      await table.deleteWhere({ store_type: storeType });
      for (const game of games) {
        await table.insert({
          store_type: storeType,
          store_id: game.storeId,
          install_path: game.installPath,
          name: game.name ?? null,
          store_metadata: game.metadata ? JSON.stringify(game.metadata) : null,
        });
      }
    });
    // Transaction commit triggers query invalidation automatically
  }
}
```

### Renderer Integration

#### The Matching Problem

`store_games` rows have `(store_type, store_id)` but no Vortex `game_id`. Today, the mapping from store entries to game IDs lives in each game extension's `queryArgs` (e.g., Skyrim SE declares `steam: [{ id: "489830" }]`). In Phase 0, game definitions haven't moved to main yet, so **the renderer still owns the matching logic**.

#### How `gamemode_management` Consumes Discovery Results

The store data moves to main; the matching stays in the renderer:

1. Main process scanners populate `store_games` in DuckDB
2. A query watcher on `store_games` fires when discovery completes
3. The full `store_games` contents are pushed to the renderer via `persist:push` into a new Redux state slice: `session.discovery.storeGames`
4. `quickDiscovery()` is refactored: instead of calling live scanner APIs via `GameStoreHelper.find()`, it matches each game extension's `queryArgs` against the `storeGames` Redux state — a local in-memory lookup, no I/O
5. The result is the same `addDiscoveredGame(gameId, result)` dispatch into `settings.gameMode.discovered` — downstream code doesn't change
6. Triggering a rescan calls `discovery:start` IPC to main, which re-runs scanners, updates `store_games`, and the query watcher pushes fresh data to the renderer

This keeps `gamemode_management` changes minimal (swap the data source in `quickDiscovery()`, don't rewrite the matching logic). In Phase 1, when game definitions move to main with `game_definition_stores`, the join happens entirely in DuckDB and the renderer matching code can be removed.

#### Existing `IGameStore` Interface

The existing `registerGameStore()` pattern and `IGameStore` interface in the renderer become unused for discovery but are still needed for:
- `launchGame()` — launching games via their store
- `launchGameStore()` — opening the store application
- `getExecInfo()` — getting executable path and args

These launch-related functions stay in the renderer for now. Only the discovery/scanning responsibility moves to main.

#### Manual Game Location

The "Browse for game" flow (`browseGameLocation`) currently runs in the renderer with a directory picker. This stays in the renderer — it's a UI interaction. But instead of writing directly to Redux, it sends the result to main, which inserts into `store_games` with `store_type = 'manual'` and the query watcher propagates it back.

### Search Discovery

The filesystem-walk "Search Discovery" (`startSearchDiscovery`) is a separate concern from store detection. It walks user-specified directories looking for `requiredFiles`. This can stay in the renderer for Phase 0 — it's user-initiated, infrequent, and doesn't involve store scanners. Moving it to main is a natural follow-up but not required for Phase 0.

### IPC Surface

Minimal new IPC — just enough to trigger and monitor discovery:

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `discovery:start` | renderer → main | Trigger a discovery run |
| `discovery:status` | main → renderer | Discovery progress/completion |

Discovery results flow via DuckDB → query watcher → `persist:push` → Redux. No IPC for the actual data.

### Migration Strategy

1. Implement scanners in main process (migrated from existing renderer code)
2. Wire up `DiscoveryCoordinator` with DuckDB writes and `Promise.allSettled` for parallel scanning
3. Add query watcher that pushes `store_games` contents to renderer Redux state (`session.discovery.storeGames`)
4. Add `discovery:start` IPC handler
5. Refactor `quickDiscovery()` in `gamemode_management` to match `queryArgs` against `storeGames` Redux state instead of calling scanner APIs
6. Remove renderer-side scanner code (`src/renderer/src/util/Steam.ts`, `src/renderer/src/util/EpicGamesLauncher.ts`, `extensions/gamestore-gog/`, `extensions/gamestore-xbox/`)
7. Keep `IGameStore` interface for launch-related functions only

### Platform Considerations

The Steam scanner currently has Linux/Proton-specific logic in `src/renderer/src/util/linux/proton.ts`. The main-process scanner migration must carry this platform-specific code forward.

---

## Phase 1: YAML Game Definitions (Out of Scope — Next Step)

### Goal

Game definitions become declarative YAML files in `data/games/`. Main process loads them into DuckDB. A reactive join against `store_games` produces matched games. A `GameAdaptor` converts matches to `IGame` objects for the renderer.

### YAML Schema

Minimal, DRY, convention-over-configuration:

```yaml
id: stellarblade
name: "Stellar Blade"
executable: StellarBlade.exe

modPath: "{gamePath}/Mods"
mergeMods: true

discovery:
  steam: "2084970"
```

**Inference rules:**
- `requiredFiles` defaults to `[executable]`
- `environment.SteamAPPId` inferred from `discovery.steam`
- `logo` defaults to `{id}.jpg`
- `version` defaults to `{ strategy: "exe-version", path: "{gamePath}/{executable}" }`
- `shortName` defaults to `name`
- Bare string store IDs are sugar for the common single-ID case

**Complex game example:**

```yaml
id: skyrimse
name: "Skyrim Special Edition"
executable: SkyrimSE.exe

modPath: "{gamePath}/Data"
mergeMods: true

discovery:
  steam: "489830"
  gog: "1711230643"
  epic: manifests
  xbox: "BethesdaSoftworks.SkyrimSE-PC"

version:
  strategy: file-regex
  path: "{gamePath}/SKSE/skse64_readme.txt"
  pattern: "version\\s+(\\d+\\.\\d+\\.\\d+)"

tools:
  - id: skse64
    name: "SKSE64"
    executable: skse64_loader.exe

setup:
  actions:
    - ensureDir: "{gamePath}/Data/SKSE/Plugins"

requires:
  - skyrimse-loadorder
```

### DuckDB Schema Additions

#### `game_definitions` table

| Column | Type | Notes |
|--------|------|-------|
| game_id | VARCHAR PK | e.g., `stellarblade` |
| name | VARCHAR | Display name |
| executable | VARCHAR | |
| mod_path_template | VARCHAR | e.g., `{gamePath}/Mods` |
| merge_mods | BOOLEAN | |
| version_strategy | VARCHAR | nullable, defaults to `exe-version` |
| version_path_template | VARCHAR | nullable |
| version_pattern | VARCHAR | nullable, for `file-regex` |
| logo | VARCHAR | nullable, defaults to `{game_id}.jpg` |
| raw_yaml | JSON | Full parsed YAML |

#### `game_definition_stores` table

| Column | Type |
|--------|------|
| game_id | VARCHAR FK |
| store_type | VARCHAR |
| store_id | VARCHAR |

#### `game_definition_tools` table

| Column | Type |
|--------|------|
| game_id | VARCHAR FK |
| tool_id | VARCHAR |
| name | VARCHAR |
| executable | VARCHAR |
| required_files | JSON |

#### `discovered_games` view (the reactive join)

```sql
CREATE VIEW discovered_games AS
SELECT
  gd.game_id,
  gd.name,
  gd.executable,
  gd.mod_path_template,
  sg.install_path,
  sg.store_type,
  sg.store_id
FROM game_definitions gd
JOIN game_definition_stores gds USING (game_id)
JOIN store_games sg USING (store_type, store_id)
```

### Main Process Components

#### GameDefinitionLoader

- Reads `data/games/*.yaml` at startup
- Validates against JSON Schema
- Applies inference rules
- Inserts into `game_definitions`, `game_definition_stores`, `game_definition_tools` tables

#### GameAdaptor

- Watches `discovered_games` view
- Resolves path templates (`{gamePath}` → actual install path)
- Maps named strategies to implementations (e.g., `exe-version` → PE version reader)
- Builds `IGame`-compatible objects
- Sends to renderer — `gamemode_management` sees them as if `registerGame()` was called

#### Strategy Registry

```
src/main/src/games/strategies/
  version/
    exe-version.ts
    file-regex.ts
    file-json-path.ts
  setup/
    ensureDir.ts
    writeTemplate.ts
```

### Conflict Resolution

If a YAML definition and a legacy `registerGame()` call provide the same `game_id`, **YAML wins**. The main process is authoritative.

### Pilot

Stellar Blade as the first YAML-defined game. Proves the full pipeline: YAML → DuckDB → query watcher → GameAdaptor → IGame → renderer.

---

## Phase 2: Convert Games (Future)

- Auto-conversion script for simple game extensions (~80% of the ~130 games)
- Manual conversion for complex games (split into YAML definition + companion renderer extension with `requires` dependency)
- Batched rollout, validate each batch

## Phase 3: Runtime Downloads (Future)

- Fetch YAML definitions from CDN
- Insert into `game_definitions` table
- Watched query automatically matches against `store_games`
- No app restart needed

## Key Design Principles

1. **DuckDB as reactive data bus** — writers insert data, readers watch queries, no imperative IPC for data flow
2. **Store scanners are pure data producers** — they know nothing about game definitions, just scan their store and report what they find
3. **Convention over configuration** — YAML definitions infer everything they can, only require what's truly unique to each game
4. **Adaptor layer preserves compatibility** — the renderer sees `IGame` objects, `gamemode_management` doesn't change
5. **Incremental migration** — legacy `registerGame()` path works alongside new system throughout transition
6. **YAML wins** — main process is authoritative for game definitions when conflicts exist
