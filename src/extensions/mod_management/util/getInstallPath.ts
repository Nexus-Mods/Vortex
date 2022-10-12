import getVortexPath from '../../../util/getVortexPath';
import makeCI from '../../../util/makeCaseInsensitive';

import * as os from 'os';
import * as path from 'path';
import format from 'string-template';

export function getInstallPathPattern(pattern: string): string {
  return pattern || path.join('{USERDATA}', '{GAME}', 'mods');
}

export function resolveInstallPath(input: string, gameId: string) {
  const formatKeys = makeCI({
    userdata: getVortexPath('userData'),
    username: os.userInfo().username,
    game: gameId,
  });

  return format(input, formatKeys);
}

function getInstallPath(pattern: string, gameId: string): string {
  if (gameId === undefined) {
    throw new Error('gameId can\'t be undefined');
  }
  let result = resolveInstallPath(getInstallPathPattern(pattern), gameId);

  // on windows a path of the form \foo\bar or /foo/bar will be identified as absolute
  // even though it's not, it just isn't. It is relative to the drive of the current working
  // directory - which makes no fing sense since windows is supposed to have separate cwds
  // per drive and ... uuuuugh windows...
  if (!path.isAbsolute(result)
      || ((process.platform === 'win32')
          && ((result[0] === '\\') && (result[1] !== '\\'))
              || (result[0] === '/') && (result[1] !== '/'))) {
    result = path.resolve(getVortexPath('userData'), result);
  }

  return result;
}

export default getInstallPath;
