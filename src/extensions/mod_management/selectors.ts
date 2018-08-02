import { IState } from '../../types/IState';
import { activeGameId } from '../../util/selectors';

import getInstallPath from './util/getInstallPath';

import { createSelector } from 'reselect';
import createCachedSelector, { ICacheObject } from 're-reselect';

const installPathPattern = (state: IState) => state.settings.mods.installPath;
const gameInstallPathPattern = (state: IState, gameId: string) => state.settings.mods.installPath[gameId];

export const installPath = createSelector(installPathPattern, activeGameId,
    (inPaths: { [gameId: string]: string }, inGameMode: string) => {
      if (inGameMode === undefined) {
        return undefined;
      }
      return getInstallPath(inPaths[inGameMode], inGameMode);
    });

export const installPathForGame = createCachedSelector(gameInstallPathPattern, (state: IState, gameId: string) => gameId,
  (inPath: string, gameId: string) => getInstallPath(inPath, gameId))((state, gameId) => gameId);

export const currentActivator =
  (state: IState): string => state.settings.mods.activator[activeGameId(state)];
