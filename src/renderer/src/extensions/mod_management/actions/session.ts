import safeCreateAction from "../../../actions/safeCreateAction";
import { UserCanceled } from "../../../util/CustomErrors";
import type { IFileChange } from "../types/IDeploymentMethod";
import type { IFileEntry } from "../types/IFileEntry";
import { changeToEntry } from "../util/externalChanges";

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

export const setExternalChangeAction = safeCreateAction(
  "SET_EXTERNAL_CHANGE_ACTION",
  (filePaths: string[], action: string) => ({ filePaths, action }),
);

let curResolve;
let curReject;

export function showExternalChanges(changes: { [typeId: string]: IFileChange[] }) {
  return (dispatch) =>
    new Promise<IFileEntry[]>((resolve, reject) => {
      curResolve = resolve;
      curReject = reject;
      const entries: IFileEntry[] = [];
      Object.keys(changes).forEach((typeId) => {
        changes[typeId].forEach((fileChange) => entries.push(changeToEntry(typeId, fileChange)));
      });
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
