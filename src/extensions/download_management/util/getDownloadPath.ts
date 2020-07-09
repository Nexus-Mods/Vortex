import makeCI from '../../../util/makeCaseInsensitive';

import { app as appIn, remote } from 'electron';
import * as path from 'path';
import format from 'string-template';

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

  // on windows a path of the form \foo\bar will be identified as absolute
  // because why would anything make sense on windows?
  if (!path.isAbsolute(result)
      || ((process.platform === 'win32')
          && ((result[0] === '\\') && (result[1] !== '\\'))
              || (result[0] === '/') && (result[1] !== '/'))) {
    result = path.resolve(app.getPath('userData'), result);
  }

  return result;
}

export default getDownloadPath;
