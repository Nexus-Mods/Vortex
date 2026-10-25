# Xbox: data for checking a game folder

Research for Simon, 2026-10-25, for extending the Steam game folder check PoC (`docs/superpowers/specs/2026-10-25-steam-game-folder-check-poc-design.md`) to games installed through the Xbox app (PC Game Pass and Microsoft Store GDK games). Sits beside the Epic and GOG notes. The parser below is `xbox-manifest.mjs` in this folder.

Short version: every Xbox install keeps a full file list with exact sizes next to the game folder, offline, in a file normal users can read but not write. It doesn't give us usable hashes. The package's block hash tree is also on disk, but only a handful of small registration files are stored unencrypted. Every other block is hashed as ciphertext, and the key belongs to Gaming Services under the game's licence. So on Xbox we can check paths and sizes for everything, and hashes only for about 8 small files.

Everything here was read-only. The game folder was read in place and the package files were copied to the scratchpad. About 8 MB of the public package was fetched from Microsoft's CDN with range requests. Nothing needed a login.

## What was tested

One game: Hades II from Game Pass, installed through the Xbox app (`Microsoft.GamingApp_2610.1001.20.0`) to `C:\XboxGames\Hades II` during this session. Package `SupergiantGamesLLC.HadesII_1.14.296.0_x64_137573_q53c1yqmx7pha`, Store id `9PCR3Z2MSM4T`, content id `E8C150E2-1EA6-45F8-85CF-FF0A50BB72F2`, version 1.14.296.0. 6,061 files, 13,734,507,327 bytes (12.8 GiB). Freshly installed, never launched, no mods.

While installing, the folder is named after the content id (`C:\XboxGames\E8C150E2-...`). It's renamed to the game's name when the install finishes.

## Where the data is

**Drive root.** `C:\.GamingRoot` (`RGBX`, version 1, then the UTF-16 folder name `XboxGames`). Vortex already reads this in `src/renderer/src/util/xbox/util.ts`.

**Registry.** `HKLM\SOFTWARE\Microsoft\GamingServices\PackageRepository\Package` maps the package full name to `{<instance id>}#{<content id>}`. `...\PackageRepository\Root\{instance}#{content}\...` has the `C:\Program Files\WindowsApps\<package>` root, which a normal user can't list. `XboxLauncher.ts` already reads Gaming Services' `MutableLocation` / `MutableLink`, which is how Vortex lands on the `Content` folder.

**Next to `Content`** (all named after the content id):

- `<contentId>.smd`: the file list. XVC segment metadata, 640 KB. Every file's path and size, plus a flag that is 1 on executables. Users have read and execute only on it. Format below.
- `<contentId>` (no extension): 111,497,216 bytes. Byte for byte the first 111,497,216 bytes of the published `.msixvc` package, which is everything before the file data starts: the signed XVD header (`msft-xvd` at 0x200), the block hash tree, the package's user data and the NTFS metadata of the package volume. The user data holds the package signature (`P7X`), the original `appxmanifest.xml`, `MicrosoftGame.config`, `Summary.json`, `Metadata.json` (`{}`) and `SegmentMetadata.bin`. The `.smd` is that `SegmentMetadata.bin` with only the 16-byte GUID in its header changed; every record and path is the same.
- `<contentId>.xvs`: the install request, UTF-16 JSON. Store id, SKU, shader state id, the CDN URLs of the `.msixvc` (plain HTTP on `assets1/assets2/d1/d2.xboxlive.com`) and 10 URLs of update plan files (`update-<from version>.<guid>.xsp`).
- `<contentId>.<pduid>.xsp`: an update/streaming plan. Header `MS-XPFM`, then 16-byte records of block start and block count. No hashes.
- `<contentId>.xvi` (`crdi-xvc` magic) and `<contentId>.xct`: install state. No per-file data worth reading.
- `Shaders\<contentId>.xss`: a shader cache, outside `Content`.

**In `Content`**: `appxmanifest.xml`, `MicrosoftGame.Config` (identity, version, Store id, title id) and `layout_<guid>.xml`. The layout file is the developer's packaging layout: folder globs (`Include="*.*"`), no file list.

**The package on the CDN.** The `.xvs` URL answers without auth: `Content-Length` 13,860,401,152, `Accept-Ranges: bytes`. Its first 111,497,216 bytes match the local prefix file exactly. The file data after that is encrypted apart from the registration files (next section). Fetched in this research: bytes 0 to 65,535, 110,000,000 to 113,999,999 and 114,000,000 to 117,999,999 of `http://assets1.xboxlive.com/7/0b942cb7-e6a4-43d6-a85f-7f650cfc7dd6/e8c150e2-1ea6-45f8-85cf-ff0a50bb72f2/1.14.296.0.cf1e1302-302b-4fa4-9b36-c2bf46483d1a/SupergiantGamesLLC.HadesII_1.14.296.0_x64_137573_q53c1yqmx7pha.msixvc`.

## Format

**`.smd`.** Little endian. Header (100 bytes): magic `" PFX"`, two u32 versions (4, 2), u32 header length (100), u32 segment count (6,061), u32 path table length, a 16-byte GUID, padding. Then one 16-byte record per file: u16 flags, u16 path length in characters, u32 path offset into the table, u64 size. Then the path table: UTF-16, NUL terminated, relative to `Content`, backslashes. Files come in package order, which is also the order of their data blocks. Three files have flag 1 (`crashpad_handler.exe`, `F10.exe`, `Hades2.exe`).

**Hash tree.** The package is an NTFS volume image cut into 4 KiB blocks. Each file starts on a new block, in `.smd` order, and its last block is zero padded. Level 0 of the tree is a run of 4 KiB pages holding 170 entries of 24 bytes each (for Hades II it starts at byte 675,840 of the prefix file). There are two kinds of entry:

- Unencrypted block: the first 24 bytes of SHA-256 over the plaintext block.
- Encrypted block: the first 20 bytes of SHA-256 over the encrypted block, then 4 bytes that are the same for every block of a file (`d1a6a51f` across `amd_ags_x64.dll`, `9a483dcc` across `bink2w64.dll`). Probably the XTS tweak or key material.

In Hades II the first 9 files in the list (blocks 0 to 700) are stored unencrypted: `Logo44x44.png`, `MicrosoftGame.Config`, `resources.pri`, `SplashScreen.png`, `Square150x150Logo.png`, `Square480x480.png`, `StoreLogo.png`, the layout XML and `appxmanifest.xml`. From `amd_ags_x64.dll` (block 701) on, the package data on the CDN is encrypted (no `MZ` header, random bytes) and the tree hashes those bytes. Checked by downloading blocks 699 to 800 and comparing them with the tree.

The region table that says which blocks are encrypted wasn't decoded. The script tells the two apart by trying the plaintext hash.

**`Summary.json`** (inside the prefix): `{"PackageFeatures": {"SupportsIntelligentDelivery": false, "SupportsInstallFeatures": false, "SupportsInstallRecipes": false, "SupportsDefaultEnableMods": true, "GDKVersion": "10.0.26100.4125"}}`. `SupportsDefaultEnableMods` looks like the GDK switch for a modifiable install, so it may be worth reading for its own sake.

`xbox-manifest.mjs` is about 150 lines: `node xbox-manifest.mjs <installDir> [--hash] [--max N]`. It takes the folder holding `Content` (or `Content` itself), parses the `.smd`, compares sizes, lists files it can't open and files on disk that aren't in the list. `--hash` reads the prefix file and checks every block of each file whose first block matches the tree.

## Tested

- **Hades II, clean install.** 6,061 listed, 0 missing. 1 size differs: `appxmanifest.xml` (3,000 bytes, listed 2,990). 3 can't be opened: the three flag-1 executables. 1 not in the list: `gamelaunchhelper.exe`. With `--hash`, 8 files verified block by block against the tree, 6,049 size match only, 0 hash mismatches. 0.8 s for the whole folder, size check and hashing included.
- **The two odd files are the installer's.** A copy of `appxmanifest.xml` taken mid-install was 2,990 bytes. After install the only change is `Executable="Hades2.exe"` becoming `Executable="GameLaunchHelper.exe"`, and `gamelaunchhelper.exe` appeared in the same step.
- **Negative test.** A fake install in the scratchpad with the side files, the 8 registration files and one byte changed at offset 1,000,000 of `SplashScreen.png`: reported as `hash differs`, the other 7 verified, everything else missing.

## Gotchas

- **No usable hashes for game data.** 6,049 of 6,061 files can only be checked by size. A change that keeps the size (a byte patch, a same-length text edit, a replaced texture of identical size) won't show. Sizes still catch most real mods and leftovers, and the not-in-list check works fully.
- **Don't try to decrypt.** Checking against the encrypted hashes would mean encrypting our plaintext with the package key. That key comes from the licence through Gaming Services. Using it would be getting around the DRM, so it's off the table.
- **Executables can't be read.** `Hades2.exe`, `F10.exe` and `crashpad_handler.exe` give EPERM to a normal user, though their ACLs are the same as a PNG's (`Users` read, `Authenticated Users` modify) and they aren't reparse points. Probably the Gaming Services file system filter protecting flag-1 files. Not tried as admin, and not tried whether they can be written or replaced. A check can only report them as present at the right size.
- **Launcher-owned files.** `appxmanifest.xml` is rewritten on install and `gamelaunchhelper.exe` is added. Both need to be on the ignore list, like Galaxy's files on GOG.
- **One game only.** Not tested: a game with Intelligent Delivery or install features (`Summary.json` says Hades II has neither; with them, the list may include content that isn't installed and would show as missing), a game mid-update, a game after an update (the `.xsp` plans suggest updates are block patches, and whether the `.smd` is rewritten is unverified), games installed under `ModifiableWindowsApps` before the `XboxGames` layout (`XboxLauncher.ts` still checks for that folder name), and a moved or second-drive library.
- **Region boundary.** The script finds the unencrypted files by trying the hash. If a user edits a registration file without changing its size, it looks like an encrypted file and passes as a size match. Decoding the region table would close that.
- **Game-written files.** Not seen: Hades II wasn't launched. It keeps saves under `C:\XboxGames\GameSave` and in the user profile, so its `Content` folder may stay clean, but other games will write logs and configs next to their files, as on every other store.

## Compared with Steam, Epic and GOG

Getting the list is easier on Xbox than anywhere else. It's one small binary file at a fixed place next to the game folder, offline, read-only to users, and it's a copy of the signed package's own metadata. No launcher database, no network and no build lookup.

Hashes are the weak point. Steam and Epic give SHA1 per file and GOG gives MD5. On Xbox, the only hashes are of encrypted blocks, which we can't use. Of the four stores, it's the only one where a folder can't be fully verified offline.

If Xbox needs real hashes, the options are:

1. Size check only. Ships with what's on disk today and catches added files, removed files and most changed ones.
2. Hash on first sight. When Vortex first manages a game and the size check comes back clean, hash the readable files and keep them as the baseline. It trusts the folder as it is at that point, which is the assumption Vortex makes today anyway.
3. Reference hashes from Nexus, keyed by content id and version, from a clean install we hash ourselves. Needs a backend and a way to keep up with Game Pass updates.

## Open for the PoC

- Whether a size check is good enough for Xbox, or whether option 2 or 3 is worth building.
- What the executables look like to an elevated process, and whether Vortex can replace them at all (it matters for script extenders, not for the check).
- Testing more games: one with Intelligent Delivery, one updated since install, one installed before the `XboxGames` layout.
- The ignore list: `appxmanifest.xml`, `gamelaunchhelper.exe`, plus game-written files.
- Whether to read `SupportsDefaultEnableMods` from the prefix to tell users up front whether a Game Pass game can be modded.
