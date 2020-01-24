import makeCI from '../../../util/makeCaseInsensitive';
import { getSafe } from '../../../util/storeHelper';

import { app as appIn, remote } from 'electron';
import * as path from 'path';
import format from 'string-template';

const app = remote !== undefined ? remote.app : appIn;

export type PathKey = 'base' | 'download' | 'install';

export const pathDefaults = {
    base: path.join('{USERDATA}', '{GAME}'),
    download: path.join('{base}', 'downloads'),
    install: path.join('{base}', 'mods'),
  };

let userData;

function resolvePath(key: PathKey, paths: {[gameId: string]: any},
                     gameMode: string): string {
  if (gameMode === undefined) {
    return undefined;
  }

  if (userData === undefined) {
    // if called in the renderer process, app.getPath requires an ipc.
    // since this function may be called a lot and userData does't change after
    // startup, caching it makes sense.
    // (userData _may_ change during startup though so caching during inital loading of this
    //  module would be unsafe!)
    userData = app.getPath('userData');
  }

  const formatKeys = makeCI({
    userdata: userData,
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
