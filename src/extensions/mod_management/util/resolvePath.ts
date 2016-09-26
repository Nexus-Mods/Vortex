import { remote } from 'electron';
import format = require('string-template');

export type PathKey =
  'base' | 'download' | 'install';

function resolvePath(key: PathKey, state: any) {
  const { paths } = state.gameSettings.mods;
  const { gameMode } = state.settings.base;
  let formatKeys = {
    USERDATA: remote.app.getPath('userData'),
    GAME: gameMode,
    base: undefined,
  };
  if (key !== 'base') {
    formatKeys.base = resolvePath('base', state);
  }
  return format(paths[key], formatKeys);
}

export default resolvePath;
