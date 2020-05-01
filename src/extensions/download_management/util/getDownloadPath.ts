import makeCI from '../../../util/makeCaseInsensitive';
import { getVortexPath } from '../../../util/api';

import * as path from 'path';
import format from 'string-template';


export function getDownloadPathPattern(pattern: string): string {
  return pattern || path.join('{USERDATA}', 'downloads');
}

function getDownloadPath(pattern: string, gameId?: string): string {
  const formatKeys = makeCI({
    userdata: getVortexPath('userData'),
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
    result = path.resolve(getVortexPath('base'), result);
  }

  return result;
}

export default getDownloadPath;
