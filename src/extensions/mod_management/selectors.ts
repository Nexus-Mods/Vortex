import { IState, IStatePaths } from '../../types/IState';
import { activeGameId } from '../../util/selectors';

import resolvePath from './util/resolvePath';

import { createSelector } from 'reselect';

export interface IPathMap {
  [gameId: string]: IStatePaths;
}

const paths = (state: IState) => state.settings.mods.paths;

export const basePath = createSelector(
    paths, activeGameId, (inPaths: IPathMap, inGameMode: string) =>
      resolvePath('base', inPaths, inGameMode));

export const downloadPath = createSelector(
    paths, activeGameId, (inPaths: IPathMap, inGameMode: string) =>
      resolvePath('download', inPaths, inGameMode));

export const installPath = createSelector(
    paths, activeGameId, (inPaths: IPathMap, inGameMode: string) =>
      resolvePath('install', inPaths, inGameMode));

export const currentActivator =
  (state: IState): string => state.settings.mods.activator[activeGameId(state)];
