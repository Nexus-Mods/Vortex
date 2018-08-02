import { activeGameId } from '../../extensions/profile_management/selectors';
import { IState } from '../../types/IState';

import getDownloadPath from './util/getDownloadPath';

import { createSelector } from 'reselect';
import createCachedSelector, {ICacheObject} from 're-reselect';

const downloadPathPattern = (state: IState) => state.settings.downloads.path;

export const downloadPath = createSelector(
    downloadPathPattern, activeGameId, (inPath: string, inGameMode: string) =>
      getDownloadPath(inPath, inGameMode));

export const downloadPathForGame = createCachedSelector(downloadPathPattern, (state: IState, gameId: string) => gameId,
  (inPath: string, gameId: string) => getDownloadPath(inPath, gameId))((state, gameId) => gameId);
