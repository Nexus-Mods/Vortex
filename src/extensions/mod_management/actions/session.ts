import safeCreateAction from '../../../actions/safeCreateAction';
import {UserCanceled} from '../../../util/CustomErrors';

import {IFileChange} from '../types/IDeploymentMethod';
import {FileAction, IFileEntry} from '../types/IFileEntry';

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
export const setUpdatingMods = safeCreateAction('SET_UPDATING_MODS',
  (gameId: string, updatingMods: boolean) => ({ gameId, updatingMods }));

export const setDeploymentProblem = safeCreateAction('SET_DEPLOYMENT_PROBLEM',
  (errors: IDeploymentProblem[]) => errors);

/**
 * stores info about files that were changed outside the control of Vortex. The user
 * will be asked how to deal with them
 */
export const setExternalChanges = safeCreateAction('SET_EXTERNAL_CHANGES', entries => entries);

export const setExternalChangeAction = safeCreateAction('SET_EXTERNAL_CHANGE_ACTION',
  (filePaths: string[], action: string) => ({ filePaths, action }));

let curResolve;
let curReject;

function defaultAction(changeType: string): FileAction {
  switch (changeType) {
    case 'refchange': return 'newest';
    case 'valchange': return 'nop';
    case 'deleted': return 'delete';
    case 'srcdeleted': return 'drop';
    default: throw new Error('invalid file change ' + changeType);
  }
}

function changeToEntry(modTypeId: string, change: IFileChange): IFileEntry {
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

export function showExternalChanges(changes: { [typeId: string]: IFileChange[] }) {
  return (dispatch) =>
    new Promise<IFileEntry[]>((resolve, reject) => {
      curResolve = resolve;
      curReject = reject;
      const entries: IFileEntry[] = [];
      Object.keys(changes).forEach(typeId => {
        changes[typeId].forEach(fileChange =>
          entries.push(changeToEntry(typeId, fileChange)));
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
