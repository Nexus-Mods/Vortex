import { activeGameId } from '../../extensions/profile_management/selectors';
import { IDownload, IState } from '../../types/IState';
import { log } from '../../util/log';

import getDownloadPath from './util/getDownloadPath';

import createCachedSelector, { OutputParametricSelector } from 're-reselect';
import { createSelector, OutputSelector } from 'reselect';
import { DownloadState } from './types/IDownload';

const downloadPathPattern = (state: IState) => state.settings.downloads.path;

type DLPathCB = (inPath: string, inGameId: string) => string;

export const downloadPath: (state: IState) => string = createSelector(
    downloadPathPattern, activeGameId, (inPath: string, inGameId: string) =>
      getDownloadPath(inPath, inGameId));

const downloadPathForGameImpl: OutputParametricSelector<IState, string, string, DLPathCB, any> =
  createCachedSelector(
    downloadPathPattern, (state: IState, gameId: string) => gameId,
    (inPath: string, gameId: string) => getDownloadPath(inPath, gameId))((state, gameId) => gameId);

export function downloadPathForGame(state: IState, gameId?: string) {
  return downloadPathForGameImpl(state, gameId ?? activeGameId(state) ?? '__invalid');
}

const downloadFiles = (state: IState) => state.persistent.downloads.files;

const ACTIVE_STATES: DownloadState[] = ['finalizing', 'started'];

export const activeDownloads =
  createSelector(downloadFiles,
    (files: { [dlId: string]: IDownload }) => Object.keys(files).reduce((prev, id) => {
      if (ACTIVE_STATES.includes(files[id].state)) {
        prev[id] = files[id];
      }
      return prev;
    }, {}));
