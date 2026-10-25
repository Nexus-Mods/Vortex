# Steam Game Folder Check PoC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dev-only "Game folder" page that sorts every file in a Steam game's folder into game, Vortex or unknown, flags modified and missing base files, and lists the steps to make the folder clean.

**Architecture:** Main reads Steam's binary depot manifests from `<steam>/depotcache`, walks the game folder, reads `vortex.deployment*.json`, buckets the files and SHA1-hashes base files on demand. The result is held in memory per app ID. The renderer resolves the Steam entry for the active game, starts a check over IPC, polls its status (as the updater does) and renders the page. Nothing writes to the game folder.

**Tech Stack:** TypeScript, Electron main and renderer, `betterIpcMain`/`betterIpcRenderer`, `node:crypto` SHA1, React 18 with Tailwind v4, vitest.

**Spec:** `docs/superpowers/specs/2026-10-25-steam-game-folder-check-poc-design.md`

## Global Constraints

- Dev builds only. Main registers nothing unless `process.env.NODE_ENV === "development"`; the renderer extension returns `false` from `init` when `process.env.NODE_ENV === "production"`.
- Never write to, move or delete anything in the game folder. No `steam://` URL is opened.
- All disk access is in main. The renderer only uses `window.api.poc.*`.
- Steam only. Windows paths. Path matching is case-insensitive, with `\` separators.
- Steam file flags: Directory `64` is skipped; UserConfig `1` and VersionedUserConfig `2` are never reported modified; Symlink `512`, or a non-empty link target, is checked for presence only.
- "Changed since deployed" means `Math.abs(mtimeMs - entry.time) >= 1000`, the inverse of `isDeployedFile` in `src/renderer/src/extensions/mod_management/util/activationStore.ts`. Symlinked files are never flagged.
- Hashing runs only on page open (first time per app in a session) or Re-check, never at startup or on game switch. Leaving the page doesn't cancel a run.
- Commit subjects use the `poc: ` prefix like the other PoC branches, with no AI attribution trailer.
- Don't run `pnpm run verify` while a dev session is live. Use `pnpm run typecheck`, `pnpm run lint` and scoped vitest instead.

## Review Focus

1. **Case and separator mismatch:** disk has `data\skyrim.esm` and the manifest has `Data\Skyrim.esm`, or `/` appears. Expect the game bucket, not unknown plus missing. Test in Task 2.
2. **Stale manifest beside the right one:** `depotcache` has `1091501_3389237510439361019.manifest` but the ACF wants `..._2461377369266892508`, which is absent. Expect "unavailable" naming depot 1091501 and manifest 2461377369266892508, never a silent fallback to the old file. Test in Task 3.
3. **Deployment manifests at two roots:** `Data\vortex.deployment.json` (targetPath `<game>\Data`) and `vortex.deployment.dinput.json` (targetPath `<game>`), plus an entry with a non-empty `target` subfolder. Expect every listed file resolved to the right path under the game folder. Test in Task 3.
4. **Unreadable file while hashing:** the game is running and a file is locked. Expect the check to finish, that file to stay in the game bucket unmodified, and it to be counted in `unreadable`. Test in Task 3.
5. **No baseline in the renderer:** the game isn't from Steam, has no Steam entry for its app ID, or the entry has no `installData`. Expect a plain "can't check" reason, not an IPC call that throws. Test in Task 5.

---

### Task 0: Branch and commit the design

**Files:**

- Commit: `docs/superpowers/specs/2026-10-25-steam-game-folder-check-poc-design.md`, `docs/superpowers/plans/2026-10-25-steam-game-folder-check-poc.md`

- [ ] **Step 1: Branch from master, carrying the untracked spec and plan**

```bash
git fetch origin master
git switch -c poc/steam-folder-check origin/master
```

Expected: the two docs show as untracked on the new branch. `etc/Dependency Report.md` and `etc/vortex.api.md` are modified on the old branch; if `git switch` refuses because of them, stop and ask Simon rather than stashing or discarding.

- [ ] **Step 2: Keep the mockups out of git locally**

Append `.superpowers/` to `.git/info/exclude`. Don't change `.gitignore`.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-10-25-steam-game-folder-check-poc-design.md docs/superpowers/plans/2026-10-25-steam-game-folder-check-poc.md
git commit -m "poc: add Steam game folder check design and plan"
```

---

### Task 1: Depot manifest reader

**Files:**

- Create: `src/main/src/pocFolderCheck/depotManifest.ts`
- Test: `src/main/src/pocFolderCheck/depotManifest.test.ts`

**Interfaces:**

- Produces:
    ```ts
    export interface IDepotFile {
        name: string;
        size: number;
        flags: number;
        sha1: string;
        linkTarget: string;
    }
    export interface IDepotManifest {
        depotId: number;
        manifestId: string;
        filenamesEncrypted: boolean;
        files: IDepotFile[];
    }
    export function readDepotManifest(data: Buffer): IDepotManifest;
    export const DEPOT_FLAG = {
        userConfig: 1,
        versionedUserConfig: 2,
        directory: 64,
        symlink: 512,
    } as const;
    ```
    `name` keeps Steam's spelling. `sha1` is lowercase hex, or `""` when absent. `manifestId` is a decimal string, since it overflows a JS number. It throws `Error` with a message starting `"invalid depot manifest"` on an unknown magic or a section that runs past the buffer.

Format, from the spec: sections of `uint32le magic`, `uint32le length`, protobuf body; `0x32C415AB` (end) has no length. Payload `0x71F617D0`: repeated field 1 = file mapping (1 filename string, 2 size uint64, 3 flags uint32, 5 content SHA1 bytes, 7 link target string; ignore 4 and 6). Metadata `0x1F4812BE`: 1 depot ID, 2 manifest ID (uint64), 4 filenames encrypted (bool). Signature `0x1B81B817`: skip. Decode varints as `bigint`. Skip unknown protobuf fields for wire types 0, 1, 2 and 5.

- [ ] **Step 1: Write the failing tests**

Put a small encoder in the test file so no third-party manifest is committed:

```ts
const varint = (n: bigint) => {
    const out: number[] = [];
    do {
        let b = Number(n & 0x7fn);
        n >>= 7n;
        if (n) b |= 0x80;
        out.push(b);
    } while (n);
    return Buffer.from(out);
};
const field = (f: number, v: bigint | Buffer | string) =>
    typeof v === "bigint"
        ? Buffer.concat([varint(BigInt(f << 3)), varint(v)])
        : Buffer.concat([
              varint(BigInt((f << 3) | 2)),
              varint(BigInt(Buffer.from(v).length)),
              Buffer.from(v),
          ]);
const section = (magic: number, body: Buffer) => {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(magic, 0);
    h.writeUInt32LE(body.length, 4);
    return Buffer.concat([h, body]);
};
const end = () => {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(0x32c415ab, 0);
    return b;
};
```

Tests in `describe("readDepotManifest")`:

- `"reads files, sizes, flags and sha1"`: a payload with `SkyrimSE.exe`, size `37910440n`, flags `0n`, SHA1 bytes of hex `2f784a183f884067a9a41338664b55f6dc198a48`, plus an unknown field 6 sub-message. Expect `files` to equal `[{ name: "SkyrimSE.exe", size: 37910440, flags: 0, sha1: "2f784a183f884067a9a41338664b55f6dc198a48", linkTarget: "" }]`.
- `"reads metadata"`: metadata with depot `489833n`, manifest `4886117324142477814n`, field 4 `0n`. Expect `depotId` 489833, `manifestId` `"4886117324142477814"`, `filenamesEncrypted` false. A second case with field 4 `1n` expects true.
- `"skips the signature section"`: payload, signature with arbitrary bytes, metadata, end. Expect one file and the metadata read.
- `"keeps Windows separators and link targets"`: name `Data\\Skyrim.esm`, field 7 `"target.bin"`. Expect `name` unchanged and `linkTarget` `"target.bin"`.
- `"throws on an unknown magic"` and `"throws on a truncated section"` (length 100, body 4 bytes): `toThrow(/invalid depot manifest/)`.

- [ ] **Step 2: Run to verify they fail**

Run: `cd src/main && pnpm exec vitest run src/pocFolderCheck/depotManifest.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `readDepotManifest(data: Buffer): IDepotManifest`** in `depotManifest.ts`, with a file comment pointing at the spec.

- [ ] **Step 4: Run to verify they pass**

Same command. Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/main/src/pocFolderCheck/depotManifest.ts src/main/src/pocFolderCheck/depotManifest.test.ts
git commit -m "poc: read Steam depot manifests"
```

---

### Task 2: Shared types and bucketing

**Files:**

- Modify: `src/shared/src/types/ipc.ts` (types next to `HashAlgorithm`; channels in `InvokeChannels`)
- Create: `src/main/src/pocFolderCheck/classify.ts`
- Test: `src/main/src/pocFolderCheck/classify.test.ts`

**Interfaces:**

- Consumes: `IDepotFile`, `IDepotManifest`, `DEPOT_FLAG` from Task 1.
- Produces, in `src/shared/src/types/ipc.ts` (each with a one-line TSDoc saying "Dev-only PoC" and naming the spec):
    ```ts
    export interface FolderCheckInput {
        appId: number;
        buildId: number;
        steamPath: string;
        gamePath: string;
        depots: { depotId: number; manifestId: string }[];
    }
    export type FolderCheckBucket = "game" | "vortex" | "unknown";
    export interface FolderCheckFile {
        relPath: string;
        size: number;
        mtimeMs: number;
        bucket: FolderCheckBucket;
        modified?: true;
        changedSinceDeployed?: true;
    }
    export interface FolderCheckResult {
        checkedAt: number;
        input: FolderCheckInput;
        files: FolderCheckFile[];
        missing: { relPath: string; size: number }[];
        unreadable: string[];
        baseFilesWithBackup: number;
    }
    export type FolderCheckStatus =
        | { state: "idle" }
        | { state: "running"; phase: "listing" | "hashing"; bytesDone: number; bytesTotal: number }
        | { state: "done"; result: FolderCheckResult }
        | { state: "unavailable"; reason: string }
        | { state: "error"; message: string };
    ```
    Channels: `"poc:folder-check-start": (input: FolderCheckInput, force: boolean) => Promise<void>;` and `"poc:folder-check-status": (appId: number) => Promise<FolderCheckStatus>;`, under a `// Dev-only PoC: Steam game folder check` comment.
- Produces, in `classify.ts`:
    ```ts
    export interface IDiskFile {
        relPath: string;
        size: number;
        mtimeMs: number;
        isSymlink: boolean;
    }
    export interface IDeployedEntry {
        relPath: string;
        time: number;
    }
    export interface IClassified {
        files: FolderCheckFile[];
        missing: { relPath: string; size: number }[];
        toHash: { relPath: string; sha1: string; size: number }[];
        baseFilesWithBackup: number;
    }
    export function pathKey(relPath: string): string; // lowercase, "/" to "\"
    export function mergeDepotFiles(manifests: IDepotManifest[]): Map<string, IDepotFile>; // keyed by pathKey; later manifest wins; directories dropped
    export function classify(
        disk: IDiskFile[],
        base: Map<string, IDepotFile>,
        deployed: IDeployedEntry[],
    ): IClassified;
    ```

Rules for `classify`, in order, per disk file:

1. Vortex if its key is in `deployed`, or its file name matches `/^vortex\.deployment.*\.json$/i`, or it is `__folder_managed_by_vortex`, or it ends `.vortex_backup` (case-insensitive). Add `changedSinceDeployed: true` when it's a listed deployed file, not a symlink, and `Math.abs(mtimeMs - time) >= 1000`.
2. Game if its key is in `base`. Add `modified: true` when the sizes differ, unless the flags include UserConfig, VersionedUserConfig or Symlink, or the link target is non-empty. When sizes match and none of those apply and `sha1 !== ""`, push it to `toHash`.
3. Otherwise unknown.

`missing` is every base entry with no disk file. `baseFilesWithBackup` counts base entries for which `<key>.vortex_backup` exists on disk. `relPath` in the output keeps the disk spelling.

- [ ] **Step 1: Write the failing tests** in `describe("classify")`, each building small inputs inline:
- `"puts deployed files in vortex"`: deployed `Data\\SKSE\\Plugins\\a.bin` with matching time. Expect bucket `"vortex"` and no `changedSinceDeployed`.
- `"flags deployed files rewritten since deployment"`: same with disk `mtimeMs` 5000 ms later. Expect `changedSinceDeployed: true`. A symlink variant expects no flag.
- `"treats Vortex's own files as vortex"`: `Data\\vortex.deployment.json`, `bin\\x64\\plugins\\__folder_managed_by_vortex`, `SkyrimSE.exe.vortex_backup` all give `"vortex"`.
- `"matches base files ignoring case and separators"` (Review Focus 1): base `Data\\Skyrim.esm`, disk `data/skyrim.esm`. Expect bucket `"game"`, `missing` empty, and output `relPath` `"data/skyrim.esm"`.
- `"marks size changes as modified without hashing"`: expect `modified: true` and `toHash` empty.
- `"queues same-size base files for hashing"`: expect `toHash` to equal `[{ relPath, sha1, size }]`.
- `"never marks user config files modified"`: flags `1` with a different size gives no `modified` and empty `toHash`. Same for flags `512`.
- `"reports missing base files"`: base has `Data\\Update.esm`, disk doesn't. Expect `missing` `[{ relPath: "Data\\Update.esm", size }]`.
- `"counts base files linked over by Vortex"`: base `SkyrimSE.exe`, disk has `SkyrimSE.exe` (deployed) and `SkyrimSE.exe.vortex_backup`. Expect `baseFilesWithBackup` 1 and both files `"vortex"`.
- `"puts everything else in unknown"`.
- In `describe("mergeDepotFiles")`: `"later depot wins and directories are dropped"`.

- [ ] **Step 2: Run to verify they fail**

Run: `cd src/main && pnpm exec vitest run src/pocFolderCheck/classify.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Add the shared types, then implement `classify.ts`**

If main's typecheck can't see the new shared types, run `pnpm --filter @vortex/shared build` once.

- [ ] **Step 4: Run to verify they pass**

Same command. Expected: all pass. Then `pnpm run typecheck` from the repo root: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/src/types/ipc.ts src/main/src/pocFolderCheck/classify.ts src/main/src/pocFolderCheck/classify.test.ts
git commit -m "poc: bucket game folder files into game, Vortex and unknown"
```

---

### Task 3: Folder scan, hashing and IPC in main

**Files:**

- Create: `src/main/src/pocFolderCheck/scan.ts`
- Create: `src/main/src/pocFolderCheck/index.ts`
- Modify: `src/main/src/main.ts` (call `initPocFolderCheck()` right after `initTelemetryIpcHandler();`)
- Test: `src/main/src/pocFolderCheck/scan.test.ts`, `src/main/src/pocFolderCheck/index.test.ts`

**Interfaces:**

- Consumes: `readDepotManifest` (Task 1); `classify`, `mergeDepotFiles`, `pathKey`, `IDiskFile`, `IDeployedEntry` (Task 2); shared `FolderCheck*` types (Task 2).
- Produces, in `scan.ts`:
    ```ts
    export class FolderCheckUnavailable extends Error {}
    export function depotManifestPath(
        steamPath: string,
        depotId: number,
        manifestId: string,
    ): string; // <steamPath>\depotcache\<depotId>_<manifestId>.manifest
    export async function loadBaseFiles(input: FolderCheckInput): Promise<Map<string, IDepotFile>>; // throws FolderCheckUnavailable
    export async function walkFolder(root: string): Promise<IDiskFile[]>; // lstat; relPath relative to root
    export async function readDeployments(
        root: string,
        disk: IDiskFile[],
    ): Promise<IDeployedEntry[]>;
    export async function sha1File(filePath: string): Promise<string>;
    export async function runFolderCheck(
        input: FolderCheckInput,
        onProgress: (s: Extract<FolderCheckStatus, { state: "running" }>) => void,
        hash?: (p: string) => Promise<string>,
    ): Promise<FolderCheckResult>;
    ```
- Produces, in `index.ts`: `export function initPocFolderCheck(): void` and, for tests, `export function createFolderCheckService(run = runFolderCheck): { start(input: FolderCheckInput, force: boolean): void; status(appId: number): FolderCheckStatus }`.

Behaviour:

- `loadBaseFiles` throws `FolderCheckUnavailable` with `Steam's file list for depot <depotId> (manifest <manifestId>) isn't on disk` when the file is missing, and `Steam's file list for depot <depotId> is encrypted` when `filenamesEncrypted`. A parse error becomes `FolderCheckUnavailable` with `Steam's file list for depot <depotId> couldn't be read`.
- `readDeployments` reads each disk file named `vortex.deployment*.json`. It resolves `path.join(manifest.targetPath ?? dirname(json), entry.target ?? "", entry.relPath)` and makes it relative to `root`. Entries outside `root` are dropped.
- `runFolderCheck` reports phase `"listing"` first, then `"hashing"` with byte progress over `toHash`. It hashes up to 4 files at once. A hash mismatch sets `modified: true` on that file. A hash failure adds the path to `unreadable` and leaves the file unmodified. `checkedAt` is `Date.now()`.
- The service keeps one `FolderCheckStatus` per `appId`. `start` is a no-op while that app is running, and also when it's `done` unless `force`. `FolderCheckUnavailable` becomes `{ state: "unavailable", reason }`; any other error becomes `{ state: "error", message }`, and is logged with `log("warn", ...)`. `status` of an unknown app is `{ state: "idle" }`.
- `initPocFolderCheck` returns immediately outside development. Otherwise it registers both channels with `betterIpcMain.handle` and logs `"Steam folder check PoC enabled"`.

- [ ] **Step 1: Write the failing tests**

`scan.test.ts` builds a temp tree under `mkdtempSync(path.join(tmpdir(), "foldercheck-"))`, with a `depotcache` folder holding manifests built with the Task 1 encoder. Move that encoder into `src/main/src/pocFolderCheck/testManifest.ts` and import it from both test files. Mock `../logging` as `pocDetectedRequirements.test.ts` does on its branch: `vi.mock("../logging", () => ({ log: vi.fn() }))`.

- `"names the depot and manifest when the file list is missing"` (Review Focus 2): write `1091501_3389237510439361019.manifest` only, and ask for `2461377369266892508`. Expect `rejects.toThrow(FolderCheckUnavailable)` with the message containing `1091501` and `2461377369266892508`.
- `"resolves deployment entries against each manifest's target path"` (Review Focus 3): `Data/vortex.deployment.json` with targetPath `<root>\Data` and an entry `{ relPath: "SKSE\\a.bin", target: "", time }`; `vortex.deployment.dinput.json` with targetPath `<root>` and `{ relPath: "dinput8.dll", target: "", time }`; one entry with `target: "sub"`. Expect relPaths `Data\SKSE\a.bin`, `dinput8.dll` and `sub\...`.
- `"marks a hash mismatch as modified"`: a base file whose manifest SHA1 is wrong. Expect `modified: true`.
- `"records unreadable files and still finishes"` (Review Focus 4): pass a `hash` that rejects for one path. Expect the result to resolve, `unreadable` to equal `[thatPath]`, and that file not to be modified.
- `"reports listing then hashing progress"`: collect `onProgress` calls. Expect the first phase to be `"listing"`, the last `bytesDone === bytesTotal`.

`index.test.ts`:

- `"runs once and serves the cached result"`: `start` twice without `force` calls `run` once, and `status` ends `done`.
- `"reruns on force"`: `run` is called twice.
- `"ignores start while running"`.
- `"reports unavailable reasons"`: `run` rejects with `FolderCheckUnavailable("x")`. Expect `{ state: "unavailable", reason: "x" }`.

- [ ] **Step 2: Run to verify they fail**

Run: `cd src/main && pnpm exec vitest run src/pocFolderCheck`
Expected: the new tests FAIL; Task 1 and 2 tests still pass.

- [ ] **Step 3: Implement `scan.ts`, `index.ts` and the `main.ts` call**

`sha1File` streams with `createHash("sha1")` from `node:crypto`.

- [ ] **Step 4: Run to verify they pass**

Same command. Expected: all pass. Then `pnpm run typecheck`: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/main/src/pocFolderCheck src/main/src/main.ts
git commit -m "poc: check a Steam game folder in main and serve it over IPC"
```

---

### Task 4: Preload bridge

**Files:**

- Modify: `src/preload/src/index.ts` (add a `poc` namespace next to `updater`)
- Modify: `src/shared/src/types/preload.ts` (add `poc: PocApi` to the API interface, and `PocApi`)

**Interfaces:**

- Consumes: the two channels from Task 2.
- Produces: `window.api.poc.startFolderCheck(input: FolderCheckInput, force: boolean): Promise<void>` and `window.api.poc.getFolderCheckStatus(appId: number): Promise<FolderCheckStatus>`, typed by `export interface PocApi` with a TSDoc "Dev-only PoC: Steam game folder check, answered by main only in development".

- [ ] **Step 1: Add both, mirroring how `updater` is wired**

- [ ] **Step 2: Verify**

Run: `pnpm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/preload/src/index.ts src/shared/src/types/preload.ts
git commit -m "poc: expose the folder check to the renderer"
```

---

### Task 5: Renderer extension, check input and summary

**Files:**

- Create: `src/renderer/src/extensions/poc_folder_check/index.ts`
- Create: `src/renderer/src/extensions/poc_folder_check/utils/resolveCheckInput.ts`
- Create: `src/renderer/src/extensions/poc_folder_check/utils/summarise.ts`
- Modify: `src/renderer/src/ExtensionManager.ts` (`staticExtensions`, alphabetical: `poc_folder_check: () => require("./extensions/poc_folder_check/index.ts")`)
- Modify: `src/renderer/src/extensions/index.ts` (`import {} from "./poc_folder_check";`)
- Modify: `src/renderer/src/extensions/analytics/utils/storeGameVersionEvent.ts` (export `normPath`)
- Test: `.../utils/resolveCheckInput.test.ts`, `.../utils/summarise.test.ts`

**Interfaces:**

- Consumes: `ISteamEntry` and `ISteamInstallData` from `@/util/Steam`; `FolderCheckInput`, `FolderCheckResult` from `@vortex/shared/ipc`.
- Produces:
    ```ts
    // resolveCheckInput.ts
    export type CheckInputResult =
        | { ok: true; input: FolderCheckInput; discoveryPath: string }
        | { ok: false; reason: string };
    export function resolveCheckInput(args: {
        discoveryPath: string | undefined;
        steamAppId: number | string | undefined;
        steamEntries: ISteamEntry[];
        steamExePath: string | undefined;
    }): CheckInputResult;
    // summarise.ts
    export interface IFolderSummary {
        counts: Record<FolderCheckBucket, { files: number; bytes: number }>;
        modified: number;
        missing: number;
        changedSinceDeployed: { files: number; bytes: number };
        unknownGroups: { folder: string; files: FolderCheckFile[]; bytes: number }[]; // sorted by file count, descending
    }
    export function summarise(result: FolderCheckResult, groupDepth = 3): IFolderSummary;
    ```

`resolveCheckInput` finds the entry by `appid === String(steamAppId)`, falling back to `normPath(gamePath) === normPath(discoveryPath)`. `storeGameVersionEvent.ts` matches by path first; this puts app ID first, as the spec says. `normPath` is module-local in `src/renderer/src/extensions/analytics/utils/storeGameVersionEvent.ts:82`; export it from there instead of copying it. `steamPath` is `path.dirname(steamExePath)`. Depots come from `installData.depots` (shared depots are never included). Reasons, exact copy:

- no entry found: `"This check only works for Steam games so far."`
- entry without `installData`: `"Steam's install details for this game couldn't be read."`
- no `steamExePath`: `"Vortex couldn't find the Steam install."`

`summarise` groups unknown files by the first `groupDepth` segments of their directory (a root file is its own group, keyed by its name).

`index.ts` returns `false` in production. Otherwise it registers `context.registerMainPage("folder-check", "Game folder", FolderCheckPage, { priority: 70, group: "per-game", newLayout: true, mdi: mdiFolderSearchOutline, visible: () => activeGameId(context.api.getState()) !== undefined })`. Task 6 creates `FolderCheckPage`, so Task 5 registers a stub `views/FolderCheckPage.tsx` that renders `null`.

- [ ] **Step 1: Write the failing tests**

`resolveCheckInput.test.ts` (Review Focus 5):

- `"builds input from the Steam entry matched by app id"`: an entry with appid `"1091500"`, gamePath `D:\SteamLibrary\steamapps\common\Cyberpunk 2077`, installData depots `[{ depotId: 1091501, manifestId: "2461377369266892508", dlcAppId: null }, { depotId: 2138330, manifestId: "8416081049196797989", dlcAppId: "2138330" }]` and buildId 26133166. Expect `input.depots` to equal both `{ depotId, manifestId }` pairs, and `steamPath` to be `C:\Program Files (x86)\Steam` from `steamExePath` `C:\Program Files (x86)\Steam\steam.exe`.
- `"falls back to the discovery path"` when `steamAppId` is undefined.
- `"says so when the game isn't from Steam"`, `"…when installData is missing"` and `"…when Steam isn't found"`: expect the exact reasons above.

`summarise.test.ts`:

- `"counts buckets and flags"`: expect counts, `modified`, `missing` and `changedSinceDeployed`.
- `"groups unknown files by folder"`: files under `bin\x64\plugins\cyber_engine_tweaks\mods\A\db.sqlite3` and `...\B\db.sqlite3`, plus `r6\cache\final.redscripts.modded`. Expect the first group to be `bin\x64\plugins` with 2 files, and `r6\cache` next.

- [ ] **Step 2: Run to verify they fail**

Run: `cd src/renderer && pnpm exec vitest run src/extensions/poc_folder_check`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement both utils, the stub page, `index.ts` and the two registrations**

- [ ] **Step 4: Run to verify they pass**

Same command, then `pnpm run typecheck`. Expected: pass, no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/extensions/poc_folder_check src/renderer/src/ExtensionManager.ts src/renderer/src/extensions/index.ts src/renderer/src/extensions/analytics/utils/storeGameVersionEvent.ts
git commit -m "poc: register a dev-only Game folder page"
```

---

### Task 6: The Game folder page

**Files:**

- Modify: `src/renderer/src/extensions/poc_folder_check/views/FolderCheckPage.tsx`
- Test: `src/renderer/src/extensions/poc_folder_check/views/FolderCheckPage.test.tsx`

**Interfaces:**

- Consumes: `resolveCheckInput`, `summarise` (Task 5); `window.api.poc.*` (Task 4); `Page`, `PageHeader`, `PageScroll` from `@/views/components/Page/*`; `Button` and `Typography` from `@/ui/components/*`; `activeGameId`, `discoveryByGame`, `getGame`, and `getGameStores()` filtered to id `"steam"` (call `allGames()` and `getGameStorePath()` on it).

The page follows the spec's "The page" section and the mockup `page-v2.html`. These are the parts the implementer can't infer:

- On mount, and when the active game changes, it resolves the input. If that fails it shows the reason and nothing else. Otherwise it calls `startFolderCheck(input, false)`, then polls `getFolderCheckStatus(appId)` every 500 ms while the state is `running`. The polling stops on unmount.
- Re-check calls `startFolderCheck(input, true)` and resumes polling.
- `running` shows the phase and `bytesDone / bytesTotal` as a percentage. `unavailable` shows the reason. `error` shows the message.
- Header subtitle: `Steam · build <buildId> · depots <ids joined with ", "> · checked <relative time>`, using `useRelativeTime` from `@/util/useRelativeTime`. If the resolved `discoveryPath` differs from `input.gamePath` (compare with `normPath`), show both paths.
- Summary bar: three segments with `flex-grow` equal to the file counts. Use design tokens (`bg-success-*`, `bg-info-*`, `bg-warning-*`), not raw colours. Show the legend with counts and sizes, plus Modified, Missing and Changed since deployed.
- "To make it clean" box, exact copy with real numbers:
    1. `Move {unknown files} unknown files ({size}) out of the game folder`, followed by `, plus {n} Vortex files changed since deployed` when n > 0. A disabled `Archive (later)` button.
    2. `Remove the empty folders left behind`
    3. `Restore {modified + missing} modified or missing game files with Steam's verify`. A disabled `Verify in Steam` button. When `baseFilesWithBackup > 0`, add the line `Purge in Vortex first: Steam's verify would overwrite {n} files Vortex has deployed over game files.`
    4. If `unreadable.length > 0`: `{n} files couldn't be read and weren't compared.`
- Unknown files: one expandable row per `unknownGroups` entry (folder, file count, size), expanding to each file with its size and date. Below that, collapsed rows for Game files and Vortex files.
- Format sizes with `bytesToString` from `@/util/util`.

- [ ] **Step 1: Write the failing tests**

Mock `window.api.poc` and the store and selector modules the way `HealthCheckPage.test.tsx` does.

- `"shows the reason when the game can't be checked"`: `resolveCheckInput` returns `{ ok: false, reason: "This check only works for Steam games so far." }`. Expect that text, and `startFolderCheck` never called.
- `"starts a check and renders the summary"`: status returns `done` with a result of 2 game, 1 vortex (changed since deployed) and 3 unknown files. Expect `startFolderCheck` called with `force` false, and the texts `Move 3 unknown files` and `plus 1 Vortex files changed since deployed`.
- `"warns to purge first when Vortex has linked over game files"`: `baseFilesWithBackup: 2`. Expect `Purge in Vortex first`.
- `"Re-check forces a new run"`: click Re-check. Expect `startFolderCheck` called with `force` true.

- [ ] **Step 2: Run to verify they fail**

Run: `cd src/renderer && pnpm exec vitest run src/extensions/poc_folder_check/views`
Expected: FAIL.

- [ ] **Step 3: Implement `FolderCheckPage`**

- [ ] **Step 4: Run to verify they pass**

Same command, then `pnpm run typecheck`, `pnpm run lint` and `pnpm run format`. Expected: pass; format may reorder classes and imports.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/extensions/poc_folder_check
git commit -m "poc: show game folder buckets and cleanup steps"
```

---

### Task 7: Prove it on Skyrim SE and Cyberpunk 2077

No code changes unless this finds a bug. If it does, fix it in the owning task's files with a test first.

- [ ] **Step 1: Check no dev session is running, then run verify**

Run in PowerShell: `Get-Process electron -ErrorAction SilentlyContinue`. If there's output, ask Simon before continuing. Otherwise run `pnpm run verify` from the repo root.
Expected: passes. This doesn't cover E2E.

- [ ] **Step 2: Start dev and open the page for Cyberpunk 2077**

Run `pnpm run dev` (unset `ELECTRON_RUN_AS_NODE` first if starting from the Bash tool). Switch to Cyberpunk 2077 and open Game folder.
Expected, from the 2026-10-25 recon, if the folder hasn't changed since: game 182 files (about 81.4 GB), Vortex 65, unknown 133 (about 41 MB), modified 0, missing 0. The largest unknown group is under `bin\x64\plugins`. If the numbers differ, check whether the folder changed (for example a deploy happened) before calling it a bug.

- [ ] **Step 3: Same for Skyrim SE**

Expected: 46 game files, with nothing missing or modified unless hashing finds a difference the size check couldn't. About 1,166 Vortex-deployed files plus Vortex's own files. Unknown files include about 130 `cc*` Creations files (about 4.6 GB). No `_CommonRedist` files reported missing.

- [ ] **Step 4: Report** the numbers seen for both games to Simon, with how long hashing took. Don't commit anything from this task unless a fix was needed.
