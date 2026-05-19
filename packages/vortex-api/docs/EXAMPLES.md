# Example Extensions

These open-source extensions are good references for advanced patterns.

### Built-in (bundled with Vortex)

- [`game-witcher3`](https://github.com/Nexus-Mods/Vortex/tree/master/extensions/games/game-witcher3) - 6 installers, script merger auto-download, XML merge support, collections, load order, custom reducers
- [`game-nomanssky`](https://github.com/Nexus-Mods/Vortex/tree/master/extensions/games/game-nomanssky) - mod type migration system that converts mods between deprecated and current formats
- [`game-morrowind`](https://github.com/Nexus-Mods/Vortex/tree/master/extensions/games/game-morrowind) - load order with validation, collections support, multi-language/locale handling

### Community

#### [Cyberpunk 2077](https://github.com/E1337Kat/cyberpunk2077_ext_redux)

A large-scale extension supporting 14+ mod frameworks (REDmod, Red4Ext, CET, Redscript, TweakXL, etc.). Notable patterns:

- **Multi-type installer** - a single archive can contain multiple mod types; the extension detects and sequences them automatically ([installer.multitype.ts](https://github.com/E1337Kat/cyberpunk2077_ext_redux/blob/5a069f0/src/installer.multitype.ts))
- **Layout-based detection** - infers mod type from file structure rather than metadata, with legacy format auto-conversion ([installers.layouts.ts](https://github.com/E1337Kat/cyberpunk2077_ext_redux/blob/5a069f0/src/installers.layouts.ts))
- **Tool hooks** - intercepts tool execution to trigger REDmod deployment before launch ([tools.redmodding.ts](https://github.com/E1337Kat/cyberpunk2077_ext_redux/blob/5a069f0/src/tools.redmodding.ts))
- **Dynamic feature flags** - user-configurable features backed by Redux store ([features.ts](https://github.com/E1337Kat/cyberpunk2077_ext_redux/blob/5a069f0/src/features.ts))
- **Load order with REDmod deployment** - ties load order serialization to the REDmod compilation pipeline ([load_order.ts](https://github.com/E1337Kat/cyberpunk2077_ext_redux/blob/5a069f0/src/load_order.ts))
- **Game store DLC prompts** - detects Steam/GOG/Epic and prompts users to install REDmod DLC via store-specific protocol handlers ([redmodding.ts](https://github.com/E1337Kat/cyberpunk2077_ext_redux/blob/5a069f0/src/redmodding.ts))

#### [Mount & Blade II: Bannerlord](https://github.com/BUTR/game-mount-and-blade2)

A feature-rich extension with native module integration and save game management. Notable patterns:

- **Load order with auto-sort** - advanced load order management with auto-sort on deploy, bulk enable/disable, and per-profile persistence ([loadOrder/](https://github.com/BUTR/game-mount-and-blade2/tree/c04fced/src/loadOrder))
- **Save game viewer** - custom UI for browsing and loading save files with BLSE support ([views/](https://github.com/BUTR/game-mount-and-blade2/tree/c04fced/src/views))
- **Collections support** - full integration with Vortex collections including addung custom data such as load order and mod options ([collections/](https://github.com/BUTR/game-mount-and-blade2/tree/c04fced/src/collections))
- **Custom settings UI** - registers a game specific settings panels with sort-on-deploy, auto-fix toggles ([settings/](https://github.com/BUTR/game-mount-and-blade2/tree/c04fced/src/settings))

#### [Ready Or Not](https://github.com/BeYkeRYkt/vortex_readyornot_extension)

Handles 6 specialized mod types (FMOD audio, movies, configs, saves, binaries, root). Notable patterns:

- **Prefix-based load ordering** - uses alphabetic prefixes (`AAA_`, `AAB_`, ...) so filesystem sorting matches user-defined priority ([index.js](https://github.com/BeYkeRYkt/vortex_readyornot_extension/blob/9448452/index.js))
- **Type-specific installer pairs** - each mod type has paired `test*()` and `install*()` functions for validation and routing
- **Corrupt load order recovery** - gracefully handles corrupted `loadOrder.json` with auto-rebuild

#### [Valheim](https://github.com/sqrrlmstr/Valheim-Extension)

Manages BepInEx framework deployment and Thunderstore integration. Notable patterns:

- **Thunderstore API integration** - fetches and downloads BepInEx packs directly from the Thunderstore API with error handling and rate limiting ([index.js](https://github.com/sqrrlmstr/Valheim-Extension/blob/e52a287/index.js))
- **Per-mod directory isolation** - segregates each mod into `BepInEx/plugins/[ModName]/` to prevent naming conflicts
- **Timestamp-based conflict resolution** - compares file modification times to prevent unintended overwrites

#### [Elden Ring](https://github.com/Senjay-id/eldenring-vortex-extension)

Supports ModEngine 2 and seamless co-op mods. Notable patterns:

- **Framework auto-download** - `prepareForModding` downloads required mod framework dependencies during initial setup ([src/index.ts](https://github.com/Senjay-id/eldenring-vortex-extension/blob/47631fc/src/index.ts))
- **Auto-set primary tool** - `onDidDeploy` hook automatically sets ModEngine 2 as the primary tool when mods are deployed
- **Multi-installer routing** - 5 priority-based installers route mods to the correct handler based on type (co-op, mod loaders, DLLs, full ModEngine 2 mods)

### Nexus-maintained

#### [Starfield](https://github.com/Nexus-Mods/game-starfield)

Supports Steam and Xbox Game Pass with platform-aware deployment. Notable patterns:

- **Directory junction strategy** - creates junctions between the game's Data folder and Documents path for unified mod deployment across platforms ([setup.ts](https://github.com/Nexus-Mods/game-starfield/blob/30ea5cb/src/setup.ts))
- **INI merge system** - merges ASI mod configurations into a unified INI file during deployment ([iniMerge.ts](https://github.com/Nexus-Mods/game-starfield/blob/30ea5cb/src/merges/iniMerge.ts))
- **Conditional LOOT integration** - load order with LOOT auto-sort when available, fallback to manual drag-and-drop ([StarFieldLoadOrder.tsx](https://github.com/Nexus-Mods/game-starfield/blob/30ea5cb/src/loadOrder/StarFieldLoadOrder.tsx))
- **Platform-specific installers** - separate installers for SFSE (Steam) and ASI loader (Xbox) ([installers/](https://github.com/Nexus-Mods/game-starfield/tree/30ea5cb/src/installers))

#### [Oblivion Remastered](https://github.com/Nexus-Mods/game-oblivionremastered)

Manages 6 mod formats for a UE5-based Gamebryo remaster. Notable patterns:

- **UE4SS auto-download** - automatically downloads and configures UE4SS framework from GitHub releases with version checking ([downloader.ts](https://github.com/Nexus-Mods/game-oblivionremastered/blob/489f6b9/src/downloader.ts))
- **Stop pattern validation** - regex-based file hierarchy validation to prevent invalid mod structures ([stopPatterns.ts](https://github.com/Nexus-Mods/game-oblivionremastered/blob/489f6b9/src/stopPatterns.ts))
- **Architecture-aware binaries** - handles Win64 vs WinGDK paths for Steam and Xbox builds ([modTypes.ts](https://github.com/Nexus-Mods/game-oblivionremastered/blob/489f6b9/src/modTypes.ts))
- **Deployment event pipeline** - INI merging on `will-deploy`, Lua mod processing on `did-deploy`, settings bake on load order change ([eventHandlers.ts](https://github.com/Nexus-Mods/game-oblivionremastered/blob/489f6b9/src/eventHandlers.ts))
