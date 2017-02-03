import {activeGameId} from '../../util/selectors';

import resolvePath from './util/resolvePath';

import { createSelector } from 'reselect';

const paths = (state) => state.settings.mods.paths;

export const basePath =
  createSelector(paths, activeGameId, (inPaths, inGameMode) => {
    return resolvePath('base', inPaths, inGameMode);
  });

export const downloadPath =
  createSelector(paths, activeGameId, (inPaths, inGameMode) => {
    return resolvePath('download', inPaths, inGameMode);
  });

export const installPath =
  createSelector(paths, activeGameId, (inPaths, inGameMode) => {
    return resolvePath('install', inPaths, inGameMode);
  });

export const currentActivator =
  (state): string => state.settings.mods.activator[activeGameId(state)];
