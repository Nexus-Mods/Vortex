# Steam game folder check: PoC design

Date: 2026-10-25. Status: proof of concept, dev builds only, not a feature yet.

## Why

Vortex has always had to assume a user starts modding from a clean game folder. When that's not true (manual installs, leftovers from other managers, files mods write at runtime, an old setup that was purged), the leftovers clash with what Vortex deploys and nothing tells the user. There's no general way to know what "clean" means for any game folder, but Steam accounts for about 94% of Vortex installs and Steam keeps a per-file list of what it installed. That gives us a real baseline for most users. GOG (the next 4%) looks similar and is a likely follow-up.

The PoC has to show two things: the difference between what is in the game folder now and what the base game should be, and what would have to happen to make it clean. Moving the extra files into an archive outside the game folder is the next stage and isn't built here.

## Goals

- For a Steam game, put every file in the game folder into one of three buckets: **game**, **Vortex** or **unknown**.
- Flag base game files that are **modified** (hash differs from Steam's) or **missing**.
- Show the result on a game-scoped page, with the steps needed to make the folder clean written out.
- Prove it on the two real folders below.

## Non-goals

- Archiving, moving or deleting anything. The PoC never writes to the game folder.
- GOG, Epic, Xbox or any other store.
- Fetching depot manifests from Steam's servers when they aren't on disk.
- A whitelist for files the game creates itself (Creations, logs, INIs, caches). They're "unknown" for now; better categories can come later.
- Saving results between sessions, background checks or notifications.
- Linux and Proton paths.

## Anti-goals

- Anything that could change the game folder. A PoC that deletes the wrong file is worse than no PoC.
- Calling something dirty when we simply couldn't check it. If the baseline is missing, say so; don't guess.
- Slowing down game switching or startup. Hashing tens of GB only happens when the user asks for it.

## What we learned from recon

Checked on Simon's machine on 2026-10-25 with a throwaway script.

**Where Steam keeps the baseline.**

- `steamapps/appmanifest_<appid>.acf` has no file list. It has `InstalledDepots` (depot ID to manifest ID), `SharedDepots`, `buildid` and `installdir`.
- `<steam>/depotcache/<depotid>_<manifestid>.manifest` is the per-depot file list. Both Skyrim SE and Cyberpunk 2077 had a `.manifest` file for every installed depot, with IDs matching the ACF. Steam keeps manifests in the main install's `depotcache` even for games in another library (Cyberpunk is on `D:\SteamLibrary`, its manifests are under `C:\Program Files (x86)\Steam\depotcache`).
- Old manifest versions can sit next to the current one (`1091501_2461377369266892508` and `1091501_3389237510439361019`), so always pick by the manifest ID from the ACF, never by depot ID alone.

**Manifest format.** A sequence of sections, each a little-endian `uint32` magic, a `uint32` length and a protobuf body, ending with the end magic:

| Magic        | Section   | Body                                                                                                                                              |
| ------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0x71F617D0` | payload   | `ContentManifestPayload`: repeated field 1 = file mapping                                                                                         |
| `0x1F4812BE` | metadata  | field 1 depot ID, 2 manifest ID, 3 creation time, 4 filenames encrypted (bool), 5 original size, 6 compressed size, 7 unique chunks, 8 and 9 CRCs |
| `0x1B81B817` | signature | ignore                                                                                                                                            |
| `0x32C415AB` | end       | no length                                                                                                                                         |

File mapping fields: 1 filename (string, Windows separators, relative to the game folder), 2 size (uint64), 3 flags (uint32; 64 is a directory), 4 SHA1 of the filename, 5 SHA1 of the content (20 bytes), 6 chunks (repeated, ignore), 7 link target.

In every manifest we read, filenames were plain text (metadata field 4 was 0). If the flag is set, treat the depot as uncheckable.

The recon script is about 50 lines of plain varint and length-delimited decoding; no protobuf library was needed.

**What the two test folders look like.**

Skyrim SE (app 489830, depots 489831, 489832, 489833):

- 46 base game files; none missing, none differing in size (hashes not compared yet).
- 1,381 other files, 5.9 GB. 1,166 of them (1.2 GB) are listed in `Data/vortex.deployment.json` and `vortex.deployment.dinput.json`. About 130 (around 4.6 GB) are Anniversary Edition Creations (`ccBGSSSE*.bsa/.esl/.esm` and similar) that the game downloads itself outside Steam's depots. The rest is logs, `imgui.ini`, `Skyrim.ccc`, an SSEEdit folder inside `Data`, loose meshes and SKSE files.
- The shared redistributable depots (228986, 228990, under `_CommonRedist`) are listed in the ACF but their files aren't in the game folder.

Cyberpunk 2077 (app 1091500, depots 1091501 and 2138330 Phantom Liberty, shared 228988):

- 182 base game files, 81.4 GB; none missing, none differing in size.
- No `vortex.deployment*.json` at all: nothing is deployed, though four mods sit in staging.
- 65 `__folder_managed_by_vortex` marker files left in folders Vortex created.
- 133 unknown files, 41 MB, left from an earlier and much bigger setup that was purged: about 60 CET mod folders under `bin\x64\plugins\cyber_engine_tweaks\mods\` holding 48 `db.sqlite3` files plus settings JSONs and logs, `r6\cache\final.redscripts.modded` (21 MB), redscript logs, and configs and logs under `red4ext`.

Between them they cover the two cases the PoC needs: a folder where most of the extra is Vortex's own deployment plus game-downloaded content, and one where Vortex thinks it's clean but runtime leftovers remain.

## How it works

### Buckets

For each file under the game folder:

1. **Vortex** if any of these is true:
    - it's listed in a `vortex.deployment*.json` found in the game folder (resolve each entry's `relPath` against that manifest's `targetPath`);
    - it's a `vortex.deployment*.json` itself;
    - it's a `__folder_managed_by_vortex` marker;
    - it ends in `.vortex_backup`.
2. **Game** if it's in the depot manifests. It's also **modified** if its size differs, or its SHA1 differs, from the manifest entry.
3. **Unknown**: everything else.

Then every base file that isn't on disk is **missing**.

A file listed in a deployment manifest whose mtime no longer matches the entry's `time` (within 1 second, the same test as `isDeployedFile` in `src/renderer/src/extensions/mod_management/util/activationStore.ts`) stays in the Vortex bucket but is labelled **changed since deployed**. Purge leaves these files behind (it only deletes files whose mtime still matches), so they are real leftovers: a mod rewrote them while the game ran. Symlinked deployments are exempt, as they are in purge.

A base file Vortex has linked over (its original renamed to `.vortex_backup`) counts as Vortex, not modified. Size and hash checks only apply to game-bucket files.

Path matching is case-insensitive with Windows separators, because that's how the manifests store names and how the game sees them.

Shared depots from the ACF's `SharedDepots` are left out entirely. They are neither expected in the folder nor reported missing.

Steam's per-file flags matter (builder's call, not confirmed by Simon). Files flagged UserConfig (1) or VersionedUserConfig (2) are ones the game or user is expected to change, and Steam's verify doesn't restore them. They count as game but are never reported as modified; they are still reported missing if absent. Symlink entries (flag 512, or a link target in field 7) are checked for presence only. Directory entries (64) are skipped. Every file seen in the two test manifests had flags 0.

When two depots list the same path, the later depot in the ACF's `InstalledDepots` order wins, matching Steam's mount order.

### Which folder

Walk Steam's install folder for the app (`<library>/steamapps/common/<installdir>`), found by matching the game's Steam app ID to a Steam store entry, because depot paths are relative to it. Match by app ID rather than by Vortex's discovery path, as `storeGameVersionEvent.ts` does, so a hand-set discovery path that points at a Steam install still gets checked. If Vortex's discovery path differs from Steam's install folder, show both paths on the page. Look for `vortex.deployment*.json` in the folder being walked.

### Hashing

Compare sizes first. Only hash a game-bucket file when the sizes match, because a size mismatch is already "modified". Hash with SHA1 to match the manifest. This is the slow part (16 GB for Skyrim, 81 GB for Cyberpunk), so it runs only on demand, never at startup or on game switch, and shows progress.

The check runs the first time the page is opened for a game in a session. Main keeps the result in memory per game for the rest of the session; coming back to the page shows it again, and only Re-check runs it fresh. Leaving the page doesn't cancel a run in progress. Nothing is saved to disk.

### Where the code lives

- **Main process:** the manifest reader, the folder walk, bucketing and hashing. The renderer never touches the disk for this. It asks main over IPC, following `src/main/src/pocDetectedRequirements.ts` (a `pocX.ts` module with an `init` called from `main.ts`, using `betterIpcMain`, with the IPC types in `src/shared/src/types/ipc.ts`).
- **Renderer:** the page. It gets the game path, app ID, depot and manifest IDs, build ID and shared depots from the existing Steam store entry (`ISteamEntry.installData` in `src/renderer/src/util/Steam.ts`) and passes them to main. Main reads the `.manifest` files from `<steam path>/depotcache`.
- **Dev only:** gate the page the way the detected requirements PoC gates its health check (`process.env.NODE_ENV === "development"`).

### Not Steam, or no baseline

The page states that it can't judge the folder, and why, instead of showing buckets, when:

- the game wasn't found through Steam;
- a depot's `.manifest` for the ACF's manifest ID isn't in `depotcache` (name the depot and manifest ID);
- a manifest has encrypted filenames.

## The page

A game-scoped page called "Game folder", registered next to Mods and Collections (`registerMainPage` with `group: "per-game"`, like Collections). It only shows in dev builds. Mockup: `.superpowers/brainstorm/684-1792938969/content/page-v2.html` (option B in `placement.html` was chosen over a dialog on game switch and a notification).

- **Header:** game folder path; Steam, build ID and depot IDs used; when it was last checked; a Re-check button.
- **Summary:** a bar split into game, Vortex and unknown, with file counts and sizes, plus counts for modified, missing and changed since deployed.
- **To make it clean:** the steps written out, with real numbers:
    1. Move N unknown files (X MB) out of the game folder, plus the K Vortex files changed since deployed, which purge would leave behind. The Archive button is there but disabled; it's the next stage.
    2. Remove the empty folders left behind.
    3. Restore M modified or missing game files with Steam's verify. The Verify in Steam button is disabled too: launching `steam://validate/<appid>` makes Steam write to the game folder, which the PoC doesn't do. If any base file has a `.vortex_backup` next to it, the step says to purge in Vortex first, because Steam's verify would otherwise overwrite deployed files.
- **Unknown files:** grouped by folder, expandable to each file with size and modified date. The game and Vortex buckets are listed too, collapsed.
- **Progress** while the folder is walked and hashed.

## Decided by Simon

- Three buckets: game, Vortex, unknown. Game-created content (Creations, logs, INIs) is unknown for now.
- Modified base files are in scope, using the hashes in Steam's manifests.
- A game-scoped page next to Mods and Collections, not a dialog or notification.
- The PoC reports; it doesn't archive or clean.
- Steam only.
- Deployed files a mod has rewritten stay in the Vortex bucket with a "changed since deployed" label and count towards the steps to make the folder clean.

## Calls made in the conversation, not confirmed by Simon

- Shared redistributable depots are ignored.
- `.vortex_backup` files and linked-over base files count as Vortex.
- An empty folder holding only a Vortex marker counts as Vortex.
- A missing depot manifest means "can't check", with no fallback to Steam's servers.
- Sizes before hashes; hashing only on demand.
- Dev-only gating and main-process disk access.
- Results aren't saved between sessions; they're kept in memory for the session and only Re-check reruns.

## Calls made after review, not confirmed by Simon

- UserConfig and VersionedUserConfig files are never reported as modified; symlinks are checked for presence only.
- The folder walked is Steam's install folder, matched by app ID.
- Both action buttons (Archive and Verify in Steam) are disabled. Step 3 says to purge first when Vortex has linked over base files.

## Left to the builder

- Module and file names, IPC channel names and payload shapes.
- Whether the manifest reader is a function in main or a small package under `packages/`.
- How to hash SHA1 in main. The existing pool in `src/main/src/hash/` only supports `md5` (`HashAlgorithm` in `src/shared/src/types/ipc.ts`); extending it or hashing in the PoC module directly are both fine.
- Concurrency of hashing and how progress is reported.
- Exact page layout and styling within the modern layout. The classic layout doesn't matter.
- Tests: unit tests for the manifest reader (a real small manifest such as `489833_4886117324142477814.manifest`, 1.6 KB, makes a good fixture) and for bucketing.

## Follow-up: faster hashing (agreed 2026-10-25, not built)

Full hashing reads every base file: 16 GB for Skyrim SE, 81 GB for Cyberpunk 2077. Simon asked whether we could hash only what changed. The data available:

- On disk: size and modified date.
- In the ACF: `lastupdated` and the build ID.
- In the depot manifest: each file's size and SHA1, plus a SHA1 for every chunk of the file (field 6: chunk SHA1, CRC, offset, original size, compressed size). Chunks are 1 MB. Chunk SHA1s were checked against the bytes on disk for `SkyrimSE.exe` and `Skyrim - Textures1.bsa`, first and last chunk, and matched.

Modified dates aren't a safe filter. On Cyberpunk every base file was older than `lastupdated`. On Skyrim, 10 of 46 were newer (Creation Club files the game touched) and 17 were dated 2008. Explorer copies and most archive extractors keep the source's date, so a file dropped in by hand often looks older than Steam's update.

The agreed direction: by default, hash a few chunks per file (first, last and two from the middle) and compare with the chunk SHA1s, about 4 MB read per file. Hash `.exe` and `.dll` files in full, since those are what byte patches target. Keep a "full check" for the thorough version. Optionally remember hashes against path, size and date so Re-check only rehashes what changed.
