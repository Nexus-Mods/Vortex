import type { VortexModStagingFolder } from "@vortex/shared";

import safeCreateAction from "../../../actions/safeCreateAction";
import { UserCanceled } from "../../../util/CustomErrors";
import type { FileAction, IFileEntry } from "../types/IFileEntry";

export interface IDeploymentProblem {
  activator: string;
  message: string;
  solution: string;
  order: number;
  hasAutomaticFix: boolean;
}

/**
 * sets the updating mods flag
 */
export const setUpdatingMods = safeCreateAction(
  "SET_UPDATING_MODS",
  (gameId: string, updatingMods: boolean) => ({ gameId, updatingMods }),
);

export const setDeploymentProblem = safeCreateAction(
  "SET_DEPLOYMENT_PROBLEM",
  (errors: IDeploymentProblem[]) => errors,
);

/** A file a deployment couldn't place, and the mod it belongs to. */
export interface IDeploymentFailure {
  /** name of the mod the file is staged under */
  source: string;
  /** path of the file relative to the deployment target */
  relPath: string;
  /** absolute path of the file in the game directory, for revealing it */
  outputPath: string;
}

/** Replaces the files a deployment couldn't place. */
export const setDeploymentFailures = safeCreateAction(
  "SET_DEPLOYMENT_FAILURES",
  (gameId: string, failures: IDeploymentFailure[]) => ({ gameId, failures }),
);

/** Appends to what the running deployment already recorded. */
export const addDeploymentFailures = safeCreateAction(
  "ADD_DEPLOYMENT_FAILURES",
  (gameId: string, failures: IDeploymentFailure[]) => ({ gameId, failures }),
);

/**
 * stores info about files that were changed outside the control of Vortex. The user
 * will be asked how to deal with them
 */
export const setExternalChanges = safeCreateAction("SET_EXTERNAL_CHANGES", (entries) => entries);

/** source limits the action to that mod's files */
export const setExternalChangeAction = safeCreateAction(
  "SET_EXTERNAL_CHANGE_ACTION",
  (filePaths: string[], action: FileAction, source: VortexModStagingFolder | undefined) => ({
    filePaths,
    action,
    source,
  }),
);

let curResolve;
let curReject;

export function showExternalChanges(entries: IFileEntry[]) {
  return (dispatch) =>
    new Promise<IFileEntry[]>((resolve, reject) => {
      curResolve = resolve;
      curReject = reject;
      dispatch(setExternalChanges(entries));
    });
}

export function confirmExternalChanges(changes: IFileEntry[], canceled: boolean) {
  return (dispatch) => {
    if (canceled) {
      if (curReject !== undefined) {
        curReject(new UserCanceled());
      }
    } else {
      if (curResolve !== undefined) {
        curResolve(changes);
      }
    }
    curReject = undefined;
    curResolve = undefined;
    dispatch(setExternalChanges([]));
  };
}

/** Asks the new Mods table to open and scroll to a group, by id; undefined once it has. */
export const focusModsTableGroup = safeCreateAction(
  "FOCUS_MODS_TABLE_GROUP",
  (groupId: string | undefined) => groupId,
);
