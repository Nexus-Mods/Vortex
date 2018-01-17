/**
 * wrapper for the fs / fs-extra-promise module
 * this allows us to customise the behaviour of fs function across the application.
 * The api should remain compatible with fs-extra-promise, but extensions can be made
 * Notable behaviour changes:
 * - common async functions now retrieve a backtrace before calling, so that on error
 *   they can provide a useful backtrace to where the function was called
 *   (for many error cases the original function didn't have a stack trace in the first place)
 * - retrying on functions that commonly fail temporarily due to external applications
 *   (virus scanners, functions called from vortex) locking files.
 * - ignoring ENOENT error when deleting a file.
 */

import {delayed} from './delayed';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';

export { constants, FSWatcher, Stats, WriteStream } from 'fs';

// simple re-export of functions we don't touch (yet)
export {
  accessSync,
  chmodAsync,
  closeAsync,
  closeSync,
  createReadStream,
  createWriteStream,
  ensureDirAsync,
  ensureDirSync,
  fsyncAsync,
  linkAsync,
  linkSync,
  lstatAsync,
  mkdirAsync,
  moveAsync,
  openSync,
  openAsync,
  readFileAsync,
  readFileSync,
  readdirAsync,
  readlinkAsync,
  readJSONSync,
  removeSync,
  renameAsync,
  statAsync,
  statSync,
  symlinkAsync,
  utimesAsync,
  watch,
  writeAsync,
  writeFileAsync,
  writeSync,
} from 'fs-extra-promise';

const NUM_RETRIES = 3;
const RETRY_DELAY_MS = 100;
const RETRY_ERRORS = new Set(['EPERM', 'EBUSY', 'EUNKNOWN']);

export function ensureFileAsync(filePath: string): Promise<void> {
  return (fs as any).ensureFileAsync(filePath);
}

export function copyAsync(src: string, dest: string,
                          options?: RegExp |
                              ((src: string, dest: string) => boolean) |
                              fs.CopyOptions): Promise<void> {
  return copyInt(src, dest, options || undefined, new Error().stack, NUM_RETRIES);
}

function copyInt(
    src: string, dest: string,
    options: RegExp | ((src: string, dest: string) => boolean) | fs.CopyOptions,
    stack: string,
    tries: number) {
  return fs.copyAsync(src, dest, options)
      .catch((err: NodeJS.ErrnoException) => {
        if (RETRY_ERRORS.has(err.code) && (tries > 0)) {
          return delayed(RETRY_DELAY_MS)
            .then(() => copyInt(src, dest, options, stack, tries - 1));
        }
        err.stack = stack;
        throw err;
      });
}

export function removeAsync(dirPath: string): Promise<void> {
  return removeInt(dirPath, new Error().stack, NUM_RETRIES);
}

function removeInt(dirPath: string, stack: string, tries: number): Promise<void> {
  return fs.removeAsync(dirPath)
    .catch((err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        // don't mind if a file we wanted deleted was already gone
        return Promise.resolve();
      } else if (RETRY_ERRORS.has(err.code) && (tries > 0)) {
          return delayed(RETRY_DELAY_MS)
            .then(() => removeInt(dirPath, stack, tries - 1));
      }
      err.stack = stack;
      throw err;
    });
}

export function unlinkAsync(dirPath: string): Promise<void> {
  return unlinkInt(dirPath, new Error().stack, NUM_RETRIES);
}

function unlinkInt(dirPath: string, stack: string, tries: number): Promise<void> {
  return fs.unlinkAsync(dirPath)
    .catch((err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        // don't mind if a file we wanted deleted was already gone
        return Promise.resolve();
      } else if (RETRY_ERRORS.has(err.code) && (tries > 0)) {
          return delayed(RETRY_DELAY_MS)
            .then(() => unlinkInt(dirPath, stack, tries - 1));
      }
      err.stack = stack;
      throw err;
    });
}

export function rmdirAsync(dirPath: string): Promise<void> {
  return rmdirInt(dirPath, new Error().stack, NUM_RETRIES);
}

function rmdirInt(dirPath: string, stack: string, tries: number): Promise<void> {
  return fs.rmdirAsync(dirPath)
    .catch((err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        // don't mind if a file we wanted deleted was already gone
        return Promise.resolve();
      } else if (RETRY_ERRORS.has(err.code) && (tries > 0)) {
          return delayed(RETRY_DELAY_MS)
            .then(() => rmdirInt(dirPath, stack, tries - 1));
      }
      err.stack = stack;
      throw err;
    });
}
