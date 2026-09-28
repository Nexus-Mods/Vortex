# Shared chunk — gamebryo plugin management (plugins, load order, LOOT)

Load in any mode when the ask concerns plugins, plugins.txt, load order, sorting, LOOT /
libloot, ghosting or the gamebryo extension. All lines `[RENDERER]`. Quoted payloads are
prefixes: grep without the closing brace (`running checks {"event":"plugins-changed"`).

- **Startup order** (the first two once per session, the rest recur on profile switches
  and reloads): `init extension {"name":"gamebryo-plugin-management"` → `Registering
extension persistor {"hive":"loadOrder"` (+ `userlist`, `masterlist`) → `synching plugins
{pluginsPath}` (DEBG; the plugins.txt folder) → optional `updated loot masterlist` →
  `loaded loot lists {gameMode, masterlist, userlist, prelude}`. With the Plugins page open:
  `requesting plugin info [ids…]` (DEBG) → `running checks {"event":"loot-info-updated"` /
  `all checks completed` (DEBG). Fatal shape: `[ERRO] error setting up renderer` with
  `extension uses api in init function` in the stack: a static extension read an api member
  inside `init()` (only `extension`, `translate`, `onAsync`, `onStateChange`, `events`,
  `laterT`, `NAMESPACE` are allowed before `once()`); nothing after it runs, no persistors,
  the splash never closes. The shared test api is not proxied, so only a test that hands a
  throwing Proxy to the constructor (nxmProtocol.test.ts) or a dev-build run catches it.
- **Sort:** `sorting plugins finished {elapsedMS}` (DEBG), followed by `nothing to sort`
  (WARN) when the sort set was empty (marker kept). Sort Now takes the same path. The first
  sort on a fresh libloot instance carries the full plugin load and is slower. The sort
  waits silently for a `mods` / `installing_dependencies` activity to clear; the Plugins page
  logs `deferring update plugin details because mod activity` (DEBG) on its own 2 s debounce
  during a `mods` activity only.
- **Collection installs:** `failed to update plugin list for collection install` (WARN),
  `failed to sync plugin state after collection install` (ERRO). Health checks re-fire per
  cycle, not per finding: Missing Masters on `running checks {"event":"plugins-changed"` and
  on game activation, as `warning notification` or `error notification` by severity; Plugin
  dependencies unfulfilled on `{"event":"loot-info-updated"`. Count cycles, not notifications.
- **Persistor (plugins.txt / loadorder.txt):** `synching plugins` on load,
  `PluginPersistor.disable called` (DEBG) on a game or profile switch, `deserialize {format,
pluginsFile, loadOrderFile}` (DEBG, only for the original no-`*` format: Oblivion, Fallout 3,
  New Vegas). `plugins file was changed by foreign application {header, pluginstxt}` (INFO)
  raises the keep/revert prompt; a header-only rewrite by the game is not foreign. Failures
  log with their phrase, `[ERRO]` (or `[WARN]` when judged environmental, e.g. EPERM or a
  plugins.txt deleted underneath), once as a notification and always as a telemetry span:
  `failed to write plugin list`, `failed to read plugin list` (preceded by `failed to read
plugin file {pluginPath, error}` WARN retries), `failed to serialize plugin list`, `failed to
merge the plugin state`. EBUSY on write is swallowed (the game holds the file).
- **LOOT / libloot:** `failed to initialize LOOT` (ERRO); `LOOT process died` (WARN, worker
  restarted, up to 3 times); `LOOT fork got EBUSY, retrying {retriesLeft}` (DEBG, 5 attempts);
  `loot failed {kind, error}` (INFO, a classified libloot failure); `excluding invalid plugins
from load` / `… from sort` (WARN, unparseable plugins skipped so the rest still sorts);
  `failed to sort plugins, empty loot result`; `resetting plugins assigned to missing loot
group(s)`; API consumers (Starfield): `lootSortAsync failed`, `lootSortAsync called without
a callback`.
- **Plugin files and the Data folder watcher:** `failed to parse esp {path, error}` (WARN,
  Plugins page; distinct from `failed to parse esp file {name, err}`, the blueprint-master
  check). Ghosted plugins (`.ghost`, any casing) parse like any other since #24273, so a run
  of these on `.ghost` paths is a regression. Watcher setup: `mod path unknown` (ERRO) when
  the game's Data folder cannot be resolved, `failed to watch mod directory {"modPath"` (WARN;
  the `{"downloadPath"` twin is the download folder watcher) or the notification `Failed to
watch mod directory` when `watch()` throws. `no profile active` (WARN) from a rescan with no
  active profile.

**Invariants** (report pass / FAIL by number):

1. Exactly one `sorting plugins finished` per completed deployment or purge, after the
   deployment activity clears. Broken: a sort between `Starting deployment` and the final
   `deployment {added, removed, …}` summary, or zero / more than one per deployment.
2. In a collection session the extension does not handle `did-deploy`; `postprocess
collection` (lifecycle.md) enables the manifest's plugins and runs the one sort. Broken: a
   sort between `starting install of collection` and `postprocess collection`.
3. A sort owed by an interrupted collection install runs on the next profile activation:
   `draining pending collection plugin sort {profileId, gameId}` (INFO) followed by one
   sort.
