import { IStatePaths } from '../types/IStateSettings';

import { remote } from 'electron';
import * as path from 'path';
import format = require('string-template');

export type PathKey =
  'base' | 'download' | 'install';

const defaults = {
    base: path.join('{USERDATA}', '{GAME}'),
    download: path.join('{base}', 'downloads'),
    install: path.join('{base}', 'mods'),
  };

function resolvePath(key: PathKey, paths: { [gameId: string]: IStatePaths }, gameMode: string) {
  let formatKeys = {
    USERDATA: remote.app.getPath('userData'),
    GAME: gameMode,
    base: undefined,
  };
  if (key !== 'base') {
    formatKeys.base = resolvePath('base', paths, gameMode);
  }
  const gamePaths = paths[gameMode] || defaults;
  return format(gamePaths[key], formatKeys);
}

export default resolvePath;
