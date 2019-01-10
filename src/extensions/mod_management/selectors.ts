import { IState } from '../../types/IState';
import { activeGameId } from '../../util/selectors';

import getInstallPath from './util/getInstallPath';

import { createSelector, OutputSelector } from 'reselect';
import createCachedSelector, { ICacheObject, OutputParametricSelector, ParametricSelector } from 're-reselect';

const installPathPattern = (state: IState) => state.settings.mods.installPath;
const gameInstallPathPattern = (state: IState, gameId: string) => state.settings.mods.installPath[gameId];
const allNeedToDeploy = (state: IState) => state.persistent.deployment.needToDeploy;

export const installPath = createSelector(installPathPattern, activeGameId,
    (inPaths: { [gameId: string]: string }, inGameMode: string) => {
      if (inGameMode === undefined) {
        return undefined;
      }
      return getInstallPath(inPaths[inGameMode], inGameMode);
    });

export const installPathForGame = createCachedSelector(gameInstallPathPattern, (state: IState, gameId: string) => gameId,
  (inPath: string, gameId: string) => getInstallPath(inPath, gameId))((state, gameId) => {
    if (gameId === undefined) {
      throw new Error('gameId can\'t be undefined');
    }
    return gameId;
  });

export const currentActivator =
  (state: IState): string => state.settings.mods.activator[activeGameId(state)];

export const needToDeploy = createSelector(allNeedToDeploy, activeGameId,
  (inNeedToDeploy: { [gameId: string]: boolean }, inGameMode: string) => inNeedToDeploy[inGameMode]);

export const needToDeployForGame = createCachedSelector(allNeedToDeploy, (state: IState, gameId: string) => gameId,
  (inNeedToDeploy: { [gameId: string]: boolean }, inGameId: string) => inNeedToDeploy[inGameId])((state, gameId) => gameId);
