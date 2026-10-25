# GOG: data for checking a game folder

Research for Simon, 2026-10-25, for extending the Steam game folder check PoC (`docs/superpowers/specs/2026-10-25-steam-game-folder-check-poc-design.md`) to GOG. Sits beside the Epic note (`2026-10-25-epic-folder-check-research.md`). The parser below is `gog-manifest.mjs` in this folder, copied from the research session's scratchpad.

Everything here was read-only. Galaxy's database was copied into the scratchpad and opened there. Nothing needed a GOG login.

## Where the data is

Three GOG products are installed on Simon's machine, all through Galaxy 2.0, all generation 2 builds:

- The Witcher 3: Wild Hunt GOTY, product 1495134320, build 57606063263997132 (4.04b)
- Skyrim Special Edition, product 1711230643, build 57252778576965358 (0.1.3905696)
- Skyrim Anniversary Upgrade, product 1162721350, a DLC of 1711230643 installed into the same folder

**Registry.** `HKLM\SOFTWARE\WOW6432Node\GOG.com\Games\<productId>`: one key per product, DLC included. Values that matter: `gameID`, `path`, `BUILDID`, `ver`, `language`, `lang_code`, `dependsOn` (DLC to base game) and `DLC` (base game to DLC ids). No per-file data. `ver` is a free-text label and can disagree with GOG's own name for the build: Witcher 3 says `4.04a_REDkit_Update_2` where the builds endpoint calls the same build id `4.04b`.

Vortex already reads this key in `src/renderer/src/util/GOGLauncher.ts` (`gameID`, `path`, `startMenu` only). Because DLC has its own key with the same `path`, the Anniversary Upgrade turns up as a separate store entry pointing at the Skyrim folder. `identifyGame` checks for `gog.ico`. `storeGameVersionEvent.ts` reads `goggame-<appid>.info` and regexes `buildId` and the first `languages` tag out of it, because build ids pass 2^53.

**In the game folder.**

- `goggame-<productId>.info`: JSON, one per installed product (base game and each DLC). Has `buildId`, `gameId`, `rootGameId`, `languages` (locale tags, for example `["en-US"]`), `language` (a name, for example `English`), `playTasks`. This is enough to find the build manifest online. No per-file data.
- `goggame-<productId>.hashdb`: a zip holding one 12-byte file (`0c000000 01000000 00000000`). It is the same on both games and looks like an empty table. It ships as part of the build. No use to us.
- `goggame-galaxyFileList.ini`: Galaxy's uninstall list. One section per product plus one per redistributable, `files_counter` and `F<n>=<relative path>`. No hashes or sizes. The odd hex `F0` entry is the MD5 of the build's small-files container (see below), not a file on disk.
- `goglog.ini`, `gog.ico`, `goggame-<id>.ico`, `support.ico`, `unins00N.{exe,dat,ini,msg}` and a launch `.lnk`: Galaxy's own files, not in any manifest.

**Galaxy's database.** `C:\ProgramData\GOG.com\Galaxy\storage\galaxy-2.0.db`, SQLite in WAL mode, live while Galaxy runs. Copy the `.db`, `-wal` and `-shm` together and open the copy. Tables that matter:

- `InstalledBaseProducts`: `productId`, `generation`, `installationPath`, `buildId`, `branch`, `languageId`. Base games only.
- `InstalledProducts`: base games and DLC.
- `GameFiles`: `installPath` (relative, backslashes), `productId`, `hash` (whole-file MD5), `fileAttribute` (1 means executable). One row per file of every installed product.
- `GameFileChunkHashes`: per chunk `md5`, `size`, `compressedMd5`, `compressedSize`, `offsetInInstallLocation`. The file's size is the sum of its chunk sizes.
- `ProductStates` (`installation`, `operation`; both installed games are 3 and 0) and `DelayedAutoUpdates`. `jobs.db` next to it has the install and update job queues, all empty here.
- `Manifests`: the build manifest JSON per product. Careful: this is the build Galaxy plans to install next, not the one on disk. For Witcher 3 it holds 5.00b (build 60082306942093870) because an auto-update is queued in `DelayedAutoUpdates`, while `GameFiles` and the folder are still 4.04b.

The `Users` table and anything token-shaped was not read. `ProductSettings` has a `password` column (branch passwords) and was not read either.

`C:\ProgramData\GOG.com\Galaxy\prefetch` is access denied to a normal user. Nothing under `%LOCALAPPDATA%\GOG.com\Galaxy` holds file lists; it has per-game cloud storage folders and `Configuration`, which was not opened.

**GOG's content system, no login needed.**

1. `https://content-system.gog.com/products/<productId>/os/windows/builds?generation=2` (and `generation=1`): JSON list of builds with `build_id`, `version_name`, `generation`, `branch`, `link`. Build ids pass 2^53, so quote them before `JSON.parse`.
2. The `link` for a generation 2 build: `https://gog-cdn-fastly.gog.com/content-system/v2/meta/<aa>/<bb>/<hash>`, the build manifest.
3. Each depot in it: same URL pattern with the depot's `manifest` hash.

Exact URLs fetched in this research:

- `https://content-system.gog.com/products/1711230643/os/windows/builds?generation=2`, also with `&page=2`, `&limit=100`, `&_version=2`, `&build_id=...` (all returned the same two items)
- `https://content-system.gog.com/products/1495134320/os/windows/builds?generation=2` and `?generation=1`
- `?generation=1` for the 13 product ids in the Galaxy library (to find a generation 1 example)
- `https://gog-cdn-fastly.gog.com/content-system/v2/meta/62/ce/62cea9855bbf14b4e6092d6b397a088f` (Skyrim build) and the depot manifests it names
- `https://gog-cdn-fastly.gog.com/content-system/v2/meta/7e/28/7e2838a838216910400667bcf430149c` (Witcher 3 4.04b build) and the depot manifests it names
- `https://gog-cdn-fastly.gog.com/content-system/v1/manifests/1207658924/windows/45240862/repository.json` and its two depot JSON files (The Witcher Enhanced Edition, generation 1, not installed)

Downloading the files themselves needs a `secure_link`, which needs auth. We don't need the files, only the manifests, so that wasn't tried.

**Galaxy against the offline installer.** Couldn't test: every GOG game on this machine is a Galaxy install. What can be said:

- A Galaxy install has a row in `InstalledBaseProducts` and a `goggame-galaxyFileList.ini` in the folder. Either is a reasonable test for "Galaxy install". An offline install should have neither, but that's unverified.
- Every generation 2 build manifest has an `offlineDepot` holding one `project.json` (4 KB for Skyrim, 31 KB for Witcher 3), which is presumably what the offline installer is built from. If offline installers write a `.info` with the same `buildId`, the CDN route works for them unchanged, subject to the old-builds problem under Gotchas, which will hit offline installs more often since they're never updated.

## Format

**Generation 2** (everything installed here). Build and depot manifests are zlib-compressed JSON (starts `78 9c`). The hash in the URL is the MD5 of the compressed bytes, so a manifest can be checked against its own URL.

Build manifest (`version: 2`): `baseProductId`, `buildId`, `installDirectory`, `products` (base game and DLC ids), `dependencies`, `offlineDepot`, and `depots`. Each depot has `manifest` (hash), `productId`, `languages` (locale tags, or `["*"]`), `size`, `compressedSize`, sometimes `osBitness` and `isGogDepot` (the small per-language depots that carry `goggame-*.info` and `.hashdb`). It also has the game's Galaxy SDK `clientId` and `clientSecret`; they belong to the game, not the user, and aren't needed.

Depot manifest: `depot.items[]`, and optionally `depot.smallFilesContainer`. Item types are `DepotFile`, `DepotDirectory` and `DepotLink`; only `DepotFile` appeared here. A `DepotFile` has:

- `path`: relative, backslashes
- `chunks[]`: `md5`, `size`, `compressedMd5`, `compressedSize`. Most chunks are 10 MiB uncompressed, but not all (the last chunk of `SkyrimSE.exe` is 15.2 MiB). File size is the sum of chunk sizes.
- `md5`: whole-file MD5, only present when it differs from the single chunk's (multi-chunk files, and files packed in the small-files container). For a single-chunk file use `chunks[0].md5`. Zero-byte files have no chunks and no `md5`; their MD5 is `d41d8cd98f00b204e9800998ecf8427e`.
- `sha256`: on a few files only (5 of 210 in Skyrim, 8 of 2,546 in Witcher 3; `SkyrimSE.exe` is one).
- `sfcRef` (`offset`, `size`): the file is packed into the small-files container for download. Use `sfcRef.size` as the size.
- `flags`: for example `["executable"]`.

**Generation 1** (older builds; none installed here). The builds endpoint's `link` points at `.../content-system/v1/manifests/<productId>/windows/<legacy_build_id>/repository.json`, plain JSON. `product.depots[]` has `manifest` (a file name next to `repository.json`), `gameIDs`, `languages` as names (`English`, `Neutral`). The depot file has `depot.files[]` with `path` (leading `/`), `size`, `hash` (MD5), `offset` and `url` into one big `main.bin`, plus `directory` and `support` flags. Support files are installer helpers and aren't installed into the game folder.

So both generations give a full file list with a whole-file MD5 and a size per file. MD5 is the common hash.

`gog-manifest.mjs` is about 170 lines: `node gog-manifest.mjs <installDir> [--hash] [--max N] [--db <copy of galaxy-2.0.db>] [--build <buildId>] [--all-langs]`. By default it reads the `.info` files, looks the build up on the builds endpoint (generation 2, then 1), fetches the manifests, filters depots to installed products and the installed language, and compares sizes. `--hash` also compares MD5s. `--db` takes the file list from a copy of Galaxy's database instead.

## Tested

- **Skyrim SE plus Anniversary Upgrade** (one folder, two products, 6 of 38 depots used): all 210 files matched size and MD5 from the CDN manifests. 32.1 GiB hashed in 50 s. Nothing missing, nothing changed. 14 files on disk weren't listed, all Galaxy's own (`goggame-galaxyFileList.ini`, `goglog.ini`, icons, the `.lnk`, `unins000.*`, `unins001.*`; one uninstaller per product).
- **Witcher 3 GOTY** (8 of 39 depots used): all 2,546 files matched size and MD5 from the CDN manifests. 51.9 GiB hashed in 139 s. 10 files on disk weren't listed, the same Galaxy set as Skyrim with one uninstaller.
- **Galaxy database against the CDN.** For both games `GameFiles` lists exactly the same files as the CDN manifests, and every MD5 agrees (210 of 210, 2,546 of 2,546). So the local database and the public manifests are interchangeable for an install that Galaxy manages, as long as you read `GameFiles` and not `Manifests`.
- **Generation 1** parsing was run against the public Witcher Enhanced Edition manifests with a fake folder in the scratchpad holding only a hand-written `.info`: 2,669 files listed, 2,668 missing and the `.info` itself flagged as a different size (generation 1 depots include it). That's the expected result. Not tested against a real install.

Neither game showed anything changed, so this run doesn't show how game-written files look. Both folders were clean installs with no mods deployed (Witcher 3 has an empty `Mods` folder; empty folders aren't reported).

## Gotchas

- **Two sources, pick by situation.** Galaxy's `GameFiles` works offline and covers whatever build is installed, but only for Galaxy installs, and only while the DB is there. The CDN needs network and only works if the installed build is still on the builds list (next point). The `.info` files are what link a folder to either source.
- **Old builds drop off the list.** The builds endpoint returns a short list, not every build: Skyrim says `total_count` 500 and returns 2, Witcher 3 says 251 and returns 7 (the latest few, plus one per branch such as `Classic`). No query parameter tried changed that. A user who stays on an older build (Galaxy lets you roll back or turn off updates) or an older offline installer may have a build id that isn't listed, and then there's no public way to get the manifest hash. Fall back to the Galaxy DB, or call the folder uncheckable.
- **Languages and DLC.** The build manifest lists every language and every DLC. Filter depots by the products that have a `goggame-<id>.info` in the folder and by the `.info`'s `languages`, or uninstalled language packs show up as missing (Witcher 3 has a roughly 4 GB voice depot per language). Most big depots list all languages, so the language only changes a few depots.
- **DLC lives in the base game's folder.** It has its own product id, registry key, `.info`, uninstaller and `GameFiles` rows, but shares the build manifest of the base game. For Skyrim the Anniversary Upgrade is 142 files under `Data`.
- **Updates.** The `.info`, the registry `BUILDID`, `InstalledBaseProducts.buildId` and `GameFiles` all describe the build on disk. Galaxy's `Manifests` table already holds the next one when an update is queued. Mid-update, `ProductStates.operation` should be non-zero and `jobs.db` should have an `UpdateProductJobs` row; skip the check then. Not seen in practice here: nothing was updating.
- **Game-written files.** The manifests can include files the game rewrites. Witcher 3 ships zero-byte `texture.cache` and `collision.cache.tmp` files in several `dlc\dlcN\content` folders. They were still empty here, but if the game ever fills them they'll show as changed. Skyrim keeps its saves and INIs in Documents, so its folder stayed clean. We'll need an ignore list, same as Steam and Epic.
- **Galaxy's own files.** `.info` and `.hashdb` are in the manifest and match. The icons, `goglog.ini`, `goggame-galaxyFileList.ini`, uninstallers and the `.lnk` aren't, so they need a fixed ignore list or they show as added.
- **Not tamper-proof locally, mostly tamper-proof online.** The Galaxy DB and the game folder are both writable by ordinary users, and nothing in them is signed. The CDN manifests come over HTTPS and their URL is their own MD5, so the file list itself can be trusted. What can be edited is the `buildId` in the `.info`, which would point the check at a different genuine build.
- **Moved folders.** The registry `path` and `InstalledBaseProducts.installationPath` go stale if the folder is moved by hand, and Galaxy loses the game until it's re-imported. The CDN route only needs the `.info` files in the folder, so it still works. `GameFiles` rows are keyed by product id, not path, so they're still usable too.
- **Hash choice.** GOG gives MD5 everywhere and SHA256 only on a handful of files. Steam and Epic give SHA1. The compare has to work per store, or hash with both.
- **Speed.** Sizes come free from the manifest (chunk sizes or `sfcRef.size`), so size first and hash only on demand works. It found no false positives here.

## Compared with Steam and Epic

GOG is the easiest of the three to get a file list for. Generation 2 manifests are plain zlib JSON, and the public endpoints need nothing but the product id and build id from the `.info` in the game folder. For Galaxy installs there's also a complete local copy of the same list, with whole-file MD5s, in Galaxy's SQLite database. Steam needs a protobuf parser and `depotcache`, Epic needs a binary parser, and both are local only.

What GOG lacks: the online list can't reach older builds, and the hash is MD5 rather than the SHA1 Steam and Epic share. The problems shared with both are the same: game-written files, language and DLC filtering, and in-progress updates.

## Open for the PoC

- Which source goes first: Galaxy DB (offline, Galaxy only, needs copying a live SQLite file from ProgramData) or CDN (works for offline installs and moved folders, needs network, misses old builds). Probably CDN first with the DB as a fallback.
- Whether Vortex main can read `galaxy-2.0.db` without copying it. It's in WAL mode and Galaxy holds it open; a read-only connection should work but wasn't tried.
- An offline-installer test, to confirm what its `.info` and registry look like.
- The ignore list for Galaxy's own files and game-written files.
- Whether to keep DLC as separate store entries, since `GOGLauncher` already lists the Anniversary Upgrade as its own entry pointing at the Skyrim folder.
