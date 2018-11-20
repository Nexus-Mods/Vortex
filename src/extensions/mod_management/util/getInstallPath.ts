import makeCI from '../../../util/makeCaseInsensitive';

import { app as appIn, remote } from 'electron';
import * as path from 'path';
import * as format from 'string-template';

const app = remote !== undefined ? remote.app : appIn;

let userData: string;

export function getInstallPathPattern(pattern: string): string {
  return pattern || path.join('{USERDATA}', '{GAME}', 'mods');
}

function getInstallPath(pattern: string, gameId: string): string {
  if (gameId === undefined) {
    throw new Error('gameId can\'t be undefined');
  }
  if (userData === undefined) {
    // cached to avoid ipcs from renderer -> main process
    userData = app.getPath('userData');
  }
  const formatKeys = makeCI({
    userdata: userData,
    game: gameId,
  });

  let result = format(getInstallPathPattern(pattern), formatKeys);

  if (!path.isAbsolute(result)) {
    result = path.resolve(app.getAppPath(), result);
  }

  return result;
}

export default getInstallPath;
