import { showDialog } from '../actions/notifications';
import { IDialogResult } from '../types/IDialog';
import { UserCanceled } from './CustomErrors';
import delayed from './delayed';
import { log } from './log';

import * as Promise from 'bluebird';
import { spawn } from 'child_process';
import { app as appIn, remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as _ from 'lodash';
import * as path from 'path';
import * as Redux from 'redux';
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

export function removePersistent(store: Redux.Store<any>, destPath: string): Promise<void> {
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
export function objDiff(lhs: any, rhs: any): any {
  const res = {};

  if ((typeof(lhs) === 'object') && (typeof(rhs) === 'object')) {
    Object.keys(lhs || {}).forEach(key => {
      if ((rhs[key] === undefined)) {
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
      if ((lhs[key] === undefined)) {
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
  const app = appIn || remote.app;
  if (process.execPath.endsWith('electron.exe')) {
    // development version
    args = [path.resolve(__dirname, '..', '..')].concat(args);
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
