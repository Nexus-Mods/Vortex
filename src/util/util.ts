import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import {file} from 'tmp';

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
  return container.reduce((total: number, value: number): number => {
    return total + value;
  }, 0);
}

/**
 * promise-equivalent of setTimeout
 * 
 * @export
 * @param {number} durationMS
 * @param {*} [value]
 * @returns
 */
export function delayed(durationMS: number, value?: any) {
  let timer: NodeJS.Timer;
  let reject: (err: Error) => void;
  let res = new Promise((resolve, rejectPar) => {
    timer = setTimeout(() => {
      resolve(value);
    }, durationMS);
    reject = rejectPar;
  });
  res.cancel = () => {
    clearTimeout(timer);
    reject(new Error('delayed operation canceled'));
  };
  return res;
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
export function copyFileAtomic(srcPath: string, destPath: string): Promise<void> {
  let cleanup: () => void;
  let tmpPath: string;
  return new Promise((resolve, reject) => {
    file({ template: `${destPath}.XXXXXX.tmp` },
         (err: any, genPath: string, fd: number, cleanupCB: () => void) => {
      if (err) {
        reject(err);
      }
      cleanup = cleanupCB;
      tmpPath = genPath;
      resolve(fd);
    });
  })
  .then((fd: number) => {
    return fs.closeAsync(fd);
  })
  .then(() => {
    return fs.copyAsync(srcPath, tmpPath);
  })
  .then(() => {
    return fs.unlinkAsync(destPath).catch((err) => {
      if (err.code === 'ENOENT') {
        return Promise.resolve();
      } else {
        return Promise.reject(err);
      }
    });
  })
  .then(() => {
    return fs.renameAsync(tmpPath, destPath);
  })
  .catch((err) => {
    cleanup();
    return Promise.reject(err);
  })
  ;
}
