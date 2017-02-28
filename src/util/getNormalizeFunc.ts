import { log } from '../util/log';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

export type Normalize = (input: string) => string;

// TODO: these aren't correct as we should apply unicode normalization
//   in either case and the normalization algorithm may differ between
//   file systems. 

function CaseSensitiveNormalize(input: string) {
  if (path.sep === '\\') {
    return path.normalize(input).replace('/', path.sep);
  } else {
    return path.normalize(input);
  }
}

function CaseInsensitiveNormalize(input: string) {
  return CaseSensitiveNormalize(input).toUpperCase();
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
      let fileName: string = files.find((file: string) => {
        return file !== file.toLowerCase() || file !== file.toUpperCase();
      });

      if (fileName === undefined) {
        log('warn', 'failed to determine case sensitivity', { testPath });
        return null;
      }

      return Promise.all([fileName, fileName.toLowerCase(), fileName.toUpperCase()].map((file) => {
        return fs.statAsync(path.join(testPath, file));
      }));
    })
    .then((stats: fs.Stats[]) => {
      if (stats === null) {
        // fallback
        return  process.platform === 'win32'
          ? CaseInsensitiveNormalize
          : CaseSensitiveNormalize;
      }
      // we stated the original file name, the lower case variant and the upper case variant.
      // if they all returned the same file, this should be a case insensitive drive
      if ((stats[1] !== undefined) && (stats[2] !== undefined) &&
        (stats[0].ino === stats[1].ino) && (stats[0].ino === stats[2].ino)) {
        log('debug', 'file system case-insensitive', { testPath });
        return CaseInsensitiveNormalize;
      } else {
        log('debug', 'file system case-sensitive', { testPath });
        return CaseSensitiveNormalize;
      }
    });
}

export default getNormalizeFunc;
