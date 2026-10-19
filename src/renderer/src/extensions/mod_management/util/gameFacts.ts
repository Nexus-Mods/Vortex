import * as path from "node:path";

import type { GameFacts, StagedFile } from "@nexusmods/mod-pipeline";
import { getErrorCode } from "@vortex/shared";
import turbowalk from "turbowalk";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IGame } from "../../../types/IGame";
import type { IState } from "../../../types/IState";
import { fileMD5 } from "../../../util/checksum";
import getNormalizeFunc from "../../../util/getNormalizeFunc";
import { numericNexusGameId } from "../../analytics/mixpanel/numericGameId";
import { getGame } from "../../gamemode_management/util/getGame";
import { getModType } from "../../gamemode_management/util/modTypeExtensions";
import { lastActiveProfileForGame, profileById } from "../../profile_management/selectors";
import { mapWithConcurrency } from "../LinkingDeployment";
import { installPathForGame } from "../selectors";
import BlacklistSet from "./BlacklistSet";
import { genSubDirFunc } from "./deploy";
import { deployedFilePath } from "./deployedFilePath";
import { doSortMods } from "./sort";

const HASH_CONCURRENCY = 16;

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
  modId: string;
  stagedPath: string;
  destinationPath: string;
}

/** What resolve() needs about a game beyond its state. */
export async function gatherGameFacts(
  api: IExtensionApi,
  gameMode: string,
  hashFile: (filePath: string) => Promise<string> = fileMD5,
): Promise<GameFacts> {
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

  const sources: IStagedSource[] = [];
  for (const mod of sortedMods) {
    const typeId = mod.type ?? "";
    const skipList = skipLists.get(typeId);
    if (skipList === undefined) {
      continue;
    }
    const subDir = genSubDirFunc(game, getModType(mod.type))(mod);
    const modPath = path.join(stagingPath, mod.installationPath);
    for (const relPath of await stagedRelPaths(modPath)) {
      if (!skipList.skipFiles.has(skipList.normalize(path.join(mod.installationPath, relPath)))) {
        sources.push({
          modId: mod.id,
          stagedPath: path.join(modPath, relPath),
          destinationPath: deployedFilePath(modPaths[typeId], subDir, relPath).replaceAll(
            "\\",
            "/",
          ),
        });
      }
    }
  }

  const fileHashes = await mapWithConcurrency(
    sources,
    (source) => hashFile(source.stagedPath),
    HASH_CONCURRENCY,
  );
  const stagedFiles: Record<string, StagedFile[]> = {};
  sources.forEach((source, index) => {
    (stagedFiles[source.modId] ??= []).push({
      destinationPath: source.destinationPath,
      fileHash: fileHashes[index],
    });
  });

  return {
    gameMode,
    gameId: String(gameId),
    gameVersion: await game.getInstalledVersion(discovery),
    storeId: discovery.store,
    sortedModIds: sortedMods.map((mod) => mod.id),
    stagedFiles,
  };
}
