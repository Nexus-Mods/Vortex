import { log } from '../util/log';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

export type Normalize = (input: string) => string;

function CaseSensitiveNormalize(input: string) {
  if (path.sep !== '/') {
    return path.normalize(input).replace('/', path.sep).normalize().replace(/\\$/, '');
  } else {
    return path.normalize(input).normalize().replace(/\/$/, '');
  }
}

function CaseInsensitiveNormalize(input: string) {
  return CaseSensitiveNormalize(input).toUpperCase().normalize();
}

/**
 * determine the function to normalize file names for the
 * file system in the specified path
 *
 * @param {string} path
 * @returns {Promise<Normalize>}
 */
function getNormalizeFunc(testPath: string): Promise<Normalize> {
  return fs.readdirAsync(testPath)
    .then((files: string[]) => {
      // we need a filename that contains letters with case variants, otherwise we can't
      // determine case sensitivity
      const fileName: string = files.find((file: string) => {
        return file !== file.toLowerCase() || file !== file.toUpperCase();
      });

      if (fileName === undefined) {
        return null;
      }

      return Promise.map([fileName, fileName.toLowerCase(), fileName.toUpperCase()], file =>
        fs.statAsync(path.join(testPath, file)).reflect());
    })
    .then((stats: Array<Promise.Inspection<fs.Stats>>) => {
      if (stats === null) {
        const parent = path.dirname(testPath);
        if (parent === testPath) {
          log('warn', 'failed to determine case sensitivity', {testPath});
          return process.platform === 'win32'
            ? CaseInsensitiveNormalize
            : CaseSensitiveNormalize;
        } else {
          return getNormalizeFunc(parent);
        }
      }

      // we stated the original file name, the lower case variant and the upper case variant.
      // if they all returned the same file, this should be a case insensitive drive
      if ((stats[1].isFulfilled()) && (stats[2].isFulfilled()) &&
          (stats[0].value().ino === stats[1].value().ino) &&
          (stats[0].value().ino === stats[2].value().ino)) {
        log('debug', 'file system case-insensitive', { testPath });
        return CaseInsensitiveNormalize;
      } else {
        log('debug', 'file system case-sensitive', { testPath });
        return CaseSensitiveNormalize;
      }
    })
    .catch(err => {
      if (err.code === 'ENOENT') {
        return getNormalizeFunc(path.dirname(testPath));
      } else {
        return Promise.reject(err);
      }
    });
}

export default getNormalizeFunc;
