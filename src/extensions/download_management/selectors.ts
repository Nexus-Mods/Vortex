import { activeGameId } from '../../extensions/profile_management/selectors';
import { IState } from '../../types/IState';

import getDownloadPath from './util/getDownloadPath';

import { createSelector, OutputSelector } from 'reselect';
import createCachedSelector, { ICacheObject, OutputParametricSelector, ParametricSelector } from 're-reselect';

const downloadPathPattern = (state: IState) => state.settings.downloads.path;

export const downloadPath: OutputSelector<any, string, (inPath: string, inGameMode: string) => string> = createSelector(
    downloadPathPattern, activeGameId, (inPath: string, inGameMode: string) =>
      getDownloadPath(inPath, inGameMode));

export const downloadPathForGame: OutputParametricSelector<IState, string, string, (inPath: string, gameId: string) => string> =
  createCachedSelector(downloadPathPattern, (state: IState, gameId: string) => gameId,
    (inPath: string, gameId: string) => getDownloadPath(inPath, gameId))((state, gameId) => gameId);
