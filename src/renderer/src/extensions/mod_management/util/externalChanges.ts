import { stat } from "node:fs/promises";
import * as path from "path";

import {
  getErrorCode,
  unknownToError,
  VortexModId,
  VortexModStagingFolder,
  type VortexProfileId,
  type VortexStagingFolder,
} from "@vortex/shared";

import { log } from "../../../logging";
import type {
  IDeployedFile,
  IDeploymentMethod,
  IExtensionApi,
  IFileChange,
} from "../../../types/IExtensionContext";
import type { IState } from "../../../types/IState";
import { ProcessCanceled } from "../../../util/CustomErrors";
import * as fs from "../../../util/fs";
import {
  activeGameId,
  activeProfile,
  getCollectionActiveSession,
  profileById,
} from "../../../util/selectors";
import { setdefault, truthy } from "../../../util/util";
import { showExternalChanges } from "../actions/session";
import { MERGED_PATH } from "../modMerging";
import { modsForGame } from "../selectors";
import type { FileAction, IFileEntry } from "../types/IFileEntry";
import { deployedFileKey, deployedFilePath } from "./deployedFilePath";

/**
 * look at the file actions and act accordingly. Depending on the action this can
 * be a direct file operation or a modification to the previous manifest so that
 * the deployment ext runs the necessary operation
 * @param {VortexStagingFolder} sourcePath the "virtual" mod directory
 * @param {string} outputPath the destination directory where the game expects mods
 * @param {IDeployedFile[]} lastDeployment previous deployment to use as reference
 * @param {IFileEntry[]} fileActions actions the user selected for external changes
 * @returns {Promise<IDeployedFile[]>} an updated deployment manifest to use as a reference
 *                                     for the new one
 */
async function applyFileActions(
  api: IExtensionApi,
  gameId: string,
  modIdByFolder: ReadonlyMap<VortexModStagingFolder, VortexModId>,
  sourcePath: VortexStagingFolder,
  outputPath: string,
  lastDeployment: IDeployedFile[],
  fileActions: IFileEntry[],
): Promise<IDeployedFile[]> {
  if (fileActions === undefined || fileActions.length === 0) {
    return lastDeployment;
  }

  const actionGroups: { [type: string]: IFileEntry[] } = fileActions.reduce(
    (prev: { [type: string]: IFileEntry[] }, value) => {
      const action =
        value.action === "newest"
          ? value.sourceModified > value.destModified
            ? "drop"
            : "import"
          : value.action;

      setdefault(prev, action, []).push(value);
      return prev;
    },
    {},
  );

  const deployedPath = (entry: IFileEntry) =>
    deployedFilePath(outputPath, entry.target, entry.filePath);

  // not doing anything with 'nop'. The regular deployment code is responsible for doing the right
  // thing in this case.

  // process the actions that the user selected in the dialog
  await Promise.all(
    (actionGroups["drop"] || []).map((entry) =>
      truthy(entry.filePath)
        ? fs.removeAsync(deployedPath(entry))
        : Promise.reject(new Error("invalid file path")),
    ),
  );

  await Promise.all(
    (actionGroups["delete"] || []).map((entry) =>
      truthy(entry.filePath)
        ? fs.removeAsync(path.join(sourcePath, entry.source, entry.filePath))
        : Promise.reject(new Error("invalid file path")),
    ),
  );

  await Promise.all(
    (actionGroups["import"] || []).map((entry) => {
      const source = path.join(sourcePath, entry.source, entry.filePath);
      const deployed = deployedPath(entry);
      // Very rarely we have a case where the files are links of each other
      // (or at least node reports that) so the copy would fail.
      // Instead of handling the errors (when we can't be sure if it's due to a bug in node.js
      // or the files are actually identical), delete the target first, that way the move
      // can't fail
      return fs
        .removeAsync(source)
        .then(() => fs.moveAsync(deployed, source, { overwrite: true }))
        .catch((err: unknown) => {
          if (getErrorCode(err) === "ENOENT") {
            log("warn", "file disappeared", unknownToError(err).message);
          } else {
            throw err;
          }
        });
    }),
  );

  // remove files that the user wants to restore from
  // the activation list because then they get reinstalled.
  // this includes files that were deleted and those replaced
  const dropSet = new Set(
    [
      ...(actionGroups["restore"] || []),
      ...(actionGroups["drop"] || []),
      // also remove the files that got deleted, except these won't be reinstalled
      ...(actionGroups["delete"] || []),
      // also remove the files that got imported because they too only exist in staging
      // at this point
      ...(actionGroups["import"] || []),
    ].map((entry) => deployedFileKey(VortexModStagingFolder(entry.source), entry.filePath)),
  );
  const newDeployment = lastDeployment.filter(
    (entry) => !dropSet.has(deployedFileKey(VortexModStagingFolder(entry.source), entry.relPath)),
  );
  lastDeployment = newDeployment;

  const affectedMods = new Set<VortexModId>();
  const testFileOverrides: Record<VortexModId, string[]> = {};
  fileActions.forEach((action) => {
    const modId =
      action.source !== "" ? modIdByFolder.get(VortexModStagingFolder(action.source)) : undefined;
    if (modId === undefined) {
      return;
    }

    if (["import", "newest", "nop", "delete", "drop"].indexOf(action.action) !== -1) {
      affectedMods.add(modId);
    }

    if (action.type === "srcdeleted" && action.action === "drop") {
      // A file has been deleted from the staging folder - we need to check whether
      //  the user had set a file override for it.
      (testFileOverrides[modId] ??= []).push(action.filePath);
    }
  });

  if (Object.keys(testFileOverrides).length > 0) {
    api.events.emit("check-file-override-redundancies", gameId, testFileOverrides);
  }

  affectedMods.forEach((affected) => {
    api.events.emit("mod-content-changed", gameId, affected);
  });

  return lastDeployment;
}

function defaultAction(
  change: IFileChange,
  existingFolders: ReadonlySet<VortexModStagingFolder>,
): FileAction {
  switch (change.changeType) {
    case "refchange":
      return "newest";
    case "valchange":
      return "nop";
    case "deleted":
      return "restore";
    case "srcdeleted":
      // the deployed file is the last copy; keep it while its mod's folder exists
      return change.source !== "" && existingFolders.has(VortexModStagingFolder(change.source))
        ? "import"
        : "drop";
    default: {
      const exhausted: never = change.changeType;
      throw new Error(`invalid file change ${exhausted as string}`);
    }
  }
}

export type ExternalChangeBucket = "merged" | "autoResolved" | "rest";

/**
 * Decide which bucket an external file change belongs to. Pure function so the
 * decision is testable in isolation (see externalChanges.test.ts).
 *
 *   - merged:       file originates from the __merged folder; always resolved
 *                   silently via defaultInternalAction.
 *   - autoResolved: change is expected because Vortex just touched the source
 *                   mod (collection install, or installationPath in
 *                   recentChanges); resolved silently.
 *   - rest:         surfaced to the user via the external-changes dialog.
 */
export function classifyExternalChange(
  change: IFileChange,
  context: { isInstallingCollection: boolean; recentChanges?: Set<string> },
): ExternalChangeBucket {
  if (path.basename(change.source).startsWith(MERGED_PATH)) {
    return "merged";
  }
  if (context.isInstallingCollection || context.recentChanges?.has(change.source)) {
    return "autoResolved";
  }
  return "rest";
}

function fileEntry(modTypeId: string, change: IFileChange, action: FileAction): IFileEntry {
  return {
    modTypeId,
    filePath: change.filePath,
    source: change.source,
    target: change.target,
    type: change.changeType,
    action,
    sourceModified: change.sourceTime,
    destModified: change.destTime,
  };
}

/** The files of one change type, per mod. */
export function changesBySource(
  changes: IFileEntry[],
  changeType: IFileEntry["type"],
): Array<{ source: VortexModStagingFolder; filePaths: string[] }> {
  const bySource = new Map<VortexModStagingFolder, string[]>();
  for (const entry of changes.filter((change) => change.type === changeType)) {
    const source = VortexModStagingFolder(entry.source);
    bySource.set(source, [...(bySource.get(source) ?? []), entry.filePath]);
  }
  return [...bySource].map(([source, filePaths]) => ({ source, filePaths }));
}

/** The dialog's entry for a change; `existingFolders` are the mod folders still in staging. */
export function changeToEntry(
  modTypeId: string,
  change: IFileChange,
  existingFolders: ReadonlySet<VortexModStagingFolder>,
): IFileEntry {
  return fileEntry(modTypeId, change, defaultAction(change, existingFolders));
}

function defaultInternalAction(typeId: string, input: IFileChange): IFileEntry {
  // Internal changes are from mod updates/reinstalls/merges; always drop the old
  // deployed file so deployment recreates it from the updated staging files.
  const action: FileAction = {
    refchange: "drop",
    valchange: "nop",
    deleted: "restore",
    srcdeleted: "drop",
  }[input.changeType] as FileAction;

  return fileEntry(typeId, input, action);
}

async function checkForExternalChanges(
  api: IExtensionApi,
  activator: IDeploymentMethod,
  profileId: VortexProfileId,
  stagingPath: VortexStagingFolder,
  modPaths: { [typeId: string]: string },
  lastDeployment: { [typeId: string]: IDeployedFile[] },
): Promise<{ [typeId: string]: IFileChange[] }> {
  // for each mod type, check if the local files were changed outside vortex
  const changes: { [typeId: string]: IFileChange[] } = {};
  log("debug", "determine external changes");
  // update mod state again because if the user did have to confirm,
  // it's more intuitive if we deploy the state at the time he confirmed, not when
  // the deployment was triggered
  const state = api.store.getState() as IState;

  const profile = profileById(state, profileId) ?? activeProfile(state);
  if (profile === undefined) {
    throw new ProcessCanceled("Profile no longer exists.");
  }
  for (const typeId of Object.keys(modPaths)) {
    log("debug", "checking external changes", {
      modType: typeId,
      count: lastDeployment[typeId]?.length ?? 0,
    });
    const fileChanges = await activator.externalChanges(
      profile.gameId,
      stagingPath,
      modPaths[typeId],
      lastDeployment[typeId],
    );
    if (fileChanges.length > 0) {
      changes[typeId] = fileChanges;
    }
  }
  return changes;
}

/** The mod folders of deleted staging files that still exist. */
async function existingSourceFolders(
  stagingPath: VortexStagingFolder,
  changes: { [typeId: string]: IFileChange[] },
): Promise<Set<VortexModStagingFolder>> {
  const folders = new Set(
    Object.values(changes)
      .flat()
      .filter((change) => change.changeType === "srcdeleted" && change.source !== "")
      .map((change) => VortexModStagingFolder(change.source)),
  );
  const existing = await Promise.all(
    [...folders].map((folder) =>
      stat(path.join(stagingPath, folder)).then(
        (stats) => (stats.isDirectory() ? [folder] : []),
        () => [],
      ),
    ),
  );
  return new Set(existing.flat());
}

export function dealWithExternalChanges(
  api: IExtensionApi,
  activator: IDeploymentMethod,
  profileId: VortexProfileId,
  stagingPath: VortexStagingFolder,
  modPaths: { [typeId: string]: string },
  lastDeployment: { [typeId: string]: IDeployedFile[] },
  // Installation paths whose mods Vortex itself just installed or removed.
  // change.source is set from mod.installationPath (see LinkingDeployment),
  // so we match against installation paths, not mod IDs; these can differ in
  // the update-via-replace flow.
  recentChanges?: Set<string>,
) {
  return checkForExternalChanges(api, activator, profileId, stagingPath, modPaths, lastDeployment)
    .then((changes: { [typeId: string]: IFileChange[] }) => {
      const automaticActions: IFileEntry[] = [];
      const userChanges: { [typeId: string]: IFileChange[] } = {};
      let count = 0;
      const state = api.store.getState() as IState;
      const isInstallingCollection = getCollectionActiveSession(state) !== undefined;
      const context = { isInstallingCollection, recentChanges };

      for (const typeId of Object.keys(changes)) {
        for (const change of changes[typeId]) {
          if (classifyExternalChange(change, context) === "rest") {
            (userChanges[typeId] ??= []).push(change);
            count++;
          } else {
            automaticActions.push(defaultInternalAction(typeId, change));
          }
        }
      }

      if (count > 0) {
        log("info", "found external changes", {
          automated: automaticActions.length,
          user: count,
        });
        // Diagnostic: dump the surfaced changes plus the recentChanges set
        // so update-via-replace false positives can be diagnosed from logs.
        log("debug", "external changes diagnostic", {
          isInstallingCollection,
          recentChanges: Array.from(recentChanges ?? []),
          surfaced: Object.entries(userChanges).flatMap(([typeId, list]) =>
            list.map((change) => ({
              typeId,
              filePath: change.filePath,
              source: change.source,
              changeType: change.changeType,
            })),
          ),
        });
        return existingSourceFolders(stagingPath, userChanges)
          .then((existingFolders) => {
            const entries = Object.entries(userChanges).flatMap(([typeId, list]) =>
              list.map((change) => changeToEntry(typeId, change, existingFolders)),
            );
            return api.store.dispatch(showExternalChanges(entries));
          })
          .then((userActions) => [].concat(automaticActions, userActions));
      } else {
        return automaticActions;
      }
    })
    .then(async (fileActions: IFileEntry[]) => {
      if (fileActions.length === 0) {
        return Object.values(lastDeployment);
      }
      const state = api.getState();
      const gameId = profileById(state, profileId)?.gameId ?? activeGameId(state);
      const modIdByFolder = new Map(
        Object.values(modsForGame(state, gameId))
          .filter((mod) => mod.installationPath !== undefined && mod.installationPath !== "")
          .map(
            (mod) => [VortexModStagingFolder(mod.installationPath), VortexModId(mod.id)] as const,
          ),
      );
      const results: IDeployedFile[][] = [];
      for (const typeId of Object.keys(lastDeployment)) {
        const newLastDeployment = await applyFileActions(
          api,
          gameId,
          modIdByFolder,
          stagingPath,
          modPaths[typeId],
          lastDeployment[typeId],
          fileActions.filter((action) => action.modTypeId === typeId),
        );
        lastDeployment[typeId] = newLastDeployment;
        results.push(newLastDeployment);
      }
      return results;
    });
}
