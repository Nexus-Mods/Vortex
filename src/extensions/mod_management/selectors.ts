import resolvePath from './util/resolvePath';

import { createSelector } from 'reselect';

const paths = (state) => state.gameSettings.mods.paths;
const gameMode = (state) => state.settings.gameMode.current;

export const basePath =
  createSelector(paths, gameMode, (inPaths, inGameMode) => {
    return resolvePath('base', inPaths, inGameMode);
  });

export const downloadPath =
    createSelector(paths, gameMode, (inPaths, inGameMode) => {
      return resolvePath('download', inPaths, inGameMode);
    });

export const installPath =
    createSelector(paths, gameMode, (inPaths, inGameMode) => {
      return resolvePath('install', inPaths, inGameMode);
    });
