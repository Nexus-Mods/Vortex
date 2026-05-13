import * as path from "path";

import { getErrorCode, unknownToError } from "@vortex/shared";

import type {
  IDeployedFile,
  IDeploymentMethod,
  IExtensionApi,
  IFileChange,
} from "../../../types/IExtensionContext";
import { ProcessCanceled } from "../../../util/CustomErrors";
import * as fs from "../../../util/fs";
import { log } from "../../../util/log";
import {
  activeGameId,
  activeProfile,
  getCollectionActiveSession,
  profileById,
} from "../../../util/selectors";
import { getSafe } from "../../../util/storeHelper";
import { setdefault, truthy } from "../../../util/util";
import { showExternalChanges } from "../actions/session";
import { MERGED_PATH } from "../modMerging";
import type { FileAction, IFileEntry } from "../types/IFileEntry";

/**
 * look at the file actions and act accordingly. Depending on the action this can
 * be a direct file operation or a modification to the previous manifest so that
 * the deployment ext runs the necessary operation
 * @param {string} sourcePath the "virtual" mod directory
 * @param {string} outputPath the destination directory where the game expects mods
 * @param {IDeployedFile[]} lastDeployment previous deployment to use as reference
 * @param {IFileEntry[]} fileActions actions the user selected for external changes
 * @returns {Promise<IDeployedFile[]>} an updated deployment manifest to use as a reference
 *                                     for the new one
 */
async function applyFileActions(
  api: IExtensionApi,
  profileId: string,
  sourcePath: string,
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

  // not doing anything with 'nop'. The regular deployment code is responsible for doing the right
  // thing in this case.

  // process the actions that the user selected in the dialog
  await Promise.all(
    (actionGroups["drop"] || []).map((entry) =>
      truthy(entry.filePath)
        ? fs.removeAsync(path.join(outputPath, entry.filePath))
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
      const deployed = path.join(outputPath, entry.filePath);
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
    [].concat(
      (actionGroups["restore"] || []).map((entry) => entry.filePath),
      (actionGroups["drop"] || []).map((entry) => entry.filePath),
      // also remove the files that got deleted, except these won't be reinstalled
      (actionGroups["delete"] || []).map((entry) => entry.filePath),
      // also remove the files that got imported because they too only exist in staging
      // at this point
      (actionGroups["import"] || []).map((entry) => entry.filePath),
    ),
  );
  const newDeployment = lastDeployment.filter((entry) => !dropSet.has(entry.relPath));
  lastDeployment = newDeployment;

  const affectedMods = new Set<string>();
  const testFileOverrides: { [modId: string]: string[] } = {};
  fileActions.forEach((action) => {
    if (["import", "newest", "nop", "delete", "drop"].indexOf(action.action) !== -1) {
      affectedMods.add(action.source);
    }

    if (action.type === "srcdeleted" && action.action === "drop") {
      // A file has been deleted from the staging folder - we need to check whether
      //  the user had set a file override for it.
      const current = testFileOverrides[action.source] || [];
      testFileOverrides[action.source] = current.concat(action.filePath);
    }
  });

  const state = api.store.getState();
  let gameId: string;

  if (profileId !== undefined) {
    const profile = profileById(state, profileId);
    if (profile !== undefined) {
      gameId = profile.id;
    }
  }

  if (gameId === undefined) {
    gameId = activeGameId(state);
  }

  if (Object.keys(testFileOverrides).length > 0) {
    api.events.emit("check-file-override-redundancies", gameId, testFileOverrides);
  }

  affectedMods.forEach((affected) => {
    api.events.emit("mod-content-changed", gameId, affected);
  });

  return lastDeployment;
}

function defaultAction(changeType: string): FileAction {
  switch (changeType) {
    case "refchange":
      return "newest";
    case "valchange":
      return "nop";
    case "deleted":
      return "delete";
    case "srcdeleted":
      return "drop";
    default:
      throw new Error("invalid file change " + changeType);
  }
}

export function changeToEntry(modTypeId: string, change: IFileChange): IFileEntry {
  return {
    modTypeId,
    filePath: change.filePath,
    source: change.source,
    type: change.changeType,
    action: defaultAction(change.changeType),
    sourceModified: change.sourceTime,
    destModified: change.destTime,
  };
}

function defaultInternalAction(typeId: string, input: IFileChange): IFileEntry {
  // Internal changes are from mod updates/reinstalls/merges — always drop the old
  // deployed file so deployment recreates it from the updated staging files.
  const action: FileAction = {
    refchange: "drop",
    valchange: "nop",
    deleted: "restore",
    srcdeleted: "drop",
  }[input.changeType] as FileAction;

  return {
    ...changeToEntry(typeId, input),
    action,
  };
}

async function checkForExternalChanges(
  api: IExtensionApi,
  activator: IDeploymentMethod,
  profileId: string,
  stagingPath: string,
  modPaths: { [typeId: string]: string },
  lastDeployment: { [typeId: string]: IDeployedFile[] },
): Promise<{ [typeId: string]: IFileChange[] }> {
  // for each mod type, check if the local files were changed outside vortex
  const changes: { [typeId: string]: IFileChange[] } = {};
  log("debug", "determine external changes");
  // update mod state again because if the user did have to confirm,
  // it's more intuitive if we deploy the state at the time he confirmed, not when
  // the deployment was triggered
  const state = api.store.getState();

  const profile =
    profileId !== undefined
      ? getSafe(state, ["persistent", "profiles", profileId], undefined)
      : activeProfile(state);
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

export function dealWithExternalChanges(
  api: IExtensionApi,
  activator: IDeploymentMethod,
  profileId: string,
  stagingPath: string,
  modPaths: { [typeId: string]: string },
  lastDeployment: { [typeId: string]: IDeployedFile[] },
  // Installation paths whose mods Vortex itself just installed or removed.
  // change.source is set from mod.installationPath (see LinkingDeployment),
  // so we match against installation paths, not mod IDs — these can differ in
  // the update-via-replace flow.
  recentChanges?: Set<string>,
) {
  return checkForExternalChanges(api, activator, profileId, stagingPath, modPaths, lastDeployment)
    .then((changes: { [typeId: string]: IFileChange[] }) => {
      const automaticActions: IFileEntry[] = [];
      const isInstallingCollection = getCollectionActiveSession(api.store.getState()) !== undefined;
      const userChanges = Object.keys(changes).reduce((prev, typeId) => {
        const { merged, rest, autoResolved } = changes[typeId].reduce(
          (prevInner, change) => {
            const isMerged = path.basename(change.source).startsWith(MERGED_PATH);
            if (isMerged) {
              prevInner.merged.push(change);
              return prevInner;
            }
            if (isInstallingCollection || recentChanges?.has(change.source)) {
              prevInner.autoResolved.push(change);
              return prevInner;
            }

            prevInner.rest.push(change);

            return prevInner;
          },
          { merged: [], rest: [], autoResolved: [] },
        );

        if (merged.length > 0) {
          merged.forEach((change) => automaticActions.push(defaultInternalAction(typeId, change)));
        }

        if (autoResolved.length > 0) {
          autoResolved.forEach((change) =>
            automaticActions.push(defaultInternalAction(typeId, change)),
          );
        }

        if (rest.length > 0) {
          prev[typeId] = rest;
        }
        return prev;
      }, {});

      const count: number = Object.values(userChanges).reduce(
        (prev: number, list: any[]) => prev + list.length,
        0,
      ) as number;
      if (count > 0) {
        log("info", "found external changes", {
          automated: automaticActions.length,
          user: count,
        });
        return api.store
          .dispatch(showExternalChanges(userChanges))
          .then((userActions) => [].concat(automaticActions, userActions));
      } else {
        return automaticActions;
      }
    })
    .then(async (fileActions: IFileEntry[]) => {
      const results: IDeployedFile[][] = [];
      for (const typeId of Object.keys(lastDeployment)) {
        const newLastDeployment = await applyFileActions(
          api,
          profileId,
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
