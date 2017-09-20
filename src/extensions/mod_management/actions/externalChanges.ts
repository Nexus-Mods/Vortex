import safeCreateAction from '../../../actions/safeCreateAction';
import {UserCanceled} from '../../../util/CustomErrors';

import {FileAction, IFileEntry} from '../types/IFileEntry';
import {IFileChange} from '../types/IDeploymentMethod';

/**
 * stores info about files that were changed outside the control of Vortex. The user
 * will be asked how to deal with them
 */
export const setExternalChanges = safeCreateAction('SET_EXTERNAL_CHANGES');

export const setExternalChangeAction = safeCreateAction('SET_EXTERNAL_CHANGE_ACTION',
  (filePaths: string[], action: string) => ({ filePaths, action }));

let curResolve;
let curReject;

function defaultAction(changeType: string): FileAction {
  switch (changeType) {
    case 'refchange': return 'import';
    case 'valchange': return 'keep';
    case 'deleted': return 'restore';
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
      curReject(new UserCanceled());
    } else {
      curResolve(changes);
    }
    dispatch(setExternalChanges([]));
  };
}
