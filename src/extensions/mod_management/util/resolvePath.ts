import { IStatePaths } from '../../../types/IState';
import { getSafe } from '../../../util/storeHelper';

import { remote } from 'electron';
import * as path from 'path';
import format = require('string-template');

export type PathKey = 'base' | 'download' | 'install';

export const pathDefaults = {
    base: path.join('{USERDATA}', '{GAME}'),
    download: path.join('{base}', 'downloads'),
    install: path.join('{base}', 'mods'),
  };

function resolvePath(key: PathKey, paths: {[gameId: string]: IStatePaths},
                     gameMode: string): string {
  if (gameMode === undefined) {
    return undefined;
  }
  const formatKeys = {
    USERDATA: remote.app.getPath('userData'),
    GAME: gameMode,
    base: undefined,
  };
  if (key !== 'base') {
    formatKeys.base = resolvePath('base', paths, gameMode);
  }
  const actualPath = getSafe(paths, [gameMode, key], pathDefaults[key]);
  return format(actualPath, formatKeys);
}

export default resolvePath;
