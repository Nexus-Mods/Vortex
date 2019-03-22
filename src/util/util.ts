import { showDialog } from '../actions/notifications';
import { IDialogResult } from '../types/IDialog';
import { ThunkStore } from '../types/IExtensionContext';
import { UserCanceled } from './CustomErrors';
import delayed from './delayed';
import { Normalize } from './getNormalizeFunc';
import getVortexPath from './getVortexPath';
import { log } from './log';

import * as Promise from 'bluebird';
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs-extra-promise';
import * as _ from 'lodash';
import * as path from 'path';
import { file } from 'tmp';

/**
 * count the elements in an array for which the predicate matches
 *
 * @export
 * @template T
 * @param {T[]} container
 * @param {(value: T) => boolean} predicate
 * @returns {number}
 */
export function countIf<T>(container: T[], predicate: (value: T) => boolean): number {
  return container.reduce((count: number, value: T): number => {
    return count + (predicate(value) ? 1 : 0);
  }, 0);
}

/**
 * calculate the sum of the elements of an array
 *
 * @export
 * @param {number[]} container
 * @returns {number}
 */
export function sum(container: number[]): number {
  return container.reduce((total: number, value: number): number =>
    total + value, 0);
}

/**
 * like the python setdefault function:
 * returns the attribute "key" from "obj". If that attribute doesn't exist
 * on obj, it will be set to the default value and that is returned.
 */
export function setdefault<T>(obj: any, key: PropertyKey, def: T): T {
  if (!obj.hasOwnProperty(key)) {
    obj[key] = def;
  }
  return obj[key];
}

function checksum(input: string | Buffer): string {
  return createHash('md5')
    .update(input.toString(), 'utf8')
    .digest('hex');
}

export function fileMD5(filePath: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('readable', () => {
      const data = stream.read();
      if (data) {
        hash.update(data);
      }
    });
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

export function writeFileAtomic(filePath: string, input: string | Buffer,
                                options?: fs.WriteFileOptions) {
  const stackErr = new Error();
  let cleanup: () => void;
  let tmpPath: string;
  const hash = checksum(input);
  return new Promise<number>((resolve, reject) => {
    file({ template: `${filePath}.XXXXXX.tmp` },
         (err: any, genPath: string, fd: number, cleanupCB: () => void) => {
      if (err) {
        return reject(err);
      }
      cleanup = cleanupCB;
      tmpPath = genPath;
      resolve(fd);
    });
  })
  .then(fd => {
    const buf: Buffer = input instanceof Buffer
      ? input
      : Buffer.from(input);
    return fs.writeAsync(fd, buf, 0, buf.byteLength, 0)
      .then(() => fs.closeAsync(fd));
  })
  .tapCatch(() => {
    if (cleanup !== undefined) {
      cleanup();
    }
  })
  .then(() => fs.readFileAsync(tmpPath))
  .then(data => (checksum(data) !== hash)
      ? Promise.reject(new Error('Write failed, checksums differ'))
      : Promise.resolve())
  .then(() => fs.renameAsync(tmpPath, filePath))
  .catch(err => {
    err.stack = err.message + '\n' + stackErr.stack;
    return Promise.reject(err);
  });
}

/**
 * copy a file in such a way that it will not replace the target if the copy is
 * somehow interrupted. The file is first copied to a temporary file in the same
 * directory as the destination, then deletes the destination and renames the temp
 * to destination. Since the rename is atomic and the deletion only happens after
 * a successful write this should minimize the risk of error.
 *
 * @export
 * @param {string} srcPath
 * @param {string} destPath
 * @returns {Promise<void>}
 */
export function copyFileAtomic(srcPath: string,
                               destPath: string): Promise<void> {
  let cleanup: () => void;
  let tmpPath: string;
  return new Promise((resolve, reject) => {
           file({template: `${destPath}.XXXXXX.tmp`},
                (err: any, genPath: string, fd: number,
                 cleanupCB: () => void) => {
                  if (err) {
                    return reject(err);
                  }
                  cleanup = cleanupCB;
                  tmpPath = genPath;
                  resolve(fd);
                });
         })
      .then((fd: number) => fs.closeAsync(fd))
      .then(() => fs.copyAsync(srcPath, tmpPath))
      .then(() => fs.unlinkAsync(destPath).catch((err) => {
        if (err.code === 'EPERM') {
          // if the file is currently in use, try a second time
          // 100ms later
          log('debug', 'file locked, retrying delete', destPath);
          return delayed(100).then(() => fs.unlinkAsync(destPath));
        } else if (err.code === 'ENOENT') {
          // file doesn't exist anyway? no problem
          return Promise.resolve();
        } else {
          return Promise.reject(err);
        }
      }))
      .catch(err => err.code === 'ENOENT' ? Promise.resolve() : Promise.reject(err))
      .then(() => (tmpPath !== undefined)
          ? fs.renameAsync(tmpPath, destPath)
          : Promise.resolve())
      .catch(err => {
        log('info', 'failed to copy', {srcPath, destPath, err: err.stack});
        if (cleanup !== undefined) {
          cleanup();
        }
        return Promise.reject(err);
      });
}

export function removePersistent(store: ThunkStore<any>, destPath: string): Promise<void> {
  return fs.removeAsync(destPath)
    .catch(err => {
      if (err.code === 'ENOENT') {
        // the file I wanted gone was already gone??? Well, I can live with that...
        return Promise.resolve();
      } else if (err.code === 'EBUSY') {
        return store.dispatch(showDialog('error', 'Busy', {
          message: 'File is locked by another application: {{ fileName }}\n'
                   + 'please unlock it and retry.',
          parameters: { fileName: destPath },
        }, [
          { label: 'Cancel' },
          { label: 'Retry', default: true },
        ]))
        .then((result: IDialogResult) => {
          if (result.action === 'Retry') {
            return removePersistent(store, destPath);
          } else {
            return Promise.reject(new UserCanceled());
          }
        });
      }
    });
}

/**
 * An ellipsis ("this text is too lo...") function. Usually these
 * functions clip the text at the end but often (i.e. when
 * clipping file paths) the end of the text is the most interesting part,
 * so this function clips the middle part of the input.
 * @param input the input text
 * @param maxLength the maximum number of characters (including ...)
 * @return the shortened text
 */
export function midClip(input: string, maxLength: number): string {
  if (input.length <= maxLength) {
    return input;
  }

  const half = maxLength / 2;
  return input.substr(0, half - 2)
    + '...'
    + input.substr(input.length - (half - 1));
}

/**
 * test if a string is null, undefined or consists only of whitespaces
 * @param {string} check the string to check
 */
export function isNullOrWhitespace(check: string): boolean {
    return (!check || (check.trim().length === 0));
}

/**
 * return whether the specified value is "truthy" (not one of
 * these: undefined, null, 0, -0, NaN "")
 *
 * Obviously one could just do "if (val)" but js noobs
 * may not be aware what values that accepts exactly and whether that was
 * intentional. This is more explicit.
 */
export function truthy(val: any): boolean {
  return !!val;
}

/**
 * return the delta between two objects
 * @param lhs the left, "before", object
 * @param rhs the right, "after", object
 */
export function objDiff(lhs: any, rhs: any, skip?: string[]): any {
  const res = {};

  if ((typeof(lhs) === 'object') && (typeof(rhs) === 'object')) {
    Object.keys(lhs || {}).forEach(key => {
      if ((skip !== undefined) && (skip.indexOf(key) !== -1)) {
        return;
      }
      if ((rhs[key] === undefined) && (lhs[key] !== undefined)) {
        res['-' + key] = lhs[key];
      } else {
        const sub = objDiff(lhs[key], rhs[key]);
        if (sub === null) {
          res['-' + key] = lhs[key];
          res['+' + key] = rhs[key];
        } else if (Object.keys(sub).length !== 0) {
          res[key] = sub;
        }
      }
    });
    Object.keys(rhs || {}).forEach(key => {
      if ((lhs[key] === undefined) && (rhs[key] !== undefined)) {
        res['+' + key] = rhs[key];
      }
    });
  } else if (lhs !== rhs) {
    return null;
  }

  return res;
}

/**
 * spawn this application itself
 * @param args
 */
export function spawnSelf(args: string[]) {
  if (process.execPath.endsWith('electron.exe')) {
    // development version
    args = [getVortexPath('package')].concat(args);
  }
  spawn(process.execPath, args, {
    detached: true,
  });
}

const labels = [ 'B', 'KB', 'MB', 'GB', 'TB' ];

export function bytesToString(bytes: number): string {
  let labelIdx = 0;
  while (bytes >= 1024) {
    ++labelIdx;
    bytes /= 1024;
  }
  try {
    return bytes.toFixed(Math.max(0, labelIdx - 1)) + ' ' + labels[labelIdx];
  } catch (err) {
    return '???';
  }
}

export function pad(value: number, padding: string, width: number) {
  const temp = `${value}`;
  return (temp.length >= width)
    ? temp
    : new Array(width - temp.length + 1).join(padding) + temp;
}

export function timeToString(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) - (hours * 60);
  seconds = Math.floor(seconds - minutes * 60 - hours * 3600);

  if (hours > 0) {
    return `${pad(hours, '0', 2)}:${pad(minutes, '0', 2)}:${pad(seconds, '0', 2)}`;
  } else {
    return `${pad(minutes, '0', 2)}:${pad(seconds, '0', 2)}`;
  }
}

let convertDiv: HTMLDivElement;

export function encodeHTML(input: string): string {
  if (input === undefined) {
    return undefined;
  }
  if (convertDiv === undefined) {
    convertDiv = document.createElement('div');
  }
  convertDiv.innerText = input;
  return convertDiv.innerHTML;
}

export function decodeHTML(input: string): string {
  if (input === undefined) {
    return undefined;
  }
  if (convertDiv === undefined) {
    convertDiv = document.createElement('div');
  }
  convertDiv.innerHTML = input;
  return convertDiv.innerText;
}

const PROP_BLACKLIST = ['constructor',
  '__defineGetter__',
  '__defineSetter__',
  'hasOwnProperty',
  '__lookupGetter__',
  '__lookupSetter__',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toString',
  'valueOf',
  '__proto__',
  'toLocaleString' ];

export function getAllPropertyNames(obj: object) {
  let props: string[] = [];

  while (obj !== null) {
    const objProps = Object.getOwnPropertyNames(obj);
    // don't want the properties of the "base" object
    if (objProps.indexOf('__defineGetter__') !== -1) {
      break;
    }
    props = props.concat(objProps);
    obj = Object.getPrototypeOf(obj);
  }

  return Array.from(new Set(_.difference(props, PROP_BLACKLIST)));
}

/**
 * test if a directory is a sub-directory of another one
 * @param child path of the presumed sub-directory
 * @param parent path of the presumed parent directory
 */
export function isChildPath(child: string, parent: string, normalize?: Normalize): boolean {
  if (normalize === undefined) {
    normalize = (input) => process.platform === 'win32'
      ? path.normalize(input.toLowerCase())
      : path.normalize(input);
  }

  const childNorm = normalize(child);
  const parentNorm = normalize(parent);
  if (child === parent) {
    return false;
  }

  const tokens = parentNorm.split(path.sep).filter(token => token.length > 0);
  const childTokens = childNorm.split(path.sep).filter(token => token.length > 0);

  return tokens.every((token: string, idx: number) => childTokens[idx] === token);
}

/**
 * take any input string and sanitize it into a valid css id
 */
export function sanitizeCSSId(input: string) {
  return input.toLowerCase().replace(/[ .#]/g, '-');
}
