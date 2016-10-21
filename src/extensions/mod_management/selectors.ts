import resolvePath from './util/resolvePath';

// import { remote } from 'electron';
// import { createSelector } from 'reselect';

export const basePath = (state) => {
  return resolvePath('base', state.gameSettings.mods.paths, state.settings.gameMode.current);
};

export const downloadPath = (state) => {
  return resolvePath('download', state.gameSettings.mods.paths, state.settings.gameMode.current);
};

export const installPath = (state) => {
  return resolvePath('install', state.gameSettings.mods.paths, state.settings.gameMode.current);
};
