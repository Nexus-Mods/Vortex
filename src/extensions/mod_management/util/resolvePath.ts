import { IStatePaths } from '../types/IStateSettings';

import { remote } from 'electron';
import format = require('string-template');

export type PathKey =
  'base' | 'download' | 'install';

function resolvePath(key: PathKey, paths: IStatePaths, gameMode: string) {
  let formatKeys = {
    USERDATA: remote.app.getPath('userData'),
    GAME: gameMode,
    base: undefined,
  };
  if (key !== 'base') {
    formatKeys.base = resolvePath('base', paths, gameMode);
  }
  return format(paths[key], formatKeys);
}

export default resolvePath;
