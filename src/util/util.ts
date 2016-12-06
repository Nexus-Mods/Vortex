import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import {file} from 'tmp';

export function countIf<T>(container: T[], predicate: (value: T) => boolean): number {
  return container.reduce((count: number, value: T): number => {
    return count + (predicate(value) ? 1 : 0);
  }, 0);
}

export function sum(container: number[]): number {
  return container.reduce((total: number, value: number): number => {
    return total + value;
  }, 0);
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
    return fs.unlinkAsync(destPath);
  })
  .then(() => {
    return fs.renameAsync(tmpPath, destPath);
  })
  .catch((err) => {
    cleanup();
    throw err;
  })
  ;
}
