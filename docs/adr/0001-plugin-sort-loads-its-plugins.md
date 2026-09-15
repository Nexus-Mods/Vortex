# ADR 0001: The plugin sort loads the plugins it sorts

Why the Bethesda plugin sort in `gamebryo_plugin_management` now runs libloot's pre-sort sequence
itself instead of relying on an earlier `plugin-details` pass. For anyone touching `autosort.ts`,
the `plugin-details` event, or a sort trigger in a game extension.

Status: accepted (2026-09-15). Tracked as
[LAZ-1141](https://linear.app/nexus-mods/issue/LAZ-1141).

## Summary

Before every `SortPlugins` call, `LootInterface` refreshes libloot's load-order state, loads the
game's main master headers-only if the instance does not hold it yet, and fully loads every other
plugin in the sort set. This is the sequence the LOOT application runs before each of its sorts.
`plugin-details` is unchanged.

## Old behaviour

The `autosort-plugins` handler passed plugin names straight to `SortPlugins` and loaded nothing.
Only the `plugin-details` handler called `LoadPlugins` and `LoadCurrentLoadOrderState`, so a sort
was correct only when plugin-details had run for the same plugin set immediately before it. Two
triggers arranged that (`lootSortAsync` and the did-deploy handler); the Sort Now button, the ESL
conversion, the autosort health test, the cycle-recovery re-sort and the VR game extensions' own
sorts did not. Since #24190 the did-deploy handler was unprotected too: its plugin-details
request is deferred during the deployment, so the sort that follows is the first libloot call to
see the new plugins. All of these surfaced as `PluginNotLoaded` sort failures ("Plugins not sorted
because: Plugin not loaded"), the LAZ-1036 and LAZ-1092 class.

## New behaviour

`sortInput` returns the sort candidates as file paths (it already stat'ed them to drop missing
files). `doSort` runs `loadForSort` between the metadata-list check and `SortPlugins`:

```
LoadCurrentLoadOrderState
GetPlugin(main master) -> undefined ?  LoadPlugins([main master], headers only)
LoadPlugins(every other sort candidate, full records)
SortPlugins(candidate names, current load order)
```

The main master is the first entry of the game's native plugin list in
`src/renderer/src/extensions/gamebryo_plugin_management/util/gameSupport.ts`. Its file is taken
from the sort candidates, else from the plugin scan, else from the Data folder, so a caller that
did not ask to sort it still gets a valid batch (libloot only fully loads a Starfield plugin whose
masters it holds). The load-order state refresh also clears libloot's condition cache. All of it
lives in `src/renderer/src/extensions/gamebryo_plugin_management/autosort.ts`.

The `lootSortAsync` API handler (`lootSortAsync.ts`) no longer emits `plugin-details` before
sorting; that emit existed only to load the plugins.

## Justification

libloot 0.29.3 (`loot_api/include/loot/game_interface.h` in node-loot) states the contract:
`SortPlugins` requires that "all given plugins must have been loaded using LoadPlugins()";
`LoadPlugins` keeps earlier loads and, for "a given plugin filename (or one that is
case-insensitively equal)" that was already loaded, discards the old data; and
`LoadCurrentLoadOrderState` "should be called whenever the load order or active state of plugins
on disk changes".

The LOOT application 0.29.2 (`src/gui/state/game/game.cpp`) is the reference implementation of
that contract. On game load it loads every installed plugin headers-only
(`loadAllInstalledPlugins(true)`, called from `get_game_data_query.h`). Every sort then runs
`Game::sortPlugins`: `loadCurrentLoadOrderState()`, `LoadPlugins` with full records for every
plugin in the current load order except the game's main master file, then `SortPlugins`. It does
no change detection; it reloads. Vortex has no game-load headers pass, so the sort loads the
main master headers-only itself when the instance does not hold it, which is the state LOOT sorts
in. Owning the sequence in the sort makes every trigger correct at once instead of patching each
caller to run plugin-details first.

Alternative considered: loading only new or changed files, tracked per instance by plugin id with
the file's mtime and size. It saves the re-parse but departs from the reference implementation.

## Risks

- Every sort fully parses every plugin in the sort set, LOOT's cost per sort. `plugin-details`
  still loads the deployed set on every request, so the Plugins page refresh after a deployment
  parses them again (pre-existing, left as is). The `lootSortAsync` path now pays once.
- The main master is loaded headers-only when the instance lacks it. If plugin-details runs later
  it reloads the master fully, as it always did.
- Loaded plugins accumulate in the libloot instance until it is recreated. Unchanged: node-loot
  does not expose `ClearLoadedPlugins`.
- Starfield: libloot only fully loads a plugin whose masters are loaded or in the same batch. The
  main master is loaded first; a missing DLC or mod master still fails the batch as before.
- `mainMasterPlugin` relies on the native plugin list starting with the game's master file, which
  holds for every game in the table and survives the Creation Club list merge (a Set seeded from
  the table keeps insertion order).

## User conformance

- Vortex users: a sort after a deployment, an ESL conversion, an external plugin edit, a Sort Now
  click or a cycle fix succeeds instead of reporting "Plugin not loaded". No UI or file-format
  change; plugins.txt is written from the same sorted result as before. Sorts take longer by the
  time libloot needs to parse the plugins.
- game-starfield and Oblivion Remastered (`api.ext.lootSortAsync`): the API sort loads the
  caller's files itself, so it no longer depends on the deployed set in `pluginList` having been
  loaded by plugin-details first. The result contract from LAZ-1048 is unchanged.
- game-skyrimvr and game-fallout4vr: their own `autosort-plugins` emit on deployment now sorts
  against loaded plugins.

## Tests

`autosort.lifecycle.test.ts` pins the sequence: load-order state and plugin loads before
`SortPlugins`, the main master loaded headers-only only when the instance lacks it and even when
the caller did not list it, and the sort deferred behind a deployment loading its plugins when it
runs. `lootSortAsync.test.ts` pins that the API path refreshes the plugin list and then sorts.
