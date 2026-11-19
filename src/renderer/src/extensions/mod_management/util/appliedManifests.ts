import * as path from "node:path";

import { OperationKind, pathKeyOf } from "@nexusmods/mod-pipeline";
import { VortexModTypeId, type VortexGameId } from "@vortex/shared";
import { QualifiedPath, type FileSystem, type StatusTime } from "@vortex/shared/filesystem";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IState } from "../../../types/IState";
import { getGame } from "../../gamemode_management/util/getGame";
import { mapWithConcurrency } from "../LinkingDeployment";
import { installPathForGame, modPathsForGame } from "../selectors";
import type { IDeployedFile } from "../types/IDeploymentMethod";
import { ownDeployedFiles, saveActivation } from "./activationStore";
import { destinationOf } from "./apply/apply";
import type { JournalEntry } from "./apply/journal";
import { deployedFilePath } from "./deployedFilePath";
import {
  deployFolderOf,
  installedModsByFolder,
  manifestFilesOf,
  toPortablePath,
  type ManifestEntry,
  type ManifestFiles,
} from "./resolverInput";

// staged files whose time is read at once
const STAT_CONCURRENCY = 16;

/** An operation of a run, with where its file is staged. */
export type DeployedOperation = Pick<JournalEntry, "operation" | "stagedPath">;

/** The modified time a manifest entry stores: whole seconds, in milliseconds. */
const manifestTimeOf = ({ modifiedTime }: StatusTime) =>
  Math.floor(modifiedTime.epochMilliseconds / 1000) * 1000;

/** The folder each of a game's mod types deploys to, and its staging folder. */
function deploymentFoldersOf(state: IState, gameMode: VortexGameId) {
  const modPaths = modPathsForGame(state, gameMode);
  if (modPaths === undefined) {
    throw new Error(`${gameMode} is not a discovered game`);
  }
  const deployPaths = Object.entries(modPaths).flatMap(([typeId, deployPath]) =>
    deployPath ? [[VortexModTypeId(typeId), deployPath] as const] : [],
  );
  return { deployPaths, stagingPath: installPathForGame(state, gameMode) };
}

/** A game's manifests as they are, by mod type. */
export async function readManifestFiles(
  api: IExtensionApi,
  gameMode: VortexGameId,
): Promise<ManifestFiles> {
  const { deployPaths, stagingPath } = deploymentFoldersOf(api.getState(), gameMode);
  const manifestFiles = new Map<VortexModTypeId, IDeployedFile[]>();
  for (const [typeId, deployPath] of deployPaths) {
    manifestFiles.set(typeId, await ownDeployedFiles(api, typeId, deployPath, stagingPath));
  }
  return manifestFiles;
}

/**
 * `before` without the entries at a destination an operation names or in `cleared`, plus an entry
 * per LINK, as today's deployment writes it.
 */
export async function manifestFilesAfter(
  api: IExtensionApi,
  gameMode: VortexGameId,
  fs: FileSystem,
  before: ManifestFiles,
  operations: readonly DeployedOperation[],
  cleared: readonly string[],
): Promise<ManifestFiles> {
  const changedKeys = new Set(
    [...operations.map(({ operation }) => destinationOf(operation)), ...cleared].map(pathKeyOf),
  );
  if (changedKeys.size === 0) {
    return before;
  }
  const state: IState = api.getState();
  const { deployPaths, stagingPath } = deploymentFoldersOf(state, gameMode);
  const kept = deployPaths.flatMap(([typeId, deployPath]) =>
    (before.get(typeId) ?? [])
      .filter(
        ({ target, relPath }) =>
          !changedKeys.has(
            pathKeyOf(toPortablePath(deployedFilePath(deployPath, target, relPath))),
          ),
      )
      .map((file): ManifestEntry => ({ typeId, file })),
  );

  const game = getGame(gameMode);
  const modByFolder = installedModsByFolder(state, gameMode);
  const staging = QualifiedPath.fromNative(stagingPath);
  const linkedPaths = operations.flatMap(({ operation, stagedPath }) =>
    operation.kind === OperationKind.Link && stagedPath !== undefined ? [stagedPath] : [],
  );
  const linked = await mapWithConcurrency(
    linkedPaths,
    async (stagedPath): Promise<ManifestEntry> => {
      const stagedFile = QualifiedPath.fromNative(stagedPath);
      const [modFolder, ...relSegments] = stagedFile.relativeTo(staging).split("/");
      const mod = modByFolder.get(modFolder);
      const status = await fs.stat(stagedFile);
      if (mod === undefined || !status.exists) {
        throw new Error(`${stagedPath} is not a staged file of an installed mod`);
      }
      const { typeId, subDir } = deployFolderOf(game, mod);
      return {
        typeId,
        file: {
          relPath: relSegments.join(path.sep),
          source: mod.installationPath,
          target: subDir,
          time: manifestTimeOf(status),
        },
      };
    },
    STAT_CONCURRENCY,
  );
  return manifestFilesOf([...kept, ...linked]);
}

/**
 * Saves a game's manifests for what a run's operations deployed, from the manifests there before
 * it; a mod type left without entries has its manifest removed.
 */
export async function saveAppliedManifests(
  api: IExtensionApi,
  gameMode: VortexGameId,
  fs: FileSystem,
  operations: readonly DeployedOperation[],
  cleared: readonly string[],
  activatorId: string,
): Promise<void> {
  const state: IState = api.getState();
  const { deployPaths, stagingPath } = deploymentFoldersOf(state, gameMode);
  const manifestFiles = await manifestFilesAfter(
    api,
    gameMode,
    fs,
    await readManifestFiles(api, gameMode),
    operations,
    cleared,
  );
  for (const [typeId, deployPath] of deployPaths) {
    await saveActivation(
      gameMode,
      typeId,
      state.app.instanceId,
      deployPath,
      stagingPath,
      manifestFiles.get(typeId) ?? [],
      activatorId,
    );
  }
}
