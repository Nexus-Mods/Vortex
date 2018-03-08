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

import { delayed } from './delayed';
import runElevated from './elevated';

import * as Promise from 'bluebird';
import { dialog as dialogIn, remote } from 'electron';
import * as fs from 'fs-extra-promise';
import ipc = require('node-ipc');
import * as path from 'path';
import { getUserId } from 'permissions';
import { generate as shortid } from 'shortid';

const dialog = dialogIn || remote.dialog;

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
  moveAsync,
  openSync,
  openAsync,
  readFileAsync,
  readFileSync,
  readlinkAsync,
  readJSONSync,
  removeSync,
  renameAsync,
  statAsync,
  statSync,
  symlinkAsync,
  watch,
  writeAsync,
  writeFileAsync,
  writeSync,
} from 'fs-extra-promise';

const NUM_RETRIES = 3;
const RETRY_DELAY_MS = 100;
const RETRY_ERRORS = new Set(['EPERM', 'EBUSY', 'EUNKNOWN']);

function genWrapperAsync<T extends (...args) => any>(func: T): T {
  const res = (...args) => {
    const stack = new Error().stack;
    return func(...args)
      .catch(err => {
        err.stack = err.message + '\n' + stack;
        throw err;
      });
  };
  return res as T;
}

const mkdirAsync = genWrapperAsync(fs.mkdirAsync);
const utimesAsync = genWrapperAsync(fs.utimesAsync);
const readdirAsync = genWrapperAsync(fs.readdirAsync);
export {
  mkdirAsync,
  readdirAsync,
  utimesAsync,
};

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
        err.stack = err.message + '\n' + stack;
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
      err.stack = err.message + '\n' + stack;
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
      err.stack = err.message + '\n' + stack;
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
      err.stack = err.message + '\n' + stack;
      throw err;
    });
}

export function ensureDirWritableAsync(dirPath: string,
                                       confirm: () => Promise<void>): Promise<void> {
  return fs.ensureDirAsync(dirPath)
    .then(() => {
      const canary = path.join(dirPath, '__vortex_canary');
      return (fs as any).ensureFileAsync(canary)
                    .then(() => fs.removeAsync(canary));
    })
    .catch(err => {
      if (err.code === 'EPERM') {
        return confirm()
          .then(() => new Promise<void>((resolve, reject) => {
              const id = shortid();
              const userId = getUserId();
              ipc.serve(`__fs_elevated_${id}`, () => undefined);
              ipc.server.start();
              ipc.server.on('socket.disconnected', () => {
                ipc.server.stop();
                resolve();
              });
              ipc.server.on('error', ipcErr => {
                reject(ipcErr);
              });
              ipc.server.on('disconnect', () => {
                ipc.server.stop();
                resolve();
              });

              runElevated(`__fs_elevated_${id}`, (ipcClient) => {
                // tslint:disable-next-line:no-shadowed-variable
                const fs = require('fs-extra-promise');
                const { allow } = require('permissions');
                return fs.ensureDirAsync(dirPath)
                  .then(() => {
                    return allow(dirPath, userId, 'rwx');
                  });
              }, { dirPath, userId })
              .catch(reject);
          }));
      } else {
        return Promise.reject(err);
      }
    });
}
