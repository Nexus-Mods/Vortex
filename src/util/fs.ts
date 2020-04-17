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

import { ProcessCanceled, UserCanceled } from './CustomErrors';
import { createErrorReport, getVisibleWindow } from './errorHandling';
import { TFunction } from './i18n';
import { log } from './log';
import { truthy } from './util';

import PromiseBB from 'bluebird';
import { dialog as dialogIn, remote } from 'electron';
import * as fs from 'fs-extra';
import JsonSocket from 'json-socket';
import * as net from 'net';
import * as path from 'path';
import { allow as allowT, getUserId } from 'permissions';
import rimraf from 'rimraf';
import { generate as shortid } from 'shortid';
import { runElevated } from 'vortex-run';
import wholocks from 'wholocks';

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
  statSync,
  symlinkSync,
  watch,
  writeFileSync,
  writeSync,
} from 'fs';

export interface ILinkFileOptions {
  // Used to dictate whether error dialogs should
  //  be displayed upon error repeat.
  showDialogCallback?: () => boolean;
}

export interface IRemoveFileOptions {
  // Used to dictate whether error dialogs should
  //  be displayed upon error repeat.
  showDialogCallback?: () => boolean;
}

const NUM_RETRIES = 5;
const RETRY_DELAY_MS = 100;
const RETRY_ERRORS = new Set(['EPERM', 'EBUSY', 'EIO', 'EBADF', 'ENOTEMPTY', 'UNKNOWN']);

const simfail = (process.env.SIMULATE_FS_ERRORS === 'true')
  ? (func: () => PromiseBB<any>): PromiseBB<any> => {
    if (Math.random() < 0.25) {
      const code = Math.random() < 0.33 ? 'EBUSY' : Math.random() < 0.5 ? 'EIO' : 'UNKNOWN';
      const res: any = new Error(`fake error ${code}`);
      if (code === 'UNKNOWN') {
        res['nativeCode'] = 21;
      }
      res.code = code;
      res.path = 'foobar file';
      return PromiseBB.reject(res);
    } else {
      return func();
    }
  }
  : (func: () => PromiseBB<any>) => func();

function nospcQuery(): PromiseBB<boolean> {
  if (dialog === undefined) {
    return PromiseBB.resolve(false);
  }

  const options: Electron.MessageBoxOptions = {
    title: 'Disk full',
    message: `Operation can't continue because the disk is full. `
           + 'Please free up some space and click retry. Cancelling the transfer operation '
           + 'at this point will remove any changes and revert back to the previous state.',
    buttons: ['Cancel', 'Retry'],
    type: 'warning',
    noLink: true,
  };

  const choice = dialog.showMessageBoxSync(getVisibleWindow(), options);
  return (choice === 0)
    ? PromiseBB.reject(new UserCanceled())
    : PromiseBB.resolve(true);
}

function unlockConfirm(filePath: string): PromiseBB<boolean> {
  if ((dialog === undefined) || !truthy(filePath)) {
    return PromiseBB.resolve(false);
  }

  let processes = [];
  try {
    processes = wholocks(filePath);
  } catch (err) {
    log('warn', 'failed to determine list of processes locking file',
        { filePath, error: err.message });
  }

  const baseMessage = processes.length === 0
    ? `Vortex needs to access "${filePath}" but doesn\'t have permission to.`
    : `Vortex needs to access "${filePath}" but it either has too restrictive `
      + 'permissions or is locked by another process.';

  const buttons = [
      'Cancel',
      'Retry',
  ];

  if (processes.length === 0) {
    buttons.push('Give permission');
  }

  const options: Electron.MessageBoxOptions = {
    title: 'Access denied',
    message: baseMessage
      + ' If your account has admin rights Vortex can try to unlock the file for you.',
    detail: processes.length === 0
      ? undefined
      : 'Please close the following applications and retry:\n'
        + processes.map(proc => `${proc.appName} (${proc.pid})`).join('\n'),
    buttons,
    type: 'warning',
    noLink: true,
  };

  const choice = dialog.showMessageBoxSync(getVisibleWindow(), options);
  return (choice === 0)
    ? PromiseBB.reject(new UserCanceled())
    : PromiseBB.resolve(choice === 2);
}

function unknownErrorRetry(filePath: string, err: Error, stackErr: Error): PromiseBB<boolean> {
  if ((dialog === undefined) || !truthy(filePath)) {
    return PromiseBB.resolve(false);
  }

  const options: Electron.MessageBoxOptions = {
    title: 'Unknown error',
    message:
      `The operating system has reported an error without details when accessing "${filePath}" `
      + 'This is usually due the user\'s environment and not a bug in Vortex.\n'
      + 'Please diagonse your environment and then retry',
    detail: 'Possible error causes:\n'
      + `1. "${filePath}" is a removable, possibly network drive which has been disconnected.\n`
      + '2. An External application has interferred with file operations '
      + '(Anti-virus, Disk Management Utility, Virus)\n',
    type: 'warning',
    noLink: true,
  };

  let rethrowAs: string;

  if (truthy(err['nativeCode'])) {
    if (err['nativeCode'] === 225) {
      options.title = 'Anti Virus denied access';
      options.message = `Your Anti-Virus Software has blocked access to "${filePath}".`;
      options.detail = undefined;
      rethrowAs = 'EBUSY';
    } else if ([21, 59, 67, 483, 793, 1005, 1006,
                1127, 1392, 1920, 6800].includes(err['nativeCode'])) {
      options.title = `I/O Error (${err['nativeCode']})`;
      options.message = `Accessing "${filePath}" failed with an error that indicates `
                      + 'a hardware problem. This may indicate the disk is defective, '
                      + 'if it\'s a network or cloud drive it may simply indicate '
                      + 'temporary network or server problems. '
                      + 'Please do not report this to us, this is not a bug in Vortex '
                      + 'and we can not provide remote assistance with hardware problems.';
      rethrowAs = 'ENOENT';
    } else if ([1336].includes(err['nativeCode'])) {
      options.title = `I/O Error (${err['nativeCode']})`;
      options.message = `Accessing "${filePath}" failed with an error that indicates `
                      + 'file system corruption. If this isn\'t a temporary problem '
                      + 'you may want to run chkdsk or similar software to check for problems. '
                      + 'It may also help to reinstall the software that this file belongs to.';
      rethrowAs = 'EIO';
    } else if ([362, 383, 390, 395, 396, 404].indexOf(err['nativeCode']) !== -1) {
      options.title = `OneDrive error (${err['nativeCode']})`;
      options.message = `The file "${filePath}" is stored on a cloud storage drive `
                      + '(Microsoft OneDrive) which is currently unavailable. Please '
                      + 'check your internet connection and verify the service is running, '
                      + 'then retry.';
      options.detail = undefined;
      rethrowAs = 'ENOENT';
    } else if ([4390, 4393, 4394].indexOf(err['nativeCode']) !== -1) {
      options.title = `Incompatible folder (${err['nativeCode']})`;
      options.message = `Windows reported an error message regarding "${filePath}" that indicates `
                      + 'the containing folder has limitations that make it unsuitable for what '
                      + 'it\'s being used. '
                      + 'A common example of this is if you try to put the staging folder on a '
                      + 'OneDrive folder because OneDrive can\'t deal with hardlinks.';
      rethrowAs = 'EIO';
    } else if ([433, 1920].indexOf(err['nativeCode']) !== -1) {
      options.title = `Drive unavailable (${err['nativeCode']})`;
      options.message = `The file "${filePath}" is currently not accessible. If this is a `
                      + 'network drive, please make sure it\'s connected. Otherwise make sure '
                      + 'the drive letter hasn\'t changed and if necessary, update the path '
                      + 'within Vortex.';
      rethrowAs = 'ENOENT';
    } else if ([53, 55, 4350].indexOf(err['nativeCode']) !== -1) {
      options.title = `Network drive unavailable (${err['nativeCode']})`;
      options.message = `The file "${filePath}" is currently not accessible, very possibly the `
                      + 'network share as a whole is inaccesible due to a network problem '
                      + 'or the server being offline.';
      rethrowAs = 'ENOENT';
    } else if (err['nativeCode'] === 1816) {
      options.title = 'Not enough quota';
      options.message = `Windows reported insufficient quota writing to "${filePath}".`;
      rethrowAs = 'EIO';
    } else if (err['nativeCode'] === 6851) {
      options.title = 'Volume dirty';
      options.message = 'The operation could not be completed because the volume is dirty. '
                      + 'Please run chkdsk and try again.';
      rethrowAs = 'EIO';
    } else if (err['nativeCode'] === 1359) {
      options.title = 'Internal error';
      options.message = 'The operation failed with an internal (internal to windows) error. '
                      + 'No further error information is available to us.';
      rethrowAs = 'EIO';
    } else {
      options.title = `${err.message} (${err['nativeCode']})`;
      // no longer offering the report option because for month we got no report that we could
      // actually do anything about, it's always setup problems
      // options.buttons.unshift('Cancel and Report');
    }
  }

  if (rethrowAs === undefined) {
    options.buttons = [
      'Cancel',
      'Retry',
    ];
  } else {
    options.message += '\n\nYou can try continuing but you do so at your own risk.';
    options.buttons = [
      'Cancel',
      'Ignore',
      'Retry',
    ];
  }

  const choice = dialog.showMessageBoxSync(getVisibleWindow(), options);

  if (options.buttons[choice] === 'Cancel and Report') {
    // we're reporting this to collect a list of native errors and provide better error
    // message
    const nat = err['nativeCode'];
    createErrorReport('Unknown error', {
      message: `Windows System Error (${nat})`,
      stack: restackErr(err, stackErr).stack,
      path: filePath,
    }, {}, ['bug'], {});
    return PromiseBB.reject(new UserCanceled());
  }

  switch (options.buttons[choice]) {
    case 'Retry': return PromiseBB.resolve(true);
    case 'Ignore': {
      err['code'] = rethrowAs;
      return PromiseBB.reject(err);
    }
    case 'Cancel': PromiseBB.reject(new UserCanceled());
  }
}

function busyRetry(filePath: string): PromiseBB<boolean> {
  if ((dialog === undefined) || !truthy(filePath)) {
    return PromiseBB.resolve(false);
  }

  let processes = [];
  try {
    processes = wholocks(filePath);
  } catch (err) {
    log('warn', 'failed to determine list of processes locking file',
        { filePath, error: err.message });
  }

  const options: Electron.MessageBoxOptions = {
    title: 'File busy',
    message: `Vortex needs to access "${filePath}" but it\'s open in another application. `
      + 'Please close the file in all other applications and then retry.',
    detail: 'Please close the following applications and retry:\n'
          + processes.map(proc => `${proc.appName} (${proc.pid})`).join('\n'),
    buttons: [
      'Cancel',
      'Retry',
    ],
    type: 'warning',
    noLink: true,
  };

  const choice = dialog.showMessageBoxSync(getVisibleWindow(), options);
  return (choice === 0)
    ? PromiseBB.reject(new UserCanceled())
    : PromiseBB.resolve(true);
}

function errorRepeat(error: NodeJS.ErrnoException, filePath: string, retries: number,
                     stackErr: Error, showDialogCallback?: () => boolean): PromiseBB<boolean> {
  if ((retries > 0) && RETRY_ERRORS.has(error.code)) {
    // retry these errors without query for a few times
    return PromiseBB.delay(100).then(() => PromiseBB.resolve(true));
  }
  if ((showDialogCallback !== undefined) && !showDialogCallback()) {
    return PromiseBB.resolve(false);
  }
  // system error code 1224 means there is a user-mapped section open in the file
  if ((error.code === 'EBUSY') || (error['nativeCode'] === 1224)) {
    return busyRetry(filePath);
  } else if (error.code === 'ENOSPC') {
    return nospcQuery();
  } else if (error.code === 'EPERM') {
    return unlockConfirm(filePath)
      .then(doUnlock => {
        if (doUnlock) {
          const userId = getUserId();
          return elevated((ipcPath, req: NodeRequire) => {
            const { allow }: { allow: typeof allowT } = req('permissions');
            return allow(filePath, userId as any, 'rwx');
          }, { filePath, userId })
            .then(() => true)
            .catch(elevatedErr => {
              if ((elevatedErr instanceof UserCanceled)
              || (elevatedErr.message.indexOf('The operation was canceled by the user') !== -1)) {
                return Promise.reject(new UserCanceled());
              }
              // if elevation failed, return the original error because the one from
              // elevate - while interesting as well - would make error handling too complicated
              log('error', 'failed to acquire permission', {
                filePath,
                error: elevatedErr.message,
              });
              return Promise.reject(error);
            });
        } else {
          return PromiseBB.resolve(true);
        }
      });
  } else if (error.code === 'UNKNOWN') {
    return unknownErrorRetry(filePath, error, stackErr);
  } else {
    return PromiseBB.resolve(false);
  }
}

function restackErr(error: Error, stackErr: Error): Error {
  // resolve the stack at the last possible moment because stack is actually a getter
  // that will apply expensive source mapping when called
  Object.defineProperty(error, 'stack', {
    get: () => error.message + '\n' + stackErr.stack,
    set: () => null,
  });
  return error;
}

function errorHandler(error: NodeJS.ErrnoException,
                      stackErr: Error, tries: number,
                      showDialogCallback?: () => boolean): PromiseBB<void> {
  return errorRepeat(error, (error as any).dest || error.path, tries,
                     stackErr, showDialogCallback)
    .then(repeat => repeat
      ? PromiseBB.resolve()
      : PromiseBB.reject(restackErr(error, stackErr)))
    .catch(err => PromiseBB.reject(restackErr(err, stackErr)));
}

function genWrapperAsync<T extends (...args) => any>(func: T): T {
  const wrapper = (stackErr: Error, tries: number, ...args) =>
    simfail(() => PromiseBB.resolve(func(...args)))
      .catch(err => errorHandler(err, stackErr, tries)
        .then(() => wrapper(stackErr, tries - 1, ...args)));

  const res = (...args) => {
    return wrapper(new Error(), NUM_RETRIES, ...args);
  };
  return res as T;
}

const fsBB: any = PromiseBB.promisifyAll(fs);

// tslint:disable:max-line-length
const chmodAsync: (path: string, mode: string | number) => PromiseBB<void> = genWrapperAsync(fsBB.chmodAsync);
const closeAsync: (fd: number) => PromiseBB<void> = genWrapperAsync(fsBB.closeAsync);
const fsyncAsync: (fd: number) => PromiseBB<void> = genWrapperAsync(fsBB.fsyncAsync);
const lstatAsync: (path: string) => PromiseBB<fs.Stats> = genWrapperAsync(fsBB.lstatAsync);
const mkdirAsync: (path: string) => PromiseBB<void> = genWrapperAsync(fsBB.mkdirAsync);
const mkdirsAsync: (path: string) => PromiseBB<void> = genWrapperAsync(fsBB.mkdirsAsync);
const moveAsync: (src: string, dest: string, options?: fs.MoveOptions) => PromiseBB<void> = genWrapperAsync(fsBB.moveAsync);
const openAsync: (path: string, flags: string | number, mode?: number) => PromiseBB<number> = genWrapperAsync(fsBB.openAsync);
const readdirAsync: (path: string) => PromiseBB<string[]> = genWrapperAsync(fsBB.readdirAsync);
const readFileAsync: (...args: any[]) => PromiseBB<any> = genWrapperAsync(fsBB.readFileAsync);
const statAsync: (path: string) => PromiseBB<fs.Stats> = genWrapperAsync(fsBB.statAsync);
const symlinkAsync: (srcpath: string, dstpath: string, type?: string) => PromiseBB<void> = genWrapperAsync(fsBB.symlinkAsync);
const utimesAsync: (path: string, atime: number, mtime: number) => PromiseBB<void> = genWrapperAsync(fsBB.utimesAsync);
// fs.write and fs.read don't promisify correctly because it has two return values. fs-extra already works around this in their
// promisified api so no reason to reinvent the wheel (also we want the api to be compatible)
const writeAsync: (...args: any[]) => PromiseBB<fs.WriteResult> = genWrapperAsync(fs.write) as any;
const readAsync: (...args: any[]) => PromiseBB<fs.ReadResult> = genWrapperAsync(fs.read) as any;
const writeFileAsync: (file: string, data: any, options?: fs.WriteFileOptions) => PromiseBB<void> = genWrapperAsync(fsBB.writeFileAsync);
// tslint:enable:max-line-length

export {
  chmodAsync,
  closeAsync,
  fsyncAsync,
  lstatAsync,
  mkdirAsync,
  mkdirsAsync,
  moveAsync,
  openAsync,
  readdirAsync,
  readAsync,
  readFileAsync,
  statAsync,
  symlinkAsync,
  utimesAsync,
  writeAsync,
  writeFileAsync,
};

export function isDirectoryAsync(dirPath: string): PromiseBB<boolean> {
  return PromiseBB.resolve(fs.stat(dirPath))
    .then(stats => stats.isDirectory());
}

export function ensureDirSync(dirPath: string) {
  try {
    fs.ensureDirSync(dirPath);
  } catch (err) {
    throw restackErr(err, new Error());
  }
}

export function ensureFileAsync(filePath: string): PromiseBB<void> {
  const stackErr = new Error();
  return (fs as any).ensureFileAsync(filePath)
    .catch(err => restackErr(err, stackErr));
}

export function ensureDirAsync(dirPath: string): PromiseBB<void> {
  const stackErr = new Error();
  return ensureDirInt(dirPath, stackErr, NUM_RETRIES);
}

function ensureDirInt(dirPath: string, stackErr: Error, tries: number) {
  return fsBB.ensureDirAsync(dirPath)
    .catch(err => {
      // ensureDir isn't supposed to cause EEXIST errors as far as I understood
      // it but on windows, when targeting a OneDrive path (and similar?)
      // it apparently still does
      if (err.code === 'EEXIST') {
        return PromiseBB.resolve(null);
      }
      return simfail(() => errorHandler(err, stackErr, tries, undefined))
        .then(() => ensureDirInt(dirPath, stackErr, tries - 1));
    });
}

function selfCopyCheck(src: string, dest: string) {
  return PromiseBB.join(fsBB.statAsync(src), fsBB.statAsync(dest)
                .catch({ code: 'ENOENT' }, err => PromiseBB.resolve({})))
    .then((stats: fs.Stats[]) => (stats[0].ino === stats[1].ino)
        ? PromiseBB.reject(new Error(
          `Source "${src}" and destination "${dest}" are the same file (id "${stats[0].ino}").`))
        : PromiseBB.resolve());
}

/**
 * copy file
 * The copy function from fs-extra doesn't (at the time of writing) correctly check that a file
 * isn't copied onto itself (it fails for links or potentially on case insensitive disks),
 * so this makes a check based on the ino number.
 * Unfortunately a bug in node.js (https://github.com/nodejs/node/issues/12115) prevents this
 * check from working reliably so it can currently be disabled.
 * @param src file to copy
 * @param dest destination path
 * @param options copy options (see documentation for fs)
 */
export function copyAsync(src: string, dest: string,
                          options?: fs.CopyOptions & {
                            noSelfCopy?: boolean,
                            showDialogCallback?: () => boolean }): PromiseBB<void> {
  const stackErr = new Error();
  // fs.copy in fs-extra has a bug where it doesn't correctly avoid copying files onto themselves
  const check = (options !== undefined) && options.noSelfCopy
    ? PromiseBB.resolve()
    : selfCopyCheck(src, dest);
  return check
    .then(() => copyInt(src, dest, options || undefined, stackErr, NUM_RETRIES))
    .catch(err => PromiseBB.reject(restackErr(err, stackErr)));
}

function copyInt(
    src: string, dest: string,
    options: fs.CopyOptions & { noSelfCopy?: boolean,
                                showDialogCallback?: () => boolean },
    stackErr: Error,
    tries: number) {
  return simfail(() => fsBB.copyAsync(src, dest, options))
    .catch((err: NodeJS.ErrnoException) =>
      errorHandler(err, stackErr, tries,
                  (options !== undefined) ? options.showDialogCallback : undefined)
        .then(() => copyInt(src, dest, options, stackErr, tries - 1)));
}

export function linkAsync(
    src: string, dest: string,
    options?: ILinkFileOptions): PromiseBB<void> {
  const stackErr = new Error();
  return linkInt(src, dest, stackErr, NUM_RETRIES, options)
    .catch(err => PromiseBB.reject(restackErr(err, stackErr)));
}

function linkInt(
    src: string, dest: string,
    stackErr: Error, tries: number,
    options?: ILinkFileOptions): PromiseBB<void> {
  return simfail(() => fsBB.linkAsync(src, dest))
    .catch((err: NodeJS.ErrnoException) =>
      errorHandler(err, stackErr, tries,
                  (options !== undefined) ? options.showDialogCallback : undefined)
        .then(() => linkInt(src, dest, stackErr, tries - 1, options)));
}

export function removeSync(dirPath: string) {
  fs.removeSync(dirPath);
}

export function unlinkAsync(filePath: string, options?: IRemoveFileOptions): PromiseBB<void> {
  return unlinkInt(filePath, new Error(), NUM_RETRIES, options || {});
}

function unlinkInt(filePath: string, stackErr: Error, tries: number,
                   options: IRemoveFileOptions): PromiseBB<void> {
  return simfail(() => fsBB.unlinkAsync(filePath))
    .catch((err: NodeJS.ErrnoException) => {
      const handle = () => errorHandler(err, stackErr, tries, options.showDialogCallback)
          .then(() => unlinkInt(filePath, stackErr, tries - 1, options));

      if (err.code === 'ENOENT') {
        // don't mind if a file we wanted deleted was already gone
        return PromiseBB.resolve();
      } else if (err.code === 'EPERM') {
        // this could be caused by the path actually pointing to a directory,
        // unlink can only handle files
        return fsBB.statAsync(filePath)
          .then((stats) => {
            if (stats.isDirectory()) {
              err.code = 'EISDIR';
            }
            return handle();
          })
          .catch(errInner => errInner instanceof UserCanceled
            ? Promise.reject(errInner)
            : handle());
      } else {
        return handle();
      }
    });
}

export function renameAsync(sourcePath: string, destinationPath: string): PromiseBB<void> {
  return renameInt(sourcePath, destinationPath, new Error(), NUM_RETRIES);
}

function renameInt(sourcePath: string, destinationPath: string,
                   stackErr: Error, tries: number): PromiseBB<void> {
  return simfail(() => PromiseBB.resolve(fs.rename(sourcePath, destinationPath)))
    .catch((err: NodeJS.ErrnoException) => {
      if ((tries > 0) && RETRY_ERRORS.has(err.code)) {
        return PromiseBB.delay((NUM_RETRIES - tries + 1) * RETRY_DELAY_MS)
          .then(() => renameInt(sourcePath, destinationPath, stackErr, tries - 1));
      }
      return (err.code === 'EPERM')
        ? PromiseBB.resolve(fs.stat(destinationPath))
          .then(stat => stat.isDirectory()
            ? PromiseBB.reject(restackErr(err, stackErr))
            : errorHandler(err, stackErr, tries)
              .then(() => renameInt(sourcePath, destinationPath, stackErr, tries - 1)))
          .catch(newErr => PromiseBB.reject(restackErr(newErr, stackErr)))
        : errorHandler(err, stackErr, tries)
          .then(() => renameInt(sourcePath, destinationPath, stackErr, tries - 1));
    });
}

export function rmdirAsync(dirPath: string): PromiseBB<void> {
  return rmdirInt(dirPath, new Error(), NUM_RETRIES);
}

function rmdirInt(dirPath: string, stackErr: Error, tries: number): PromiseBB<void> {
  return simfail(() => PromiseBB.resolve(fs.rmdir(dirPath)))
    .catch((err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        // don't mind if a file we wanted deleted was already gone
        return PromiseBB.resolve();
      } else if (RETRY_ERRORS.has(err.code) && (tries > 0)) {
          return PromiseBB.delay(RETRY_DELAY_MS)
            .then(() => rmdirInt(dirPath, stackErr, tries - 1));
      }
      throw restackErr(err, stackErr);
    });
}

export function removeAsync(remPath: string, options?: IRemoveFileOptions): PromiseBB<void> {
  const stackErr = new Error();
  return removeInt(remPath, stackErr, NUM_RETRIES, options || {});
}

function removeInt(remPath: string, stackErr: Error, tries: number,
                   options: IRemoveFileOptions): PromiseBB<void> {
  return simfail(() => rimrafAsync(remPath))
    .catch(err => errorHandler(err, stackErr, tries, options.showDialogCallback)
      .then(() => removeInt(remPath, stackErr, tries - 1, options)));
}

function rimrafAsync(remPath: string): PromiseBB<void> {
  return new PromiseBB((resolve, reject) => {
    // don't use the rimraf implementation of busy retries because it's f*cked:
    // https://github.com/isaacs/rimraf/issues/187
    rimraf(remPath, {
      maxBusyTries: 0,
    }, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export function readlinkAsync(linkPath: string): PromiseBB<string> {
  const stackErr = new Error();
  return readlinkInt(linkPath, stackErr, NUM_RETRIES);
}

function readlinkInt(linkPath: string, stackErr: Error, tries: number): PromiseBB<string> {
  return simfail(() => PromiseBB.resolve(fs.readlink(linkPath)))
    .catch(err => {
      if ((err.code === 'UNKNOWN') && (process.platform === 'win32')) {
        // on windows this return UNKNOWN if the file is not a link.
        // of course there could be a thousand other things returning UNKNOWN but we'll never
        // know, will we? libuv? will we?
        const newErr: any = new Error('Not a link');
        newErr.code = 'EINVAL';
        newErr.syscall = 'readlink';
        newErr.path = linkPath;
        return Promise.reject(newErr);
      } else if (err.code === 'EINVAL') {
        return Promise.reject(err);
      } else {
        return errorHandler(err, stackErr, tries)
          .then(() => readlinkInt(linkPath, stackErr, tries - 1));
      }
    });
}

function elevated(func: (ipc, req: NodeRequireFunction) => Promise<void>,
                  parameters: any): PromiseBB<void> {
  let server: net.Server;
  return new PromiseBB<void>((resolve, reject) => {
    const id = shortid();
    let resolved = false;

    const ipcPath = `__fs_elevated_${id}`;

    server = net.createServer(connRaw => {
      const conn = new JsonSocket(connRaw);

      conn
        .on('message', data => {
          if (data.error !== undefined) {
            log('error', 'elevated process failed', data.error);
          } else {
          log('warn', 'got unexpected ipc message', JSON.stringify(data));
          }
        })
        .on('end', () => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        })
        .on('error', err => {
          log('error', 'elevated code reported error', err);
          if (!resolved) {
            resolved = true;
            reject(err);
          }
        });
    })
    .listen(path.join('\\\\?\\pipe', ipcPath));
    runElevated(ipcPath, func, parameters)
      .catch(err => {
        if ((err.code === 5)
            || ((process.platform === 'win32') && (err.errno === 1223))) {
          // this code is returned when the user rejected the UAC dialog. Not currently
          // aware of another case
          reject(new UserCanceled());
        } else {
          reject(new Error(`OS error ${err.message} (${err.code})`));
        }
      });
  })
  .finally(() => {
    if (server !== undefined) {
      server.close();
    }
  });
}

export function ensureDirWritableAsync(dirPath: string,
                                       confirm?: () => PromiseBB<void>): PromiseBB<void> {
  if (confirm === undefined) {
    confirm = () => PromiseBB.resolve();
  }
  const stackErr = new Error();
  return PromiseBB.resolve(fs.ensureDir(dirPath))
    .then(() => {
      const canary = path.join(dirPath, '__vortex_canary');
      return ensureFileAsync(canary)
        .then(() => removeAsync(canary));
    })
    .catch(err => {
      // weirdly we get EBADF from ensureFile sometimes when the
      // directory isn't writeable instead of EPERM. More weirdly, this seems to happen
      // only on startup.
      if (['EPERM', 'EBADF', 'UNKNOWN'].indexOf(err.code) !== -1) {
        return PromiseBB.resolve(confirm())
          .then(() => {
            const userId = getUserId();
            return elevated((ipcPath, req: NodeRequire) => {
              // tslint:disable-next-line:no-shadowed-variable
              const fs = req('fs-extra');
              // tslint:disable-next-line:no-shadowed-variable
              const path = req('path');
              const { allow } = req('permissions');
              // recurse upwards in the directory tree if necessary
              const ensureAndAllow = (targetPath, allowRecurse) => {
                return fs.ensureDir(targetPath)
                .catch(elevatedErr => {
                  const parentPath = path.dirname(targetPath);
                  if (['EPERM', 'ENOENT'].includes(elevatedErr.code)
                      && (parentPath !== targetPath)
                      && allowRecurse) {
                    return ensureAndAllow(parentPath, true)
                      .then(() => ensureAndAllow(targetPath, false));
                  } else {
                    return Promise.reject(elevatedErr);
                  }
                })
                .then(() => {
                  try {
                    allow(targetPath, userId, 'rwx');
                    return Promise.resolve();
                  } catch (err) {
                    return Promise.reject(err);
                  }
                });
              };
              return ensureAndAllow(dirPath, true);
            }, { dirPath, userId })
            // if elevation fails, rethrow the original error, not the failure to elevate
            .catch(elevatedErr => {
              if (elevatedErr.message.indexOf('The operation was canceled by the user') !== -1) {
                return Promise.reject(new UserCanceled());
              }
              // if elevation failed, return the original error because the one from
              // elevate, while interesting as well, would make error handling too complicated
              log('error', 'failed to acquire permission', elevatedErr.message);

              return PromiseBB.reject(restackErr(err, stackErr));
            });
          });
      } else {
        return PromiseBB.reject(restackErr(err, stackErr));
      }
    });
}

export function changeFileOwnership(filePath: string, stat: fs.Stats): PromiseBB<void> {
  if (process.platform === 'win32') {
    // This is a *nix only function.
    return PromiseBB.resolve();
  }

  const readAndWriteOther = parseInt('0006', 8);
  if ((stat.mode & readAndWriteOther) === readAndWriteOther) {
    return PromiseBB.reject(new ProcessCanceled('Ownership change not required'));
  }

  const readAndWriteGroup = parseInt('0060', 8);
  const hasGroupPermissions = ((stat.mode & readAndWriteGroup) === readAndWriteGroup);

  // (Writing this down as it can get confusing) Cases where we need to change ownership are:
  //  <BaseOwnerCheck> - If the process real ID is different than the file's real ID.
  //
  //  1. If <BaseOwnerCheck> is true and the file does NOT have the group read/write bits set.
  //  2. If <BaseOwnerCheck> is true and the file DOES have the group read/write bits set but
  //   the process group id differs from the file's group id.
  //
  // Ask for forgiveness, not permission.
  return (stat.uid !== process.getuid())
    ? (!hasGroupPermissions) || (hasGroupPermissions && (stat.gid !== process.getgid()))
      ? PromiseBB.resolve(fs.chown(filePath, process.getuid(), stat.gid))
          .catch(err => PromiseBB.reject(err))
      : PromiseBB.resolve()
    : PromiseBB.resolve();
}

export function changeFileAttributes(filePath: string,
                                     wantedAttributes: number,
                                     stat: fs.Stats): PromiseBB<void> {
    return this.changeFileOwnership(filePath, stat)
      .then(() => {
        const finalAttributes = stat.mode | wantedAttributes;
        return PromiseBB.resolve(fs.chmod(filePath, finalAttributes));
    })
    .catch(ProcessCanceled, () => PromiseBB.resolve())
    .catch(err => PromiseBB.reject(err));
}

export function makeFileWritableAsync(filePath: string): PromiseBB<void> {
  const stackErr = new Error();
  const wantedAttributes = process.platform === 'win32' ? parseInt('0666', 8) : parseInt('0600', 8);
  return PromiseBB.resolve(fs.stat(filePath)).then(stat => {
    if (!stat.isFile()) {
      const err: NodeJS.ErrnoException =
        new Error(`Expected a file, found a directory: "${filePath}"`);
      err.code = 'EISDIR';
      err.path = filePath;
      err.syscall = 'stat';
      err.stack = stackErr.stack;
      return PromiseBB.reject(err);
    }

    return ((stat.mode & wantedAttributes) !== wantedAttributes)
      ? this.changeFileAttributes(filePath, wantedAttributes, stat)
      : PromiseBB.resolve();
  });
}

function raiseUACDialog<T>(t: TFunction,
                           err: any,
                           op: () => PromiseBB<T>,
                           filePath: string): PromiseBB<T> {
  let fileToAccess = filePath !== undefined ? filePath : err.path;
  const choice = dialog.showMessageBoxSync(getVisibleWindow(), {
      title: 'Access denied (2)',
      message: t('Vortex needs to access "{{ fileName }}" but doesn\'t have permission to.\n'
        + 'If your account has admin rights Vortex can unlock the file for you. '
        + 'Windows will show an UAC dialog.',
        { replace: { fileName: fileToAccess } }),
      buttons: [
        'Cancel',
        'Retry',
        'Give permission',
      ],
      noLink: true,
      type: 'warning',
    });
  if (choice === 1) { // Retry
    return forcePerm(t, op, filePath);
  } else if (choice === 2) { // Give Permission
    const userId = getUserId();
    return PromiseBB.resolve(fs.stat(fileToAccess))
      .catch((statErr) => {
        if (statErr.code === 'ENOENT') {
          fileToAccess = path.dirname(fileToAccess);
        }
        return PromiseBB.resolve();
      })
      .then(() => elevated((ipcPath, req: NodeRequire) => {
        // tslint:disable-next-line:no-shadowed-variable
        const { allow } = req('permissions');
        return allow(fileToAccess, userId, 'rwx');
      }, { fileToAccess, userId })
        .catch(elevatedErr => {
          if ((elevatedErr instanceof UserCanceled)
          || (elevatedErr.message.indexOf('The operation was canceled by the user') !== -1)) {
            return Promise.reject(new UserCanceled());
          }
          // if elevation failed, return the original error because the one from
          // elevate, while interesting as well, would make error handling too complicated
          log('error', 'failed to acquire permission', elevatedErr.message);
          return Promise.reject(err);
        }))
      .then(() => forcePerm(t, op, filePath));
  } else {
    return PromiseBB.reject(new UserCanceled());
  }
}

export function forcePerm<T>(t: TFunction,
                             op: () => PromiseBB<T>,
                             filePath?: string,
                             maxTries: number = 3): PromiseBB<T> {
  return op()
    .catch(err => {
      const fileToAccess = filePath !== undefined ? filePath : err.path;
      if ((['EPERM', 'EACCES'].indexOf(err.code) !== -1) || (err.errno === 5)) {
        const wantedAttributes = process.platform === 'win32'
          ? parseInt('0666', 8)
          : parseInt('0600', 8);
        return fs.stat(fileToAccess)
          .then(stat => this.changeFileAttributes(fileToAccess, wantedAttributes, stat))
          .then(() => op())
          .catch(innerErr => {
            if (innerErr instanceof UserCanceled) {
              return Promise.resolve(undefined);
            }
            return raiseUACDialog(t, err, op, filePath);
          });
      } else if (RETRY_ERRORS.has(err.code) && maxTries > 0) {
        return PromiseBB.delay(RETRY_DELAY_MS)
          .then(() => forcePerm(t, op, filePath, maxTries - 1));
      } else {
        return PromiseBB.reject(err);
      }
    });
}
