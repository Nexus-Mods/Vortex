import makeCI from '../../../util/makeCaseInsensitive';

import * as os from 'os';
import * as path from 'path';
import format from 'string-template';
import getVortexPath from '../../../util/getVortexPath';

let userData: string;

export function getDownloadPathPattern(pattern: string): string {
  return pattern || path.join('{USERDATA}', 'downloads');
}

function getDownloadPath(pattern: string, gameId?: string): string {
  if (userData === undefined) {
    userData = getVortexPath('userData');
  }
  const formatKeys = makeCI({
    userdata: userData,
    username: os.userInfo().username,
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
    result = path.resolve(getVortexPath('userData'), result);
  }

  return result;
}

export default getDownloadPath;
