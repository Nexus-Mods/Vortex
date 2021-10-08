import getVortexPath from '../../../util/getVortexPath';
import makeCI from '../../../util/makeCaseInsensitive';
import { getSafe } from '../../../util/storeHelper';

import * as path from 'path';
import format from 'string-template';

export type PathKey = 'base' | 'download' | 'install';

export const pathDefaults = {
    base: path.join('{USERDATA}', '{GAME}'),
    download: path.join('{base}', 'downloads'),
    install: path.join('{base}', 'mods'),
  };

function resolvePath(key: PathKey, paths: {[gameId: string]: any},
                     gameMode: string): string {
  if (gameMode === undefined) {
    return undefined;
  }

  const formatKeys = makeCI({
    userdata: getVortexPath('userData'),
    game: gameMode,
    base: undefined,
  });
  if (key !== 'base') {
    formatKeys.base = resolvePath('base', paths, gameMode);
  }
  const actualPath = getSafe(paths, [gameMode, key], pathDefaults[key]);
  return format(actualPath, formatKeys);
}

export default resolvePath;
