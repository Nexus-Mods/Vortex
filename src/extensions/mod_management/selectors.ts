import { IState } from '../../types/IState';
import { activeGameId } from '../../util/selectors';

import getInstallPath from './util/getInstallPath';

import createCachedSelector from 're-reselect';
import { ICacheObject, OutputParametricSelector, ParametricSelector } from 're-reselect';
import { createSelector, OutputSelector } from 'reselect';

const installPathPattern = (state: IState) => state.settings.mods.installPath;
const gameInstallPathPattern = (state: IState, gameId: string) =>
  state.settings.mods.installPath[gameId];
const allNeedToDeploy = (state: IState) => state.persistent.deployment.needToDeploy;

export const installPath = createSelector(installPathPattern, activeGameId,
    (inPaths: { [gameId: string]: string }, inGameMode: string) => {
      if (inGameMode === undefined) {
        return undefined;
      }
      return getInstallPath(inPaths[inGameMode], inGameMode);
    });

export const installPathForGame = createCachedSelector(
    gameInstallPathPattern,
    (state: IState, gameId: string) => gameId,
    (inPath: string, gameId: string) => getInstallPath(inPath, gameId),
  )((state, gameId) => {
    if (gameId === undefined) {
      throw new Error('gameId can\'t be undefined');
    }
    return gameId;
  });

export const currentActivator =
  (state: IState): string => state.settings.mods.activator[activeGameId(state)];

interface INeedToDeployMap {
  [gameId: string]: boolean;
}

export const needToDeploy = createSelector(
    allNeedToDeploy,
    activeGameId,
    (inNeedToDeploy: INeedToDeployMap, inGameMode: string) => inNeedToDeploy[inGameMode]);

export const needToDeployForGame = createCachedSelector(
    allNeedToDeploy,
    (state: IState, gameId: string) => gameId,
    (inNeedToDeploy: INeedToDeployMap, inGameId: string) => inNeedToDeploy[inGameId])(
      (state, gameId) => gameId);
