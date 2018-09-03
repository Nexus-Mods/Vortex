import { log } from '../util/log';

import * as fs from './fs';

import * as Promise from 'bluebird';
import * as path from 'path';
import { getSafe } from './storeHelper';

export type Normalize = (input: string) => string;

function genNormalizeSeparator(func: (input: string) => string): (input: string) => string {
  const sepRE = /\//g;
  return (input: string) => func(input).replace(sepRE, path.sep);
}

function genNormalizeUnicode(func: (input: string) => string): (input: string) => string {
  return (input: string) => func(input).normalize();
}

function genNormalizeRelative(func: (input: string) => string): (input: string) => string {
  return (input: string) => path.normalize(func(input)).replace(/[\\/]$/, '');
}

function genNormalizeCase(): (input: string) => string {
  return (input: string) => input.toUpperCase();
}

export interface INormalizeParameters {
  // normalize path separators (only on windows, transforms forward slashes to backslashes)
  separators?: boolean;
  // normalize unicode symbols that can have multiple equivalent representations
  unicode?: boolean;
  // reduce "..", remove ".", remove redundant slashes
  relative?: boolean;
}

function isCaseSensitiveFailed(testPath: string, reason: string): Promise<boolean> {
  const parentPath = path.dirname(testPath);
  if (parentPath === testPath) {
    log('warn', 'failed to determine case sensitivity', {testPath, reason});
    // on windows, assume case insensitive, everywhere else: case sensitive
    return Promise.resolve(process.platform !== 'win32');
  } else {
    return isCaseSensitive(parentPath);
  }
}

function isCaseSensitive(testPath: string): Promise<boolean> {
  return fs.readdirAsync(testPath)
    .then(files => {
      // we need a filename that contains letters with case variants, otherwise we can't
      // determine case sensitivity
      const fileName: string = files.find(file =>
        file !== file.toLowerCase() || file !== file.toUpperCase());

      if (fileName === undefined) {
        return null;
      }

      // to find out if case sensitive, stat the file itself and the upper and lower case variants.
      // if they are all the same file, it's case insensitive
      return Promise.map([fileName, fileName.toLowerCase(), fileName.toUpperCase()],
        file => fs.statAsync(path.join(testPath, file)).reflect());
    })
    .then((stats: Array<Promise.Inspection<fs.Stats>>) => {
      if (stats === null) {
        return isCaseSensitiveFailed(testPath, 'Not found');
      }

      if (stats[1].isFulfilled()
          && stats[2].isFulfilled()
          && (stats[0].value().ino === stats[1].value().ino)
          && (stats[0].value().ino === stats[2].value().ino)) {
        return false;
      } else {
        return true;
      }
    })
    .catch(err => {
      return isCaseSensitiveFailed(testPath, err.message);
    });
}

/**
 * determine a function to normalize file names for the
 * file system in the specified path.
 * The second parameter can be used to specify how strict the normalization is.
 * Ideally you want everything but that makes the function slower and this function may
 * be called a lot. Oftentimes the source of the input path already guarantees some
 * normalization anyway.
 *
 * @param {string} path
 * @returns {Promise<Normalize>}
 */
function getNormalizeFunc(testPath: string, parameters?: INormalizeParameters): Promise<Normalize> {
  return isCaseSensitive(testPath)
    .then(caseSensitive => {
      let funcOut = caseSensitive
        ? (input: string) => input
        : genNormalizeCase();

      if (getSafe(parameters, ['separators'], true) && (process.platform === 'win32')) {
        funcOut = genNormalizeSeparator(funcOut);
      }
      if (getSafe(parameters, ['unicode'], true)) {
        funcOut = genNormalizeUnicode(funcOut);
      }
      if (getSafe(parameters, ['relative'], true)) {
        funcOut = genNormalizeRelative(funcOut);
      }
      return funcOut;
    })
    .catch(err => {
      if (err.code === 'ENOENT') {
        const parent = path.dirname(testPath);
        return (parent === testPath)
          ? Promise.reject(err)
          : getNormalizeFunc(parent);
      } else {
        return Promise.reject(err);
      }
    });
}

export default getNormalizeFunc;
