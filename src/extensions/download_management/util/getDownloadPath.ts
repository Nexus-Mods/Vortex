import makeCI from '../../../util/makeCaseInsensitive';

import { app as appIn, remote } from 'electron';
import * as path from 'path';
import * as format from 'string-template';

const app = remote !== undefined ? remote.app : appIn;

let userData: string;

export function getDownloadPathPattern(pattern: string): string {
  return pattern || path.join('{USERDATA}', 'downloads');
}


function getDownloadPath(pattern: string, gameId?: string): string {
  if (userData === undefined) {
    // cached to avoid ipcs from renderer -> main process
    userData = app.getPath('userData');
  }
  const formatKeys = makeCI({
    userdata: userData,
  });

  let result = gameId !== undefined
    ? path.join(format(getDownloadPathPattern(pattern), formatKeys), gameId)
    : format(getDownloadPathPattern(pattern), formatKeys);

  if (!path.isAbsolute(result)) {
    result = path.resolve(app.getAppPath(), result);
  }

  return result;
}

export default getDownloadPath;
