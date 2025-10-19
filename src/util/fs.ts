/**
 * wrapper for the fs / fs-extra module
 * this allows us to customise the behaviour of fs function across the application,
 * In particular it handles certain user-interactions (file busy, permissions, ...) in a uniform
 * way.
 * The api should remain compatible with fs-extra, but extensions can be made
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
import lazyRequire from './lazyRequire';
import { log } from './log';
import { decodeSystemError } from './nativeErrors';
import { isWindows } from './platform';
import { restackErr, truthy } from './util';

// TODO: Remove Bluebird import - using native Promise;
import { decode } from 'iconv-lite';
import { dialog as dialogIn } from 'electron';
import * as fs from 'fs-extra';
import * as nodeFS from 'fs';
import JsonSocket from 'json-socket';
import * as _ from 'lodash';
import * as net from 'net';
import * as path from 'path';
import * as permissionT from 'permissions';
import rimraf from 'rimraf';
import { generate as shortid } from 'shortid';
import * as tmp from 'tmp';
import * as vortexRunT from 'vortex-run';
import * as whoLocksT from 'wholocks';

const permission: typeof permissionT = lazyRequire(() => require('permissions'));
const vortexRun: typeof vortexRunT = lazyRequire(() => require('vortex-run'));
const wholocks: typeof whoLocksT = lazyRequire(() => require('wholocks'));

const dialog = (process.type === 'renderer')
  // tslint:disable-next-line:no-var-requires
  ? require('@electron/remote').dialog
  : dialogIn;

export { constants, FSWatcher, Stats, WriteStream } from 'fs';

// simple re-export of functions we don't touch (yet)
export {
  accessSync,
  appendFileSync,
  closeSync,
  createReadStream,
  createWriteStream,
  linkSync,
  openSync,
  readdirSync,
  readFileSync,
  statSync,
  symlinkSync,
  watch,
  writeFileSync,
  writeSync,
} from 'original-fs';

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

let tFunction: TFunction = (input: string) => input;

export function setTFunction(tFunc: TFunction) {
  tFunction = tFunc;
}

const NUM_RETRIES = 5;
const RETRY_DELAY_MS = 100;
const RETRY_ERRORS = new Set(['EPERM', 'EBUSY', 'EIO', 'EBADF', 'ENOTEMPTY', 'EMFILE', 'UNKNOWN']);

const simfail = (process.env.SIMULATE_FS_ERRORS === 'true')
  ? (func: () => Promise<any>): Promise<any> => {
    if (Math.random() < 0.25) {
      const code = Math.random() < 0.33 ? 'EBUSY' : Math.random() < 0.5 ? 'EIO' : 'UNKNOWN';
      const res: any = new Error(`fake error ${code}`);
      if (code === 'UNKNOWN') {
        res['nativeCode'] = 21;
      }
      res.code = code;
      res.path = 'foobar file';
      return Promise.reject(res);
    } else {
      return func();
    }
  }
  : (func: () => Promise<any>) => func();

function nospcQuery(): Promise<boolean> {
  if (dialog === undefined) {
    return Promise.resolve(false);
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
    ? Promise.reject(new UserCanceled())
    : Promise.resolve(true);
}

function ioQuery(): Promise<boolean> {
  if (dialog === undefined) {
    return Promise.resolve(false);
  }

  const options: Electron.MessageBoxOptions = {
    title: 'I/O Error',
    message: 'Disk access failed repeatedly. '
           + 'If this is a removable disk (like a network or external drive), please ensure '
           + 'it\'s connected. Otherwise this may indicate filesystem corruption, you may '
           + 'want to run chkdsk or similar software to scan for problems.',
    buttons: ['Cancel', 'Retry'],
    type: 'warning',
    noLink: true,
  };

  const choice = dialog.showMessageBoxSync(getVisibleWindow(), options);
  return (choice === 0)
    ? Promise.reject(new UserCanceled())
    : Promise.resolve(true);
}

function unlockConfirm(filePath: string): Promise<boolean> {
  if ((dialog === undefined) || !truthy(filePath)) {
    return Promise.resolve(false);
  }

  let processes = [];
  try {
    processes = wholocks.default(filePath);
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
    ? Promise.reject(new UserCanceled())
    : Promise.resolve(choice === 2);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function unknownErrorRetry(filePath: string, err: Error, stackErr: Error): Promise<boolean> {
  if (dialog === undefined) {
    return Promise.resolve(false);
  }

  if (filePath === undefined) {
    // unfortunately these error message don't necessarily contain the filename
    filePath = '<filename unknown>';
  }

  const options: Electron.MessageBoxOptions = {
    title: 'Unknown error',
    message:
      `The operating system has reported an error without details when accessing "${filePath}" `
      + 'This is usually due the user\'s environment and not a bug in Vortex.\n'
      + 'Please diagnose your environment and then retry',
    type: 'warning',
    noLink: true,
  };

  if (![255, 362, 383, 388, 390, 395, 396, 404].includes(err['nativeCode'])) {
    options.detail = 'Possible error causes:\n'
      + `1. "${filePath}" is a removable, possibly network drive which has been disconnected.\n`
      + '2. An External application has interfered with file operations '
      + '(Anti-virus, Disk Management Utility, Virus)\n';
  }

  const decoded = decodeSystemError(err, filePath);
  if (decoded !== undefined) {
    options.title = decoded.title;
    options.message = tFunction(decoded.message, { replace: { filePath } });
  }

  if (decoded?.rethrowAs === undefined) {
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
    return Promise.reject(new UserCanceled());
  }

  switch (options.buttons[choice]) {
    case 'Retry': return Promise.resolve(true);
    case 'Ignore': {
      err['code'] = decoded?.rethrowAs ?? 'UNKNOWN';
      err['allowReport'] = false;
      return Promise.reject(err);
    }
  }

  return Promise.reject(new UserCanceled());
}

function busyRetry(filePath: string): Promise<boolean> {
  if (dialog === undefined) {
    return Promise.resolve(false);
  }

  if (filePath === undefined) {
    filePath = '<filename unknown>';
  }

  let processes = [];
  try {
    processes = wholocks.default(filePath);
  } catch (err) {
    log('warn', 'failed to determine list of processes locking file',
        { filePath, error: err.message });
  }

  const options: Electron.MessageBoxOptions = {
    title: 'File busy',
    message: `Vortex needs to access "${filePath}" but it\'s open in another application. `
      + 'Please close the file in all other applications and then retry.',
    detail: (processes.length > 0)
      ? 'Please close the following applications and retry:\n'
          + processes.map(proc => `${proc.appName} (${proc.pid})`).join('\n')
      : undefined,
    buttons: [
      'Cancel',
      'Retry',
    ],
    type: 'warning',
    noLink: true,
  };

  const choice = dialog.showMessageBoxSync(getVisibleWindow(), options);
  return (choice === 0)
    ? Promise.reject(new UserCanceled())
    : Promise.resolve(true);
}

function errorRepeat(error: NodeJS.ErrnoException, filePath: string, retries: number,
                     stackErr: Error, showDialogCallback?: () => boolean,
                     options?: IErrorHandlerOptions): Promise<boolean> {
  if ((retries > 0)
      && (RETRY_ERRORS.has(error.code)
          || ((options?.extraRetryErrors || []).includes(error.code)))) {
    // retry these errors without query for a few times
    return delay(retries === 1 ? 1000 : 100)
      .then(() => Promise.resolve(true));
  }
  if ((showDialogCallback !== undefined) && !showDialogCallback()) {
    return Promise.resolve(false);
  }
  // system error code 1224 means there is a user-mapped section open in the file
  if ((error.code === 'EBUSY')
      || (error['nativeCode'] === 1224)
      || ((error.code ===  'ENOTEMPTY') && options?.enotempty)) {
    return busyRetry(filePath);
  } else if (error.code === 'ENOSPC') {
    return nospcQuery();
  } else if (['EBADF', 'EIO'].includes(error.code)) {
    return ioQuery();
  } else if (error.code === 'EPERM') {
    let unlockPath = filePath;
    return Promise.resolve(fs.stat(unlockPath))
      .catch(statErr => {
        if (statErr.code === 'ENOENT') {
          unlockPath = path.dirname(filePath);
          return Promise.resolve();
        } else {
          return Promise.reject(statErr);
        }
      })
      .then(() => unlockConfirm(unlockPath))
      .then(doUnlock => {
        if (doUnlock) {
          const userId = permission.getUserId();
          return elevated((ipcPath, req: NodeRequire) => {
            return req('permissions').allow(unlockPath, userId as any, 'rwx');
          }, { unlockPath, userId })
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
          return Promise.resolve(true);
        }
      });
  } else if (error.code === 'UNKNOWN') {
    return unknownErrorRetry(filePath, error, stackErr);
  } else {
    return Promise.resolve(false);
  }
}

interface IErrorHandlerOptions {
  enotempty?: boolean;
  extraRetryErrors?: string[];
}

function augmentError(error: NodeJS.ErrnoException) {
  if (error.message === 'dest already exists.') {
    error.code = 'EEXIST';
  }
}

function errorHandler(error: NodeJS.ErrnoException,
                      stackErr: Error, tries: number,
                      showDialogCallback?: () => boolean,
                      options?: IErrorHandlerOptions): Promise<void> {
  augmentError(error);
  const repProm = errorRepeat(error, (error as any).dest || error.path, tries,
                              stackErr, showDialogCallback, options);

  // trying to narrow down #6404
  if (repProm === undefined) {
    const err = new Error(
      `Failed to handle filesystem error "${error.code}": ${error.message}.`);
    err.stack = error.stack;
    throw Promise.reject(err);
  }

  return repProm
    .then(repeat => repeat
      ? Promise.resolve()
      : Promise.reject(restackErr(error, stackErr)))
    .catch(err => Promise.reject(restackErr(err, stackErr)));
}

export function genFSWrapperAsync<T extends (...args) => any>(func: T) {
  const wrapper = (stackErr: Error, tries: number, ...args) =>
    simfail(() => Promise.resolve(func(...args)))
      .catch(err => errorHandler(err, stackErr, tries)
        .then(() => wrapper(stackErr, tries - 1, ...args)));

  const res = (...args) => {
    return wrapper(new Error(), NUM_RETRIES, ...args);
  };
  return res;
}

// tslint:disable:max-line-length
const chmodAsync: (path: string, mode: string | number) => Promise<void> = genFSWrapperAsync(fs.chmod);
const closeAsync: (fd: number) => Promise<void> = genFSWrapperAsync(fs.close);
const fsyncAsync: (fd: number) => Promise<void> = genFSWrapperAsync(fs.fsync);
const lstatAsync: (path: string) => Promise<fs.Stats> = genFSWrapperAsync(fs.lstat);
const mkdirAsync: (path: string) => Promise<void> = genFSWrapperAsync(fs.mkdir);
const mkdirsAsync: (path: string) => Promise<void> = genFSWrapperAsync(fs.mkdirs);
const moveAsync: (src: string, dest: string, options?: fs.MoveOptions) => Promise<void> = genFSWrapperAsync(fs.move);
const openAsync: (path: string, flags: string | number, mode?: number) => Promise<number> = genFSWrapperAsync(fs.open);
const readdirAsync: (path: string) => Promise<string[]> = genFSWrapperAsync(fs.readdir);
const readFileAsync: (...args: any[]) => Promise<any> = genFSWrapperAsync(fs.readFile);

/**
 * USAGE GUIDANCE:
 * 
 * Use statAsync() for most cases where you need file stats and want:
 * - Automatic retries on transient errors (EBUSY, EPERM, etc.)
 * - User-friendly error dialogs for permission issues
 * - Consistent error handling across the application
 * 
 * Use statSilentAsync() only when:
 * - You're checking file existence and expect failures (e.g., optional files)
 * - You're in a tight loop where retries would be counterproductive
 * - You need to handle errors in a very specific way
 * 
 * Consider migrating statSilentAsync() usage to statAsync() for better robustness,
 * unless the silent behavior is specifically required.
 */
const statAsync: (path: string) => Promise<fs.Stats> = genFSWrapperAsync(fs.stat);
const statSilentAsync: (path: string) => Promise<fs.Stats> = (statPath: string) => Promise.resolve(fs.stat(statPath));
const symlinkAsync: (srcpath: string, dstpath: string, type?: string) => Promise<void> = genFSWrapperAsync(fs.symlink);
const utimesAsync: (path: string, atime: number, mtime: number) => Promise<void> = genFSWrapperAsync(fs.utimes);
// fs.write and fs.read don't promisify correctly because it has two return values. fs-extra already works around this in their
// promisified api so no reason to reinvent the wheel (also we want the api to be compatible)
const writeAsync: <BufferT>(...args: any[]) => Promise<{ bytesWritten: number, buffer: BufferT }> = genFSWrapperAsync(fs.write) as any;
const readAsync: <BufferT>(...args: any[]) => Promise<{ bytesRead: number, buffer: BufferT }> = genFSWrapperAsync(fs.read) as any;
const writeFileAsync: (file: string, data: any, options?: fs.WriteFileOptions) => Promise<void> = genFSWrapperAsync(fs.writeFile);
const appendFileAsync: (file: string, data: any, options?: fs.WriteFileOptions) => Promise<void> = genFSWrapperAsync(fs.appendFile);
// tslint:enable:max-line-length

export {
  appendFileAsync,
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
  statSilentAsync,
  symlinkAsync,
  utimesAsync,
  writeAsync,
  writeFileAsync,
};

export function isDirectoryAsync(dirPath: string): Promise<boolean> {
  return Promise.resolve(fs.stat(dirPath))
    .then(stats => stats.isDirectory());
}

export function ensureDirSync(dirPath: string) {
  try {
    fs.ensureDirSync(dirPath);
  } catch (err) {
    throw restackErr(err, new Error());
  }
}

export function ensureFileAsync(filePath: string): Promise<void> {
  const stackErr = new Error();
  return Promise.resolve(fs.ensureFile(filePath))
    .catch(err => {
      throw restackErr(err, stackErr);
    });
}

export function ensureDirAsync(dirPath: string, onDirCreatedCB?:
  (created: string) => Promise<void>): Promise<void> {
  const stackErr = new Error();
  // If a onDirCreated callback is provided, we can't use fs-extra's
  //  implementation directly as there's no way for us to reliably determine
  //  whether the parent folder was empty. We're going to create the
  //  directories ourselves.
  return (!!onDirCreatedCB)
    ? ensureDir(dirPath, onDirCreatedCB)
    : ensureDirInt(dirPath, stackErr, NUM_RETRIES);
}

function ensureDirInt(dirPath: string, stackErr: Error, tries: number): Promise<void> {
  return Promise.resolve(fs.ensureDir(dirPath))
    .catch(err => {
      // ensureDir isn't supposed to cause EEXIST errors as far as I understood
      // it but on windows, when targeting a OneDrive path (and similar?)
      // it apparently still does
      if (err.code === 'EEXIST') {
        return Promise.resolve();
      }
      return simfail(() => errorHandler(err, stackErr, tries, undefined))
        .then(() => ensureDirInt(dirPath, stackErr, tries - 1));
    });
}

function ensureDir(targetDir: string, onDirCreatedCB: (created: string) => Promise<void>) {
  // Please note, onDirCreatedCB will be called for _each_ directory
  //  we create.
  const created: string[] = [];
  const mkdirRecursive = (dir: string) => Promise.resolve(fs.mkdir(dir))
    .then(() => {
      created.push(dir);
      return onDirCreatedCB(dir);
    })
    .catch(err => {
      if (err.code === 'EEXIST') {
        return Promise.resolve();
      } else {
        return (['ENOENT'].indexOf(err.code) !== -1)
          ? mkdirRecursive(path.dirname(dir))
            .then(() => Promise.resolve(fs.mkdir(dir)))
            .then(() => {
              created.push(dir);
              return onDirCreatedCB(dir);
            })
            .catch(err2 => (err2.code === 'EEXIST')
              ? Promise.resolve()
              : Promise.reject(err2))
          : Promise.reject(err);
      }
    });

  return mkdirRecursive(targetDir)
    .then(() => (created.indexOf(targetDir) !== -1)
      ? Promise.resolve(targetDir)
      : Promise.resolve(null));
}

function selfCopyCheck(src: string, dest: string) {
  return Promise.all([(fs.stat as any)(src, { bigint: true }),
    (fs.stat as any)(dest, { bigint: true })
      .catch(err => {
        return err.code === 'ENOENT'
          ? Promise.resolve({})
          : Promise.reject(err);
      }),
  ])
    .then((stats: fs.BigIntStats[]) => (stats[0].ino === stats[1].ino)
      ? Promise.reject(new Error(
        `Source "${src}" and destination "${dest}" are the same file (id "${stats[0].ino}").`))
      : Promise.resolve());
}

function nextName(input: string): string {
  const ext = path.extname(input);
  const base = path.basename(input, ext);
  const count = parseInt(path.extname(base).slice(1), 10) || 1;
  return path.join(path.dirname(input), `${base}.${count}${ext}`);
}

/**
 * move a file. If the destination exists, will generate a new name with an
 * increasing counter until an unused name is found
 */
export function moveRenameAsync(src: string, dest: string): Promise<string> {
  return moveAsync(src, dest, { overwrite: false })
    .then(() => dest)
    .catch(err => { if (err.code === 'EEXIST') { return moveRenameAsync(src, nextName(dest)); } else { return Promise.reject(err); }});
}

/**
 * copy file
 * The copy function from fs-extra doesn't (at the time of writing) correctly check that a file
 * isn't copied onto itself (it fails for links or potentially on case insensitive disks),
 * so this makes a check based on the ino number.
 * A bug in older versions of node.js made it necessary this check be optional but that is
 * resolved now so the check should always be enabled.
 * @param src file to copy
 * @param dest destination path
 * @param options copy options (see documentation for fs)
 */
export function copyAsync(src: string, dest: string,
                          options?: fs.CopyOptions & {
                            noSelfCopy?: boolean,
                            showDialogCallback?: () => boolean }): Promise<void> {
  const stackErr = new Error();
  // fs.copy in fs-extra has a bug where it doesn't correctly avoid copying files onto themselves
  const check = (options !== undefined) && options.noSelfCopy
    ? Promise.resolve()
    : selfCopyCheck(src, dest);
  return check
    .then(() => copyInt(src, dest, options || undefined, stackErr, NUM_RETRIES))
    .catch(err => Promise.reject(restackErr(err, stackErr)));
}

type CopyOptionsEx = fs.CopyOptions & {
  noSelfCopy?: boolean,
  showDialogCallback?: () => boolean,
};

function copyFileCloneFallback(
  src: string,
  dest: string,
  options: CopyOptionsEx,
): Promise<void> {
  if (process.platform !== 'darwin') {
    return Promise.resolve(fs.copy(src, dest, options));
  }
  return Promise.resolve(fs.stat(src))
    .then(stat => {
      if (!stat.isFile()) {
        return Promise.resolve(fs.copy(src, dest, options));
      }
      const overwrite = (options?.overwrite !== undefined) ? options.overwrite : true;
      const ensureNotExists = overwrite
        ? Promise.resolve()
        : Promise.resolve(fs.pathExists(dest))
            .then(exists => {
              if (exists) {
                const err: any = new Error('destination exists');
                err.code = 'EEXIST';
                throw err;
              }
            });
      return ensureNotExists
        .then(() => nodeFS.promises.copyFile(
          src,
          dest,
          ((nodeFS.constants as any)?.COPYFILE_FICLONE ?? 0) as number,
        ))
        .then(() => undefined)
        .catch((err: any) => {
          // If clone is not supported (different FS, not APFS, etc.), fallback to normal copy
          if ([ 'ENOSYS', 'ENOTSUP', 'EXDEV', 'EINVAL' ].includes(err.code)) {
            return Promise.resolve(fs.copy(src, dest, options));
          }
          throw err;
        }) as any;
    });
}

function copyInt(
  src: string,
  dest: string,
  options: CopyOptionsEx,
  stackErr: Error,
  tries: number) {
  return simfail(() => (process.platform === 'darwin'
      ? copyFileCloneFallback(src, dest, options)
      : Promise.resolve(fs.copy(src, dest, options))))
    .catch((err: NodeJS.ErrnoException) =>
      errorHandler(err, stackErr, tries, options?.showDialogCallback,
                   { extraRetryErrors: ['EEXIST'] })
        .then(() => copyInt(src, dest, options, stackErr, tries - 1)));
}

export function linkAsync(
  src: string, dest: string,
  options?: ILinkFileOptions): Promise<void> {
  const stackErr = new Error();
  return linkInt(src, dest, stackErr, NUM_RETRIES, options)
    .catch(err => Promise.reject(restackErr(err, stackErr)));
}

function linkInt(
  src: string, dest: string,
  stackErr: Error, tries: number,
  options?: ILinkFileOptions): Promise<void> {
  return simfail(() => Promise.resolve(fs.link(src, dest)))
    .catch((err: NodeJS.ErrnoException) =>
      errorHandler(err, stackErr, tries,
                   (options !== undefined) ? options.showDialogCallback : undefined)
        .then(() => linkInt(src, dest, stackErr, tries - 1, options)));
}

export function removeSync(dirPath: string) {
  fs.removeSync(dirPath);
}

export function unlinkAsync(filePath: string, options?: IRemoveFileOptions): Promise<void> {
  return unlinkInt(filePath, new Error(), NUM_RETRIES, options || {});
}

function unlinkInt(filePath: string, stackErr: Error, tries: number,
                   options: IRemoveFileOptions): Promise<void> {
  return simfail(() => Promise.resolve(fs.unlink(filePath)))
    .catch((err: NodeJS.ErrnoException) => {
      const handle = () => errorHandler(err, stackErr, tries, options.showDialogCallback)
        .then(() => unlinkInt(filePath, stackErr, tries - 1, options));

      if (err.code === 'ENOENT') {
        // don't mind if a file we wanted deleted was already gone
        return Promise.resolve();
      } else if (err.code === 'EPERM') {
        // this could be caused by the path actually pointing to a directory,
        // unlink can only handle files
        return Promise.resolve(fs.stat(filePath))
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

export function renameAsync(sourcePath: string, destinationPath: string): Promise<void> {
  return renameInt(sourcePath, destinationPath, new Error(), NUM_RETRIES);
}

function renameInt(sourcePath: string, destinationPath: string,
                   stackErr: Error, tries: number): Promise<void> {
  return simfail(() => Promise.resolve(fs.rename(sourcePath, destinationPath)))
    .catch((err: NodeJS.ErrnoException) => {
      if ((tries > 0) && RETRY_ERRORS.has(err.code)) {
        return delay((NUM_RETRIES - tries + 1) * RETRY_DELAY_MS)
          .then(() => renameInt(sourcePath, destinationPath, stackErr, tries - 1));
      }
      return (err.code === 'EPERM')
        ? Promise.resolve(fs.stat(destinationPath))
          .then(stat => stat.isDirectory()
            ? Promise.reject(restackErr(err, stackErr))
            : errorHandler(err, stackErr, tries)
              .then(() => renameInt(sourcePath, destinationPath, stackErr, tries - 1)))
          .catch(newErr => Promise.reject(restackErr(newErr, stackErr)))
        : errorHandler(err, stackErr, tries)
          .then(() => renameInt(sourcePath, destinationPath, stackErr, tries - 1));
    });
}

export function rmdirAsync(dirPath: string): Promise<void> {
  return rmdirInt(dirPath, new Error(), NUM_RETRIES);
}

function rmdirInt(dirPath: string, stackErr: Error, tries: number): Promise<void> {
  return simfail(() => Promise.resolve(fs.rmdir(dirPath)))
    .catch((err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        // don't mind if a file we wanted deleted was already gone
        return Promise.resolve();
      } else if (RETRY_ERRORS.has(err.code) && (tries > 0)) {
        return delay(RETRY_DELAY_MS)
          .then(() => rmdirInt(dirPath, stackErr, tries - 1));
      }
      throw restackErr(err, stackErr);
    });
}

export function removeAsync(remPath: string, options?: IRemoveFileOptions): Promise<void> {
  const stackErr = new Error();
  return removeInt(remPath, stackErr, NUM_RETRIES, options || {});
}

function removeInt(remPath: string, stackErr: Error, tries: number,
                   options: IRemoveFileOptions): Promise<void> {
  return simfail(() => rimrafAsync(remPath))
    .catch(err => errorHandler(err, stackErr, tries, options.showDialogCallback,
                               { enotempty: true })
      .then(() => removeInt(remPath, stackErr, tries - 1, options)));
}

function rimrafAsync(remPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
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

export function readlinkAsync(linkPath: string): Promise<string> {
  const stackErr = new Error();
  return readlinkInt(linkPath, stackErr, NUM_RETRIES);
}

function readlinkInt(linkPath: string, stackErr: Error, tries: number): Promise<string> {
  return simfail(() => Promise.resolve(fs.readlink(linkPath)))
    .catch(err => {
      if ((err.code === 'UNKNOWN') && isWindows()) {
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
                  parameters: any): Promise<void> {
  let server: net.Server;
  return new Promise<void>((resolve, reject) => {
    const id = shortid();
    let resolved = false;

    const ipcPath = `__fs_elevated_${id}`;

    server = net.createServer(connRaw => {
      const conn = new JsonSocket(connRaw);

      conn
        .on('message', data => {
          if (data.error !== undefined) {
            if (data.error.startsWith('InvalidScriptError')) {
              reject(new Error(data.error));
            } else {
              log('error', 'elevated process failed', data.error);
            }
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
    vortexRun.runElevated(ipcPath, func, parameters)
      .catch(err => {
        if ((err.code === 5)
            || (isWindows() && (err.systemCode === 1223))) {
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
                                       confirm?: () => PromiseLike<void>): Promise<void> {
  if (confirm === undefined) {
    confirm = () => Promise.resolve();
  }
  const stackErr = new Error();
  return Promise.resolve(fs.ensureDir(dirPath))
    .then(() => {
      const canary = path.join(dirPath, '__vortex_canary');
      return ensureFileAsync(canary)
        .then(() => removeAsync(canary));
    })
    .catch(err => {
      // weirdly we get EBADF from ensureFile sometimes when the
      // directory isn't writeable instead of EPERM. More weirdly, this seems to happen
      // only on startup.
      // Additionally, users may occasionally get EEXIST (OneDrive specific?)
      //  as far as I understand fs-extra that is not supposed to happen! but I suppose
      //  it doesn't hurt to add some code to handle that use case.
      //  https://github.com/Nexus-Mods/Vortex/issues/6856
      if (['EPERM', 'EBADF', 'UNKNOWN', 'EEXIST', 'EROFS'].indexOf(err.code) !== -1) {
        return Promise.resolve(confirm())
          .then(() => {
            const userId = permission.getUserId();
            return elevated((ipcPath, req: NodeRequire) => {
              // tslint:disable-next-line:no-shadowed-variable
              const fs = req('fs-extra');
              // tslint:disable-next-line:no-shadowed-variable
              const path = req('path');
              const { allow } = req('permissions');
              const allowDir = (targetPath) => {
                try {
                  allow(targetPath, userId, 'rwx');
                  return Promise.resolve();
                } catch (err) {
                  return Promise.reject(err);
                }
              };
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
                    } else if (elevatedErr.code === 'EEXIST') {
                    // Directory already exists - that's fine.
                    //  Theoretically fs.ensureDir shouldn't be throwing EEXIST
                    //  errors, but we've seen this happen on multiple occassions.
                      return Promise.resolve();
                    } else {
                      return Promise.reject(elevatedErr);
                    }
                  })
                  .then(() => allowDir(targetPath));
              };
              return ensureAndAllow(dirPath, true);
            }, { dirPath, userId })
            // if elevation fails, rethrow the original error, not the failure to elevate
              .catch(elevatedErr => {
                if (elevatedErr.message.indexOf('The operation was canceled by the user') !== -1) {
                  return Promise.reject(new UserCanceled());
                }
              // if elevation failed, return the original error because the one from
              // elevate - while interesting as well - would make error handling too complicated
                log('error', 'failed to acquire permission', elevatedErr.message);

                return Promise.reject(restackErr(err, stackErr));
              });
          });
      } else {
        return Promise.reject(restackErr(err, stackErr));
      }
    });
}

export function changeFileOwnership(filePath: string, stat: fs.Stats): Promise<void> {
  if (isWindows()) {
    // This is a *nix only function.
    return Promise.resolve();
  }

  const readAndWriteOther = parseInt('0006', 8);
  if ((stat.mode & readAndWriteOther) === readAndWriteOther) {
    return Promise.reject(new ProcessCanceled('Ownership change not required'));
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
      ? Promise.resolve(fs.chown(filePath, process.getuid(), stat.gid))
        .catch(err => Promise.reject(err))
      : Promise.resolve()
    : Promise.resolve();
}

export function changeFileAttributes(filePath: string,
                                     wantedAttributes: number,
                                     stat: fs.Stats): Promise<void> {
  return this.changeFileOwnership(filePath, stat)
    .then(() => {
      const finalAttributes = stat.mode | wantedAttributes;
      return Promise.resolve(fs.chmod(filePath, finalAttributes));
    })
    .catch(err => { if (err instanceof ProcessCanceled) { return Promise.resolve(); } else { return Promise.reject(err); }})
    .catch(err => Promise.reject(err));
}

export function makeFileWritableAsync(filePath: string): Promise<void> {
  const stackErr = new Error();
  const wantedAttributes = isWindows() ? parseInt('0666', 8) : parseInt('0600', 8);
  return Promise.resolve(fs.stat(filePath)).then(stat => {
    if (!stat.isFile()) {
      const err: NodeJS.ErrnoException =
        new Error(`Expected a file, found a directory: "${filePath}"`);
      err.code = 'EISDIR';
      err.path = filePath;
      err.syscall = 'stat';
      err.stack = stackErr.stack;
      return Promise.reject(err);
    }

    return ((stat.mode & wantedAttributes) !== wantedAttributes)
      ? this.changeFileAttributes(filePath, wantedAttributes, stat)
      : Promise.resolve();
  });
}

function raiseUACDialog<T>(t: TFunction,
                           err: any,
                           op: () => Promise<T>,
                           filePath: string): Promise<T> {
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
    const userId = permission.getUserId();
    return Promise.resolve(fs.stat(fileToAccess))
      .catch((statErr) => {
        if (statErr.code === 'ENOENT') {
          fileToAccess = path.dirname(fileToAccess);
        }
        return Promise.resolve();
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
    return Promise.reject(new UserCanceled());
  }
}

export function forcePerm<T>(t: TFunction,
                             op: () => Promise<T>,
                             filePath?: string,
                             maxTries: number = 3): Promise<T> {
  return op()
    .catch(err => {
      const fileToAccess = filePath !== undefined ? filePath : err.path;
      if ((['EPERM', 'EACCES'].indexOf(err.code) !== -1) || (err.systemCode === 5)) {
        const wantedAttributes = isWindows()
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
        return delay(RETRY_DELAY_MS)
          .then(() => forcePerm(t, op, filePath, maxTries - 1));
      } else {
        return Promise.reject(err);
      }
    });
}

export function withTmpDirImpl<T>(cb: (tmpPath: string) => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    tmp.dir({ unsafeCleanup: true }, (err, tmpPath, cleanup) => {
      if (err !== null) {
        return reject(err);
      } else {
        cb(tmpPath)
          .then((out: T) => {
            resolve(out);
          })
          .catch(tmpErr => {
            reject(tmpErr);
          })
          .finally(() => {
            try {
              cleanup();
            } catch (err) {
              // cleanup failed
              log('warn', 'Failed to clean up temporary directory', { tmpPath });
            }
          });
      }
    });
  });
}

export interface ITmpOptions {
  cleanup?: boolean;
}

function withTmpFileImpl<T>(cb: (fd: number, name: string) => Promise<T>,
                            options?: ITmpOptions & tmp.FileOptions): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    tmp.file(_.omit(options ?? {}, ['cleanup']), (err, name, fd, cleanup) => {
      if (err !== null) {
        return reject(err);
      } else {
        cb(fd, name)
          .then(resolve)
          .catch(reject)
          .finally(() => {
            if (options?.cleanup !== false) {
              try {
                cleanup();
              } catch (err) {
                log('warn', 'Failed to clean up temporary file', { name });
              }
            }
          });
      }
    });
  });
}

const withTmpDir = genFSWrapperAsync(withTmpDirImpl);
const withTmpFile = genFSWrapperAsync(withTmpFileImpl);

export {
  withTmpDir,
  withTmpFile,
};

const KNOWN_BOMS: Array<{ bom: Buffer, enc: string }> = [
  { bom: Buffer.from([0xEF, 0xBB, 0xBF]), enc: 'utf8' },
  { bom: Buffer.from([0x00, 0x00, 0xFE, 0xFF]), enc: 'utf32-be' },
  { bom: Buffer.from([0xFF, 0xFE, 0x00, 0x00]), enc: 'utf32-le' },
  { bom: Buffer.from([0xFE, 0xFF]), enc: 'utf16be' },
  { bom: Buffer.from([0xFF, 0xFE]), enc: 'utf16le' },
];

export function encodingFromBOM(buf: Buffer): { encoding: string, length: number } {
  const bom = KNOWN_BOMS.find(b =>
    (b.bom.length < buf.length) && (b.bom.compare(buf, 0, b.bom.length) === 0));

  if (bom !== undefined) {
    return { encoding: bom.enc, length: bom.bom.length };
  }
  return undefined;
}

/**
 * read file, using the BOM to determine the encoding
 * @param filePath the file to read
 * @param fallbackEncoding the encoding to use if there is no BOM. Expects one of the iconv-constants,
 *                         which seem to be a super-set of the regular node buffer encodings
 * @returns decoded file encoding
 */
export function readFileBOM(filePath: string, fallbackEncoding: string): Promise<string> {
  return Promise.resolve(readFileAsync(filePath))
    .then((buffer: Buffer) => {
      // iconv-lite has its own BOM handling but it's weird because you apparently
      // still have to specify utf-8/utf-16/utf-32 - it just detects the endianness
      const detectedEnc = encodingFromBOM(buffer);
      if (detectedEnc === undefined) {
        // no bom
        return decode(buffer, fallbackEncoding ?? 'utf8');
      } else {
        return decode(buffer.slice(detectedEnc.length), detectedEnc?.encoding ?? fallbackEncoding);
      }
    });
}
