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

import { UserCanceled } from './CustomErrors';
import { delayed } from './delayed';
import runElevated from './elevated';

import * as Promise from 'bluebird';
import { dialog as dialogIn, remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as I18next from 'i18next';
import ipc = require('node-ipc');
import * as path from 'path';
import { getUserId } from 'permissions';
import { generate as shortid } from 'shortid';

const dialog = remote !== undefined ? remote.dialog : dialogIn;

export { constants, FSWatcher, Stats, WriteStream } from 'fs';

// simple re-export of functions we don't touch (yet)
export {
  accessSync,
  closeSync,
  createReadStream,
  createWriteStream,
  linkSync,
  openSync,
  readFileSync,
  readJSONSync,
  removeSync,
  statSync,
  watch,
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

const chmodAsync = genWrapperAsync(fs.chmodAsync);
const closeAsync = genWrapperAsync(fs.closeAsync);
const fsyncAsync = genWrapperAsync(fs.fsyncAsync);
const linkAsync = genWrapperAsync(fs.linkAsync);
const lstatAsync = genWrapperAsync(fs.lstatAsync);
const mkdirAsync = genWrapperAsync(fs.mkdirAsync);
const moveAsync = genWrapperAsync(fs.moveAsync);
const openAsync = genWrapperAsync(fs.openAsync);
const readdirAsync = genWrapperAsync(fs.readdirAsync);
const readFileAsync = genWrapperAsync(fs.readFileAsync);
const readlinkAsync = genWrapperAsync(fs.readlinkAsync);
const renameAsync = genWrapperAsync(fs.renameAsync);
const statAsync = genWrapperAsync(fs.statAsync);
const symlinkAsync = genWrapperAsync(fs.symlinkAsync);
const utimesAsync = genWrapperAsync(fs.utimesAsync);
const writeAsync = genWrapperAsync(fs.writeAsync);
const writeFileAsync = genWrapperAsync(fs.writeFileAsync);

export {
  chmodAsync,
  closeAsync,
  fsyncAsync,
  linkAsync,
  lstatAsync,
  mkdirAsync,
  moveAsync,
  openAsync,
  readlinkAsync,
  readdirAsync,
  readFileAsync,
  renameAsync,
  statAsync,
  symlinkAsync,
  utimesAsync,
  writeAsync,
  writeFileAsync,
};

export function ensureDirSync(dirPath: string) {
  try {
    fs.ensureDirSync(dirPath);
  } catch (err) {
    err.stack = err.stack + '\n' + (new Error().stack);
    throw err;
  }
}

export function ensureFileAsync(filePath: string): Promise<void> {
  return (fs as any).ensureFileAsync(filePath);
}

export function ensureDirAsync(dirPath: string): Promise<void> {
  const stack = new Error().stack;
  return fs.ensureDirAsync(dirPath)
    .catch(err => {
      // ensureDir isn't supposed to cause EEXIST errors as far as I understood
      // it but on windows, when targeting a OneDrive path (and similar?)
      // it apparently still does
      if (err.code === 'EEXIST') {
        return Promise.resolve();
      }
      err.stack = err.message + '\n' + stack;
      return Promise.reject(err);
    });
}

export function copyAsync(src: string, dest: string,
                          options?: RegExp |
                              ((src: string, dest: string) => boolean) |
                              fs.CopyOptions): Promise<void> {
  const stack = new Error().stack;
  // fs.copy in fs-extra has a bug where it doesn't correctly avoid copying files onto themselves
  return Promise.join(fs.statAsync(src),
                      fs.statAsync(dest)
                .catch(err => err.code === 'ENOENT' ? Promise.resolve({}) : Promise.reject(err)))
    .then((stats: fs.Stats[]) => {
      if (stats[0].ino === stats[1].ino) {
        const err = new Error('Source and destination are the same file.');
        err.stack = err.message + '\n' + stack;
        return Promise.reject(err);
      }  else {
        Promise.resolve();
      }
    })
    .then(() => copyInt(src, dest, options || undefined, stack, NUM_RETRIES));
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

function elevated(func: () => void, parameters: any): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const id = shortid();
    ipc.serve(`__fs_elevated_${id}`, () => {
      runElevated(`__fs_elevated_${id}`, func, parameters)
        .catch(reject);
    });
    ipc.server.on('socket.disconnected', () => {
      ipc.server.stop();
      resolve();
    });
    ipc.server.on('error', ipcErr => {
      reject(new Error(ipcErr));
    });
    ipc.server.on('disconnect', () => {
      ipc.server.stop();
      resolve();
    });
    ipc.server.start();
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
          .then(() => {
            const userId = getUserId();
            return elevated(() => {
              // tslint:disable-next-line:no-shadowed-variable
              const fs = require('fs-extra-promise');
              const { allow } = require('permissions');
              return fs.ensureDirAsync(dirPath)
                .then(() => {
                  return allow(dirPath, userId, 'rwx');
                });
            }, { dirPath, userId });
          });
      } else {
        return Promise.reject(err);
      }
    });
}

export function forcePerm<T>(t: I18next.TranslationFunction, op: () => Promise<T>): Promise<T> {
  return op()
    .catch(err => {
      if (err.code === 'EPERM') {
        const choice = dialog.showMessageBox(
          remote !== undefined ? remote.getCurrentWindow() : null, {
          message: t('Vortex needs to access a file it doesn\'t have permission to.\n'
                   + 'If your account has admin rights Vortex can unlock the file for you. '
                   + 'Windows will show an UAC dialog.',
            { replace: { fileName: err.path } }),
          buttons: [
            'Cancel',
            'Give permission',
          ],
          noLink: true,
          title: 'Access denied',
          type: 'warning',
          detail: err.path,
        });
        if (choice === 1) {
          let filePath = err.path;
          const userId = getUserId();
          return fs.statAsync(err.path)
            .catch((statErr) => {
              if (statErr.code === 'ENOENT') {
                filePath = path.dirname(filePath);
              }
              return Promise.resolve();
            })
            .then(() => elevated(() => {
                // tslint:disable-next-line:no-shadowed-variable
                const fs = require('fs-extra-promise');
                const { allow } = require('permissions');
                return allow(filePath, userId, 'rwx');
              }, { filePath, userId }))
            .then(() => forcePerm(t, op));
        } else {
          return Promise.reject(new UserCanceled());
        }
      } else {
        return Promise.reject(err);
      }
    });
}
