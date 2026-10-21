import { stat } from "node:fs/promises";
import * as path from "node:path";

import {
  FileSourceKind,
  type ResolverInput,
  type ResolverMod,
  type StagedFile,
} from "@nexusmods/mod-pipeline";
import { getErrorCode, type VortexGameId } from "@vortex/shared";
import turbowalk from "turbowalk";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IGame } from "../../../types/IGame";
import type { IState } from "../../../types/IState";
import { fileMD5 } from "../../../util/checksum";
import getNormalizeFunc from "../../../util/getNormalizeFunc";
import { numericNexusGameId } from "../../analytics/mixpanel/numericGameId";
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

const HASH_CONCURRENCY = 16;

const toPortablePath = (filePath: string) => filePath.replaceAll("\\", "/");

/** A mod's origin; a Nexus mod without a file id is user generated. */
function modOrigin(mod: IMod): ResolverMod["origin"] {
  const fileId = mod.attributes?.fileId;
  return mod.attributes?.source === "nexus" && fileId !== undefined
    ? { source: FileSourceKind.Nexus, fileId: String(fileId) }
    : { source: FileSourceKind.UserGenerated };
}

/** The Nexus file version a mod was installed from. */
function nexusVersionId(mod: IMod, gameMode: string): string | undefined {
  return modOrigin(mod).source === FileSourceKind.Nexus
    ? resolveFileUID(mod.attributes, gameMode)
    : undefined;
}

/** A mod's staged files, relative to its staging folder. */
async function stagedRelPaths(modPath: string): Promise<string[]> {
  const relPaths: string[] = [];
  try {
    await turbowalk(
      modPath,
      (entries) => {
        for (const entry of entries) {
          if (!entry.isDirectory) {
            relPaths.push(path.relative(modPath, entry.filePath));
          }
        }
      },
      { skipHidden: false },
    );
  } catch (err) {
    if (!["ENOENT", "ENOTFOUND"].includes(getErrorCode(err))) {
      throw err;
    }
  }
  return relPaths;
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
  versionId?: string;
  /** "/" separated, relative to its mod's staging folder */
  portableRelPath: string;
}

/**
 * The MD5 a staged file has in its archive: the entries at its path, or under a folder the installer
 * stripped, that match its size must agree on one.
 */
async function archiveMd5(
  source: IStagedSource,
  archiveFiles: ArchiveFiles | undefined,
): Promise<string | undefined> {
  const { portableRelPath } = source;
  const candidates = (archiveFiles?.get(path.posix.basename(portableRelPath)) ?? []).filter(
    (archiveFile) =>
      archiveFile.path === portableRelPath || archiveFile.path.endsWith(`/${portableRelPath}`),
  );
  if (candidates.length === 0) {
    return undefined;
  }
  const { size } = await stat(source.stagedPath);
  const md5s = new Set(
    candidates.filter((archiveFile) => archiveFile.size === size).map(({ md5 }) => md5),
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

  // the manifests download while the staging folders are walked
  const pendingArchiveFiles = lookupArchiveFiles([
    ...new Set(
      sortedMods
        .map((mod) => nexusVersionId(mod, gameMode))
        .filter((versionId) => versionId !== undefined),
    ),
  ]);

  const mods: ResolverMod[] = [];
  const sources: IStagedSource[] = [];
  for (const mod of sortedMods) {
    const typeId = mod.type ?? "";
    const skipList = skipLists.get(typeId);
    if (skipList === undefined) {
      continue;
    }
    const resolverMod: ResolverMod = {
      origin: modOrigin(mod),
      stagedFiles: [],
      overriddenPaths: (mod.fileOverrides ?? []).map(toPortablePath),
    };
    mods.push(resolverMod);
    const versionId = nexusVersionId(mod, gameMode);
    const subDir = genSubDirFunc(game, getModType(mod.type))(mod);
    const modPath = path.join(stagingPath, mod.installationPath);
    for (const relPath of await stagedRelPaths(modPath)) {
      if (!skipList.skipFiles.has(skipList.normalize(path.join(mod.installationPath, relPath)))) {
        sources.push({
          stagedPath: path.join(modPath, relPath),
          destinationPath: toPortablePath(deployedFilePath(modPaths[typeId], subDir, relPath)),
          into: resolverMod.stagedFiles,
          versionId,
          portableRelPath: toPortablePath(relPath),
        });
      }
    }
  }

  const archiveFilesByVersion = await pendingArchiveFiles;
  const fileHashes = await mapWithConcurrency(
    sources,
    async (source) => {
      const archiveFiles =
        source.versionId !== undefined ? archiveFilesByVersion.get(source.versionId) : undefined;
      return (await archiveMd5(source, archiveFiles)) ?? hashFile(source.stagedPath);
    },
    HASH_CONCURRENCY,
  );
  sources.forEach((source, index) => {
    source.into.push({ destinationPath: source.destinationPath, fileHash: fileHashes[index] });
  });

  return {
    gameId,
    gameVersion: await game.getInstalledVersion(discovery),
    storeId: discovery.store,
    mods,
  };
}
