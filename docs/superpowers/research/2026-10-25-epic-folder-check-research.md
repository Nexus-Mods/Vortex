# Epic: local data for checking a game folder

Research by Simon, 2026-10-25, for extending the Steam game folder check PoC (`docs/superpowers/specs/2026-10-25-steam-game-folder-check-poc-design.md`) to Epic. GOG not looked at yet. The parser below is `epic-manifest.mjs` in this folder, copied from the research session's scratchpad.

## Where the data is

`C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests\<guid>.item`: one JSON file per install. Fields that matter: `InstallLocation`, `AppName`, `CatalogItemId`, `AppVersionString`, `InstallTags`, `ManifestLocation`, `ManifestHash`, `PendingManifestPath`, `bIsIncompleteInstall`. There's no per-file data in it.

`<InstallLocation>\.egstore\<guid>.manifest`: the build manifest the launcher's "Verify" uses. It lists every file in the build with a SHA1. All three installs on Simon's machine (FTL, ABZU, Fallout 3 GOTY) have one.

## Format (binary, little-endian)

Header:

- u32 magic `0x44BEC00C`
- u32 header size
- u32 uncompressed size
- u32 compressed size
- 20-byte SHA1 of the body
- u8 storedAs (bit 1 means zlib)
- u32 version

Body: sections for Meta, Chunk Data List and File Manifest List, each starting with a u32 size so you can skip it.

The file list holds names (FStrings), then symlink targets, then a 20-byte SHA1 per file, then flags, install tags and chunk parts. Newer file list versions add MD5 and SHA256. All three manifests here are file list version 0 (manifest version 17), so they only have SHA1.

FStrings are an i32 length. Positive means latin1 with a null terminator; negative means UTF-16.

Legendary (github.com/derrod/legendary) is the reference parser. `epic-manifest.mjs` is about 70 lines: `node epic-manifest.mjs <manifestPath> <installDir> [maxFiles]`.

## Tested

- FTL: all 8 files matched.
- Fallout 3 GOTY: all 311 installed files matched. 592 entries were "missing", and every one checked belonged to the uninstalled language folders.

## Gotchas

- **Install options.** The manifest covers every install option. Filter entries by the `.item`'s `InstallTags` first, or uninstalled languages and optional components show up as missing files.
- **Game-written files.** The game's own files are listed too: `FTL.log` is in the FTL manifest. Logs, configs and saves the game writes in normal play will show as changed, so we need an ignore list or per-game rules. Steam has the same problem.
- **Not tamper-proof.** The body hash in the header only protects against corruption. There's no signature, and the file sits in the game folder where a mod tool could edit or delete it. It catches accidental and unknown changes, not deliberate ones.
- **Updates.** It always describes the build installed now; an update replaces it. Mid-update, `PendingManifestPath` is set and `bIsIncompleteInstall` may be true, so skip or defer the check in that state.
- **Speed.** Hashing everything is slow on big games. Each file's expected size can probably be had by adding up its chunk part sizes; check sizes first and hash only the files that differ. Not tested.
- **One compare path.** Use SHA1 for the compare. Steam's depotcache also uses SHA1, so one compare path could serve both stores.
- **Finding the manifest.** The `.item`'s `InstallationGuid` and the manifest file name won't always match. Use `ManifestLocation` from the `.item` to find the folder, and don't assume the file name.
- **Moved folders.** The `.item` is in ProgramData but the manifest is inside the game folder. If the user moves the game folder by hand, the `.item` paths go stale.

## Compared with Steam

Epic is simpler. One manifest per install sits right beside the game, the format is documented by Legendary, and all three installs checked had one. With Steam you go through `depotcache`, which can be missing for older installs.

The same problems apply to both: files the game writes, optional content and in-progress updates.

## Open for the PoC

- Where the ignore list for game-written files comes from (per game, or a heuristic such as `*.log` and `*.ini`).
- Whether to check DLC as well. DLC gets its own `.item` and manifest, with `MainGameAppName` pointing at the base game.
- Whether the check happens before Vortex first deploys, or also afterwards to spot changes made outside Vortex.
