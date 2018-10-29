import makeCI from '../../../util/makeCaseInsensitive';

import { app as appIn, remote } from 'electron';
import * as path from 'path';
import * as format from 'string-template';

const app = remote !== undefined ? remote.app : appIn;

let userData: string;

function getDownloadPath(pattern: string, gameId?: string): string {
  if (userData === undefined) {
    // cached to avoid ipcs from renderer -> main process
    userData = app.getPath('userData');
  }
  const formatKeys = makeCI({
    userdata: userData,
  });

  return gameId !== undefined
    ? path.join(format(pattern, formatKeys), gameId)
    : format(pattern, formatKeys);
}

export default getDownloadPath;
