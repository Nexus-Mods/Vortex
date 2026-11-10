import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import * as path from "node:path";

import {
  FileSourceKind,
  GameStore,
  HashType,
  LockfileSchema,
  resolve,
  type Lockfile,
  type FileEntry,
} from "@nexusmods/mod-pipeline";
import { VortexGameId, VortexModId } from "@vortex/shared";
import { QualifiedPath } from "@vortex/shared/filesystem";
import { expect, onTestFinished, vi } from "vitest";

import type * as StoreGameVersionEvent from "../../analytics/utils/storeGameVersionEvent";
import type * as NexusIntegrationUtil from "../../nexus_integration/util";

// util/Steam reads paths at import time and there is no ApplicationData here
vi.mock("../../../util/getVortexPath", () => ({ default: vi.fn(() => "/tmp") }));
// the Nexus game list comes from the network
vi.mock("../../nexus_integration/util", async (importOriginal) => ({
  ...(await importOriginal<typeof NexusIntegrationUtil>()),
  nexusGames: () => [{ domain_name: "skyrimspecialedition", id: 1704 }],
}));
// the harness has no Steam library to scan
vi.mock("../../analytics/utils/storeGameVersionEvent", async (importOriginal) => {
  const { makeSteamInstallRecord } = await import("../../../test-utils/builders.js");
  return {
    ...(await importOriginal<typeof StoreGameVersionEvent>()),
    scanInstall: () => Promise.resolve(makeSteamInstallRecord()),
  };
});

import {
  makeDeployedFile,
  makeProfileMod,
  makeRealDeploymentMethod,
  makeStagedMod,
  registerTestModType,
} from "../../../test-utils/builders";
import { makeDeployedGame } from "../../../test-utils/deployedGame";
import { installInMemoryFS } from "../../../test-utils/fsApi";
import { test } from "../../../test-utils/harnessTest";
import type { IDeployedGameHarness } from "../../../test-utils/harnessTypes";
import { writeInto } from "../../../test-utils/tempDir";
import { checksum } from "../../../util/checksum";
import getNormalizeFunc from "../../../util/getNormalizeFunc";
import { getGame } from "../../gamemode_management/util/getGame";
import { getModType } from "../../gamemode_management/util/modTypeExtensions";
import hardlinkInit from "../../hardlink_activator";
import type { ArchiveFiles } from "../../nexus_integration/util_v3/archiveManifests";
import deployMods from "../modActivation";
import { sessionReducer } from "../reducers/session";
import type { IDeployedFile } from "../types/IDeploymentMethod";
import type { IMod } from "../types/IMod";
import { saveActivation } from "./activationStore";
import BlacklistSet from "./BlacklistSet";
import { genSubDirFunc } from "./deploy";
import { deployedFilePath } from "./deployedFilePath";
import { gatherDeployedInput, gatherResolverInput } from "./resolverInput";
import { doSortMods } from "./sort";

const hashFile = async (filePath: string) => checksum(await readFile(filePath));
const toPortablePath = (filePath: string) => filePath.replaceAll("\\", "/");
const noArchiveFiles = () => Promise.resolve(new Map<string, ArchiveFiles>());

const MOD_A = VortexModId("ModA");
const MOD_B = VortexModId("ModB");
const MOD_C = VortexModId("ModC");
const SCRIPT_EXTENDER = VortexModId("ScriptExtender");
// a numeric download game resolves the file version without the Nexus game list
const NEXUS_ATTRIBUTES = { source: "nexus", fileId: 1001, downloadGame: "1704" };
const NEXUS_FILE_UID = ((1704n << 32n) | 1001n).toString();

async function makeResolvableGame(): Promise<IDeployedGameHarness> {
  const game = await makeDeployedGame({
    methodId: "hardlink_activator",
    extraReducers: [{ path: ["session", "mods"], reducer: sessionReducer }],
  });
  game.setState((draft) => {
    draft.settings.gameMode.discovered[game.gameId].store = "steam";
  });
  return game;
}

/** Stages and installs the mods in order, enabled unless listed. */
async function installMods(
  game: IDeployedGameHarness,
  stagedMods: { mod: IMod; relPaths: string[] }[],
  disabledModIds: VortexModId[] = [],
): Promise<void> {
  const pathsInStaging = stagedMods.flatMap(({ mod, relPaths }) =>
    relPaths.map((relPath) => path.join(mod.installationPath, relPath)),
  );
  for (const pathInStaging of pathsInStaging) {
    await writeInto(game.stagingPath, pathInStaging);
  }
  // the resolver lists and sizes staging through window.api.fs; deployment and hashing read the disk
  const { restore } = installInMemoryFS((builder) => {
    for (const pathInStaging of pathsInStaging) {
      builder.file(QualifiedPath.fromNative(path.join(game.stagingPath, pathInStaging)), {
        type: "text",
        data: pathInStaging,
      });
    }
  });
  onTestFinished(restore);
  game.setState((draft) => {
    draft.persistent.mods[game.gameId] = Object.fromEntries(
      stagedMods.map(({ mod }) => [mod.id, mod]),
    );
    draft.persistent.profiles[game.profileId].modState = Object.fromEntries(
      stagedMods.map(({ mod }) => [
        mod.id,
        makeProfileMod({ enabled: !disabledModIds.some((modId) => modId === mod.id) }),
      ]),
    );
  });
}

interface TypeDeployment {
  typeId: string;
  target: string;
  deployed: IDeployedFile[];
}

/** Deploys each mod type with the hardlink deployment, returning what each type deployed. */
async function deployEachType(game: IDeployedGameHarness): Promise<TypeDeployment[]> {
  const state = game.getState();
  const sortedMods = await doSortMods(
    game.api,
    state.persistent.profiles[game.profileId],
    state.persistent.mods[game.gameId],
  );
  const harnessGame = getGame(game.gameId);
  const modPaths = harnessGame.getModPaths(state.settings.gameMode.discovered[game.gameId].path);
  const method = makeRealDeploymentMethod(game.api, hardlinkInit);
  const deployments: TypeDeployment[] = [];
  for (const [typeId, target] of Object.entries(modPaths).filter(
    ([, deployPath]) => deployPath !== "",
  )) {
    const deployed = await deployMods(
      game.api,
      game.gameId,
      game.stagingPath,
      target,
      sortedMods.filter((mod) => (mod.type ?? "") === typeId),
      method,
      [],
      typeId,
      new BlacklistSet([], harnessGame, await getNormalizeFunc(target)),
      genSubDirFunc(harnessGame, getModType(typeId)),
    );
    deployments.push({ typeId, target, deployed });
  }
  return deployments;
}

/** Writes a mod type's manifest as a deployment by the given instance does. */
async function recordManifest(
  game: IDeployedGameHarness,
  typeId: string,
  target: string,
  deployed: IDeployedFile[],
  instanceId: string = game.getState().app.instanceId,
): Promise<void> {
  await mkdir(target, { recursive: true });
  await saveActivation(
    game.gameId,
    typeId,
    instanceId,
    target,
    game.stagingPath,
    deployed,
    "hardlink_activator",
  );
}

/** Each file the hardlink deployment writes, and its hash. */
async function deployedFiles(game: IDeployedGameHarness): Promise<FileEntry[]> {
  const files: FileEntry[] = [];
  for (const { target, deployed } of await deployEachType(game)) {
    for (const file of deployed) {
      files.push({
        destinationPath: toPortablePath(deployedFilePath(target, file.target, file.relPath)),
        fileHash: await hashFile(path.join(game.stagingPath, file.source, file.relPath)),
        hashType: HashType.Md5,
      });
    }
  }
  return files.toSorted((lhs, rhs) => (lhs.destinationPath < rhs.destinationPath ? -1 : 1));
}

async function expectResolvedAsDeployed(game: IDeployedGameHarness): Promise<Lockfile> {
  const lockfile = resolve(
    await gatherResolverInput(game.api, VortexGameId(game.gameId), hashFile, noArchiveFiles),
  );

  const deployed = await deployedFiles(game);

  expect(deployed.length).toBeGreaterThan(0);
  expect(LockfileSchema.safeParse(lockfile).success).toBe(true);
  expect(
    lockfile.files.map(({ destinationPath, fileHash, hashType }) => ({
      destinationPath,
      fileHash,
      hashType,
    })),
  ).toEqual(deployed);
  return lockfile;
}

test("the resolver deploys each file where today's deployment does, from the same mod", async () => {
  const game = await makeResolvableGame();
  await installMods(game, [
    {
      mod: makeStagedMod(MOD_A, { attributes: NEXUS_ATTRIBUTES }),
      relPaths: ["ModA.esp", path.join("textures", "sky.dds")],
    },
    {
      mod: makeStagedMod(MOD_B, {
        attributes: { source: "website" },
        rules: [{ type: "after", reference: { id: MOD_A } }],
      }),
      relPaths: [path.join("textures", "sky.dds"), path.join("meshes", "rock.nif"), "meta.ini"],
    },
    {
      mod: makeStagedMod(MOD_C, {
        fileOverrides: [path.join(game.dataPath, "meshes", "rock.nif")],
        rules: [{ type: "after", reference: { id: MOD_B } }],
      }),
      relPaths: [path.join("meshes", "rock.nif")],
    },
  ]);

  const lockfile = await expectResolvedAsDeployed(game);

  expect(lockfile.files.filter((file) => file.source !== FileSourceKind.UserGenerated)).toEqual([
    expect.objectContaining({
      nexusFileId: NEXUS_FILE_UID,
      destinationPath: toPortablePath(path.join(game.dataPath, "ModA.esp")),
    }),
  ]);
});

test("the lockfile identifies a Steam install by its app, build and depot manifests", async () => {
  const game = await makeResolvableGame();

  const input = await gatherResolverInput(
    game.api,
    VortexGameId(game.gameId),
    hashFile,
    noArchiveFiles,
  );

  expect(input.install).toEqual({
    store: GameStore.Steam,
    appId: 489830,
    buildId: 15218373,
    depots: [{ depotId: 489833, manifestId: "1914580699073641964" }],
  });
});

test("the resolver gives a file two unordered mods ship to the mod today's deployment does", async () => {
  const game = await makeResolvableGame();
  await installMods(game, [
    { mod: makeStagedMod(MOD_A), relPaths: ["shared.txt"] },
    { mod: makeStagedMod(MOD_B), relPaths: ["shared.txt"] },
  ]);

  await expectResolvedAsDeployed(game);
});

test("the resolver skips the files today's deployment skips", async () => {
  const game = await makeResolvableGame();
  await installMods(game, [
    {
      mod: makeStagedMod(MOD_A),
      relPaths: [
        "meta.ini",
        path.join("notes", ".gitignore"),
        path.join("notes", ".hidden_note"),
        path.join("notes", "visible.txt"),
      ],
    },
  ]);

  await expectResolvedAsDeployed(game);
});

test("the resolver leaves out a disabled mod, as today's deployment does", async () => {
  const game = await makeResolvableGame();
  await installMods(
    game,
    [
      { mod: makeStagedMod(MOD_A), relPaths: ["shared.txt"] },
      { mod: makeStagedMod(MOD_B), relPaths: ["shared.txt", "b_only.txt"] },
    ],
    [MOD_B],
  );

  await expectResolvedAsDeployed(game);
});

test("the resolver deploys a second mod type into its own target, as today's deployment does", async () => {
  const game = await makeResolvableGame();
  registerTestModType("dinput", path.dirname(game.dataPath));
  await installMods(game, [
    {
      mod: makeStagedMod(SCRIPT_EXTENDER, { type: "dinput" }),
      relPaths: ["loader.exe", path.join("src", "readme.txt")],
    },
    { mod: makeStagedMod(MOD_A), relPaths: ["ModA.esp"] },
  ]);

  await expectResolvedAsDeployed(game);
});

test("a Nexus file takes its hash from the archive entries of its size at its path, or under a stripped folder, when they agree", async () => {
  const game = await makeResolvableGame();
  const modA = makeStagedMod(MOD_A, { attributes: NEXUS_ATTRIBUTES });
  await installMods(game, [
    {
      mod: modA,
      relPaths: [
        "ModA.bsa",
        "ModA.esp",
        path.join("meshes", "rock.nif"),
        path.join("textures", "sky.dds"),
      ],
    },
  ]);
  const modPath = path.join(game.stagingPath, modA.installationPath);
  const sizeOf = async (relPath: string) => (await stat(path.join(modPath, relPath))).size;
  const skySize = await sizeOf(path.join("textures", "sky.dds"));
  const archiveFiles: ArchiveFiles = new Map([
    ["ModA.bsa", [{ path: "ModA.bsa", size: await sizeOf("ModA.bsa"), md5: "archive-bsa-md5" }]],
    [
      "ModA.esp",
      [{ path: "ModA Wrapper/ModA.esp", size: await sizeOf("ModA.esp"), md5: "archive-esp-md5" }],
    ],
    ["rock.nif", [{ path: "meshes/rock.nif", size: 1, md5: "archive-rock-md5" }]],
    [
      "sky.dds",
      [
        { path: "Option A/textures/sky.dds", size: skySize, md5: "archive-sky-a-md5" },
        { path: "Option B/textures/sky.dds", size: skySize, md5: "archive-sky-b-md5" },
      ],
    ],
  ]);
  const lookupArchiveFiles = vi.fn((versionIds: string[]) =>
    Promise.resolve(new Map(versionIds.map((versionId) => [versionId, archiveFiles]))),
  );
  const hashStagedFile = vi.fn(hashFile);

  const lockfile = resolve(
    await gatherResolverInput(
      game.api,
      VortexGameId(game.gameId),
      hashStagedFile,
      lookupArchiveFiles,
    ),
  );

  expect(lookupArchiveFiles).toHaveBeenCalledWith([NEXUS_FILE_UID]);
  expect(
    lockfile.files.map(({ destinationPath, fileHash }) => ({ destinationPath, fileHash })),
  ).toEqual([
    {
      destinationPath: toPortablePath(path.join(game.dataPath, "ModA.bsa")),
      fileHash: "archive-bsa-md5",
    },
    {
      destinationPath: toPortablePath(path.join(game.dataPath, "ModA.esp")),
      fileHash: "archive-esp-md5",
    },
    {
      destinationPath: toPortablePath(path.join(game.dataPath, "meshes", "rock.nif")),
      fileHash: await hashFile(path.join(modPath, "meshes", "rock.nif")),
    },
    {
      destinationPath: toPortablePath(path.join(game.dataPath, "textures", "sky.dds")),
      fileHash: await hashFile(path.join(modPath, "textures", "sky.dds")),
    },
  ]);
  expect(hashStagedFile).toHaveBeenCalledTimes(2);
});

const seededFrom = async (game: IDeployedGameHarness) =>
  gatherDeployedInput(game.api, VortexGameId(game.gameId), hashFile, noArchiveFiles);

test("an unchanged deployment seeds the lockfile the resolver gives", async () => {
  const game = await makeResolvableGame();
  registerTestModType("dinput", path.dirname(game.dataPath));
  await installMods(game, [
    {
      mod: makeStagedMod(MOD_A, { attributes: NEXUS_ATTRIBUTES }),
      relPaths: ["ModA.esp", path.join("textures", "sky.dds")],
    },
    {
      mod: makeStagedMod(MOD_B, { rules: [{ type: "after", reference: { id: MOD_A } }] }),
      relPaths: [path.join("textures", "sky.dds"), "meta.ini"],
    },
    { mod: makeStagedMod(SCRIPT_EXTENDER, { type: "dinput" }), relPaths: ["loader.exe"] },
  ]);
  for (const { typeId, target, deployed } of await deployEachType(game)) {
    await recordManifest(game, typeId, target, deployed);
  }

  const { input, notes } = await seededFrom(game);

  expect(notes).toEqual([]);
  expect(resolve(input)).toEqual(
    resolve(
      await gatherResolverInput(game.api, VortexGameId(game.gameId), hashFile, noArchiveFiles),
    ),
  );
});

/**
 * A default-type mod and a game-root mod whose manifests both list the default type's shared.txt;
 * the default type deploys after every other.
 */
async function seedSharedFile({ defaultModOverridesIt = false } = {}) {
  const game = await makeResolvableGame();
  const gameRoot = path.dirname(game.dataPath);
  registerTestModType("dinput", gameRoot);
  const sharedInGameRoot = path.join(path.basename(game.dataPath), "shared.txt");
  const fileOverrides = defaultModOverridesIt ? [path.join(game.dataPath, "shared.txt")] : [];
  await installMods(game, [
    { mod: makeStagedMod(MOD_A, { fileOverrides }), relPaths: ["shared.txt"] },
    { mod: makeStagedMod(SCRIPT_EXTENDER, { type: "dinput" }), relPaths: [sharedInGameRoot] },
  ]);
  await recordManifest(game, "dinput", gameRoot, [
    makeDeployedFile({ relPath: sharedInGameRoot, source: SCRIPT_EXTENDER }),
  ]);
  await recordManifest(game, "", game.dataPath, [
    makeDeployedFile({ relPath: "shared.txt", source: MOD_A }),
  ]);
  const { input, notes } = await seededFrom(game);
  return { game, lockfile: resolve(input), notes, sharedInGameRoot };
}

test("of two mod types whose manifests list one path, the type deployed later keeps it", async () => {
  const { game, lockfile, notes } = await seedSharedFile();

  expect(lockfile.files).toEqual([
    expect.objectContaining({
      destinationPath: toPortablePath(path.join(game.dataPath, "shared.txt")),
      fileHash: await hashFile(path.join(game.stagingPath, MOD_A, "shared.txt")),
    }),
  ]);
  expect(notes).toEqual([
    `${toPortablePath(path.join(game.dataPath, "shared.txt"))} is listed by 2 mod types' manifests; "${MOD_A}" keeps it`,
  ]);
});

test("of two mod types whose manifests list one path, the mod that does not override it keeps it", async () => {
  const { game, lockfile, sharedInGameRoot } = await seedSharedFile({
    defaultModOverridesIt: true,
  });

  expect(lockfile.files).toEqual([
    expect.objectContaining({
      destinationPath: toPortablePath(path.join(game.dataPath, "shared.txt")),
      fileHash: await hashFile(path.join(game.stagingPath, SCRIPT_EXTENDER, sharedInGameRoot)),
    }),
  ]);
});

test("a file deployed into its mod's own folder is seeded under that folder", async () => {
  const game = await makeResolvableGame();
  await installMods(game, [{ mod: makeStagedMod(MOD_A), relPaths: ["ModA.esp"] }]);
  await recordManifest(game, "", game.dataPath, [
    makeDeployedFile({ relPath: "ModA.esp", source: MOD_A, target: MOD_A }),
  ]);

  const lockfile = resolve((await seededFrom(game)).input);

  expect(lockfile.files.map(({ destinationPath }) => destinationPath)).toEqual([
    toPortablePath(path.join(game.dataPath, MOD_A, "ModA.esp")),
  ]);
});

test.each([
  [
    "another Vortex instance's manifest",
    (game: IDeployedGameHarness) =>
      recordManifest(
        game,
        "",
        game.dataPath,
        [makeDeployedFile({ relPath: "ModA.esp", source: MOD_A })],
        "other-instance",
      ),
    'the "" mod type\'s manifest was written by another Vortex instance',
  ],
  [
    "a damaged manifest",
    async (game: IDeployedGameHarness) => {
      await mkdir(game.dataPath, { recursive: true });
      await writeFile(path.join(game.dataPath, "vortex.deployment.json"), "{ not json");
    },
    'the "" mod type\'s manifest is damaged',
  ],
  [
    "an entry whose mod is not installed",
    (game: IDeployedGameHarness) =>
      recordManifest(game, "", game.dataPath, [
        makeDeployedFile({ relPath: "Gone.esp", source: "Removed" }),
      ]),
    'Gone.esp came from "Removed", which is not an installed mod',
  ],
  [
    "an entry whose file is not staged",
    (game: IDeployedGameHarness) =>
      recordManifest(game, "", game.dataPath, [
        makeDeployedFile({ relPath: "Unstaged.esp", source: MOD_A }),
      ]),
    `Unstaged.esp is not staged in "${MOD_A}"`,
  ],
])("the seed leaves out %s and notes it", async (_case, record, note) => {
  const game = await makeResolvableGame();
  await installMods(game, [{ mod: makeStagedMod(MOD_A), relPaths: ["ModA.esp"] }]);
  await record(game);

  const { input, notes } = await seededFrom(game);

  expect(resolve(input).files).toEqual([]);
  expect(notes).toEqual([note]);
});
