import safeCreateAction from '../../../actions/safeCreateAction';
import {UserCanceled} from '../../../util/CustomErrors';

import {IFileChange} from '../types/IDeploymentMethod';
import {IFileEntry} from '../types/IFileEntry';
import { changeToEntry } from '../util/externalChanges';

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

// Purge summary state
export interface IPurgeSummaryData {
  gameId: string;
  activatorId: string;
  byType: { [typeId: string]: any[] };
}

export const setPurgeSummary = safeCreateAction('SET_PURGE_SUMMARY',
                                                (data: IPurgeSummaryData) => data);

export const setPurgeSummaryVisible = safeCreateAction('SET_PURGE_SUMMARY_VISIBLE',
                                                       (visible: boolean) => visible);

// No payload for clearing purge summary to match reducer expectation
export const clearPurgeSummary = safeCreateAction('CLEAR_PURGE_SUMMARY');

/**
 * stores info about files that were changed outside the control of Vortex. The user
 * will be asked how to deal with them
 */
export const setExternalChanges = safeCreateAction('SET_EXTERNAL_CHANGES', entries => entries);

export const setExternalChangeAction = safeCreateAction('SET_EXTERNAL_CHANGE_ACTION',
                                                        (filePaths: string[], action: string) => ({ filePaths, action }));

let curResolve;
let curReject;

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
