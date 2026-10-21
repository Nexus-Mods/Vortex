import * as path from "node:path";

import {
  FileSourceKind,
  GameStore,
  GogBuildId,
  GogProductId,
  HashType,
  NexusFileUid,
  NexusGameId,
  SteamAppId,
  SteamBuildId,
  SteamDepotId,
  SteamManifestId,
  type GameInstall,
  type ResolverInput,
  type ResolverMod,
  type StagedFile,
} from "@nexusmods/mod-pipeline";
import { parseError, type VortexGameId } from "@vortex/shared";
import { QualifiedPath } from "@vortex/shared/filesystem";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IGame } from "../../../types/IGame";
import type { IState } from "../../../types/IState";
import { fileMD5 } from "../../../util/checksum";
import getNormalizeFunc from "../../../util/getNormalizeFunc";
import { numericNexusGameId } from "../../analytics/mixpanel/numericGameId";
import { scanInstall } from "../../analytics/utils/storeGameVersionEvent";
import type { IDiscoveryResult } from "../../gamemode_management/types/IDiscoveryResult";
import { getGame } from "../../gamemode_management/util/getGame";
import { getModType } from "../../gamemode_management/util/modTypeExtensions";
import { createVortexNexusV3Client } from "../../nexus_integration/nexusV3Client";
import { resolveFileUID } from "../../nexus_integration/util/UIDs";
import {
  fetchArchiveFiles,
  type ArchiveFiles,
} from "../../nexus_integration/util_v3/archiveManifests";
import { lastActiveProfileForGame, profileById } from "../../profile_management/selectors";
import { mapWithConcurrency } from "../LinkingDeployment";
import { installPathForGame } from "../selectors";
import type { IMod } from "../types/IMod";
import BlacklistSet from "./BlacklistSet";
import { genSubDirFunc } from "./deploy";
import { deployedFilePath } from "./deployedFilePath";
import { doSortMods } from "./sort";

// files hashed at once; keeps the main process's hash workers, at most 16, busy
const HASH_CONCURRENCY = 16;

const toPortablePath = (filePath: string) => filePath.replaceAll("\\", "/");

/** A mod's origin; a Nexus mod whose file version is unknown is user generated. */
function modOrigin(mod: IMod, gameMode: string): ResolverMod["origin"] {
  const fileUid =
    mod.attributes?.source === "nexus" ? resolveFileUID(mod.attributes, gameMode) : undefined;
  return fileUid !== undefined
    ? { source: FileSourceKind.Nexus, fileUid: NexusFileUid(fileUid) }
    : { source: FileSourceKind.UserGenerated };
}

/** A mod's staged files with their sizes, relative to its staging folder and "/" separated. */
async function stagedFiles(modPath: string): Promise<{ relPath: string; size: number }[]> {
  const root = QualifiedPath.fromNative(modPath);
  const rootDepth = root.components().toArray().length;
  const files: { relPath: string; size: number }[] = [];
  try {
    const entries = await window.api.fs.enumerateDirectory(root, {
      types: "files",
      recursive: true,
      includeStatus: true,
    });
    for await (const [entry, status] of entries) {
      if (status.isFile) {
        files.push({
          relPath: entry.components().drop(rootDepth).toArray().join("/"),
          size: status.size,
        });
      }
    }
  } catch (err) {
    if (parseError(err).data.kind !== "fs:not-found") {
      throw err;
    }
  }
  return files;
}

/** The game's install, identified by its store's ids. */
async function gameInstall(gameMode: string, discovery: IDiscoveryResult): Promise<GameInstall> {
  const { store } = discovery;
  if (store === GameStore.Epic || store === GameStore.Xbox) {
    return { store };
  }
  if (store !== GameStore.Steam && store !== GameStore.Gog) {
    throw new Error(`${gameMode} is installed from ${store}, which has no lockfile ids`);
  }
  const { install, failureReason } = await scanInstall(gameMode, discovery);
  if (install === null) {
    throw new Error(`${gameMode}'s ${store} install is unreadable: ${failureReason}`);
  }
  return "app_id" in install
    ? {
        store: GameStore.Steam,
        appId: SteamAppId(install.app_id),
        buildId: SteamBuildId(install.build_id),
        depots: install.depots.map((depot) => ({
          depotId: SteamDepotId(depot.depot_id),
          manifestId: SteamManifestId(depot.manifest_id),
        })),
      }
    : {
        store: GameStore.Gog,
        productId: GogProductId(install.product_id),
        buildId: GogBuildId(install.build_id),
      };
}

/** The skip list a mod type's deployment applies, keyed by mod type id. */
async function skipListsByType(
  game: IGame,
  modPaths: Record<string, string>,
): Promise<Map<string, { skipFiles: BlacklistSet; normalize: (input: string) => string }>> {
  const skipLists = new Map<
    string,
    { skipFiles: BlacklistSet; normalize: (input: string) => string }
  >();
  for (const [typeId, deployPath] of Object.entries(modPaths)) {
    if (deployPath) {
      const normalize = await getNormalizeFunc(deployPath);
      skipLists.set(typeId, { skipFiles: new BlacklistSet([], game, normalize), normalize });
    }
  }
  return skipLists;
}

interface IStagedSource {
  stagedPath: string;
  destinationPath: string;
  /** its mod's staged files */
  into: StagedFile[];
  /** the Nexus file version its mod was installed from */
  fileUid?: NexusFileUid;
  /** "/" separated, relative to its mod's staging folder */
  portableRelPath: string;
  size: number;
}

/**
 * The MD5 a staged file has in its archive: the entries at its path, or under a folder the installer
 * stripped, that match its size must agree on one.
 */
function archiveMd5(
  source: IStagedSource,
  archiveFiles: ArchiveFiles | undefined,
): string | undefined {
  const { portableRelPath, size } = source;
  const md5s = new Set(
    (archiveFiles?.get(path.posix.basename(portableRelPath)) ?? [])
      .filter(
        (archiveFile) =>
          (archiveFile.path === portableRelPath ||
            archiveFile.path.endsWith(`/${portableRelPath}`)) &&
          archiveFile.size === size,
      )
      .map(({ md5 }) => md5),
  );
  return md5s.size === 1 ? [...md5s][0] : undefined;
}

/**
 * The resolver input for a game's deploying mods. A staged Nexus file takes its hash from its
 * archive's manifest where that is unambiguous.
 */
export async function gatherResolverInput(
  api: IExtensionApi,
  gameMode: VortexGameId,
  hashFile: (filePath: string) => Promise<string> = fileMD5,
  lookupArchiveFiles: (versionIds: string[]) => Promise<ReadonlyMap<string, ArchiveFiles>> = (
    versionIds,
  ) => fetchArchiveFiles(createVortexNexusV3Client(api), versionIds),
): Promise<ResolverInput> {
  const state: IState = api.getState();
  const game = getGame(gameMode);
  const discovery = state.settings.gameMode.discovered[gameMode];
  if (game === undefined || discovery?.path === undefined) {
    throw new Error(`${gameMode} is not a discovered game`);
  }
  const gameId = numericNexusGameId(gameMode);
  if (gameId === null) {
    throw new Error(`${gameMode} has no Nexus game id`);
  }
  if (discovery.store === undefined) {
    throw new Error(`${gameMode} has no store recorded`);
  }
  const profile = profileById(state, lastActiveProfileForGame(state, gameMode));
  if (profile === undefined) {
    throw new Error(`${gameMode} has no profile`);
  }

  const sortedMods = await doSortMods(api, profile, state.persistent.mods[gameMode] ?? {});
  const modPaths = game.getModPaths(discovery.path);
  const skipLists = await skipListsByType(game, modPaths);
  const stagingPath = installPathForGame(state, gameMode);

  const modOrigins = sortedMods.map((mod) => ({ mod, origin: modOrigin(mod, gameMode) }));
  // the manifests download while the staging folders are walked
  const pendingArchiveFiles = lookupArchiveFiles([
    ...new Set(
      modOrigins.flatMap(({ origin }) =>
        origin.source === FileSourceKind.Nexus ? [origin.fileUid] : [],
      ),
    ),
  ]);

  const mods: ResolverMod[] = [];
  const sources: IStagedSource[] = [];
  for (const { mod, origin } of modOrigins) {
    const typeId = mod.type ?? "";
    const skipList = skipLists.get(typeId);
    if (skipList === undefined) {
      continue;
    }
    const resolverMod: ResolverMod = {
      origin,
      stagedFiles: [],
      overriddenPaths: (mod.fileOverrides ?? []).map(toPortablePath),
    };
    mods.push(resolverMod);
    const fileUid = origin.source === FileSourceKind.Nexus ? origin.fileUid : undefined;
    const subDir = genSubDirFunc(game, getModType(mod.type))(mod);
    const modPath = path.join(stagingPath, mod.installationPath);
    for (const { relPath, size } of await stagedFiles(modPath)) {
      if (!skipList.skipFiles.has(skipList.normalize(path.join(mod.installationPath, relPath)))) {
        sources.push({
          stagedPath: path.join(modPath, relPath),
          destinationPath: toPortablePath(deployedFilePath(modPaths[typeId], subDir, relPath)),
          into: resolverMod.stagedFiles,
          fileUid,
          portableRelPath: relPath,
          size,
        });
      }
    }
  }

  const archiveFilesByVersion = await pendingArchiveFiles;
  const fileHashes = await mapWithConcurrency(
    sources,
    (source) => {
      const archiveFiles =
        source.fileUid !== undefined ? archiveFilesByVersion.get(source.fileUid) : undefined;
      return archiveMd5(source, archiveFiles) ?? hashFile(source.stagedPath);
    },
    HASH_CONCURRENCY,
  );
  sources.forEach((source, index) => {
    source.into.push({
      destinationPath: source.destinationPath,
      fileHash: fileHashes[index],
      hashType: HashType.Md5,
    });
  });

  return {
    gameId: NexusGameId(gameId),
    install: await gameInstall(gameMode, discovery),
    mods,
  };
}
