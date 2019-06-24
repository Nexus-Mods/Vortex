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
import { log } from './log';
import { truthy } from './util';

import * as PromiseBB from 'bluebird';
import { dialog as dialogIn, remote } from 'electron';
import * as fs from 'fs-extra-promise';
import I18next from 'i18next';
import * as JsonSocket from 'json-socket';
import * as net from 'net';
import * as path from 'path';
import { allow as allowT, getUserId } from 'permissions';
import * as rimraf from 'rimraf';
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
  readJSONSync,
  statSync,
  symlinkSync,
  watch,
  writeFileSync,
  writeSync,
} from 'fs-extra-promise';

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
const RETRY_ERRORS = new Set(['EPERM', 'EBUSY', 'EIO', 'EBADF', 'UNKNOWN']);

const simfail = (process.env.SIMULATE_FS_ERRORS === 'true')
  ? (func: () => PromiseBB<any>): PromiseBB<any> => {
    if (Math.random() < 0.25) {
      let code = Math.random() < 0.33 ? 'EBUSY' : Math.random() < 0.5 ? 'EIO' : 'UNKNOWN';
      let res: any = new Error(`fake error ${code}`);
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

  const choice = dialog.showMessageBox(
    remote !== undefined ? remote.getCurrentWindow() : null,
    options);
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

  const choice = dialog.showMessageBox(
    remote !== undefined ? remote.getCurrentWindow() : null,
    options);
  return (choice === 0)
    ? PromiseBB.reject(new UserCanceled())
    : PromiseBB.resolve(choice === 2);
}

function unknownErrorRetry(filePath: string): PromiseBB<boolean> {
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
      + '2. An External application has interferred with file operations'
      + '(Anti-virus, Disk Management Utility, Virus)\n',
    buttons: [
      'Cancel',
      'Retry',
    ],
    type: 'warning',
    noLink: true,
  };

  const choice = dialog.showMessageBox(
    remote !== undefined ? remote.getCurrentWindow() : null,
    options);
  return (choice === 0)
    ? PromiseBB.reject(new UserCanceled())
    : PromiseBB.resolve(true);
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

  const choice = dialog.showMessageBox(
    remote !== undefined ? remote.getCurrentWindow() : null,
    options);
  return (choice === 0)
    ? PromiseBB.reject(new UserCanceled())
    : PromiseBB.resolve(true);
}

function errorRepeat(error: NodeJS.ErrnoException, filePath: string, retries: number,
                     showDialogCallback?: () => boolean): PromiseBB<boolean> {
  if ((retries > 0) && RETRY_ERRORS.has(error.code)) {
    // retry these errors without query for a few times
    return PromiseBB.delay(100).then(() => PromiseBB.resolve(true));
  }
  if ((showDialogCallback !== undefined) && !showDialogCallback()) {
    return PromiseBB.resolve(false);
  }
  if (error.code === 'EBUSY') {
    return busyRetry(filePath);
  } else if (error.code === 'ENOSPC') {
    return nospcQuery();
  } else if (error.code === 'EPERM') {
    return unlockConfirm(filePath)
      .then(doUnlock => {
        if (doUnlock) {
          const userId = getUserId();
          return elevated((ipcPath, req: NodeRequireFunction) => {
            const { allow }: { allow: typeof allowT } = req('permissions');
            return allow(filePath, userId as any, 'rwx');
          }, { filePath, userId })
            .then(() => true)
            .catch(elevatedErr => {
              if (elevatedErr.message.indexOf('The operation was canceled by the user') !== -1) {
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
    return unknownErrorRetry(filePath);
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

  return errorRepeat(error, (error as any).dest || error.path, tries, showDialogCallback)
    .then(repeat => repeat
      ? PromiseBB.resolve()
      : PromiseBB.reject(restackErr(error, stackErr)))
    .catch(err => PromiseBB.reject(restackErr(err, stackErr)));
}

function genWrapperAsync<T extends (...args) => any>(func: T): T {
  const wrapper = (stackErr: Error, tries: number, ...args) =>
    simfail(() => func(...args))
      .catch(err => errorHandler(err, stackErr, tries)
        .then(() => wrapper(stackErr, tries - 1, ...args)));

  const res = (...args) => {
    return wrapper(new Error(), NUM_RETRIES, ...args);
  };
  return res as T;
}

const chmodAsync = genWrapperAsync(fs.chmodAsync);
const closeAsync = genWrapperAsync(fs.closeAsync);
const fsyncAsync = genWrapperAsync(fs.fsyncAsync);
const lstatAsync = genWrapperAsync(fs.lstatAsync);
const mkdirAsync = genWrapperAsync(fs.mkdirAsync);
const mkdirsAsync = genWrapperAsync(fs.mkdirsAsync);
const moveAsync = genWrapperAsync(fs.moveAsync);
const openAsync = genWrapperAsync(fs.openAsync);
const readdirAsync = genWrapperAsync(fs.readdirAsync);
const readFileAsync = genWrapperAsync(fs.readFileAsync);
const statAsync = genWrapperAsync(fs.statAsync);
const symlinkAsync = genWrapperAsync(fs.symlinkAsync);
const utimesAsync = genWrapperAsync(fs.utimesAsync);
const writeAsync = genWrapperAsync(fs.writeAsync);
const writeFileAsync = genWrapperAsync(fs.writeFileAsync);
const isDirectoryAsync = genWrapperAsync(fs.isDirectoryAsync);

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
  readFileAsync,
  statAsync,
  symlinkAsync,
  utimesAsync,
  writeAsync,
  writeFileAsync,
  isDirectoryAsync,
};

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
  return fs.ensureDirAsync(dirPath)
    .catch(err => {
      // ensureDir isn't supposed to cause EEXIST errors as far as I understood
      // it but on windows, when targeting a OneDrive path (and similar?)
      // it apparently still does
      if (err.code === 'EEXIST') {
        return PromiseBB.resolve();
      }
      return PromiseBB.reject(restackErr(err, stackErr));
    });
}

function selfCopyCheck(src: string, dest: string) {
  return PromiseBB.join(fs.statAsync(src), fs.statAsync(dest)
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
                          options?: fs.CopyOptions & { noSelfCopy?: boolean,
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
  return simfail(() => fs.copyAsync(src, dest, options))
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
  return simfail(() => fs.linkAsync(src, dest))
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
  return simfail(() => fs.unlinkAsync(filePath))
    .catch((err: NodeJS.ErrnoException) => {
      const handle = () => errorHandler(err, stackErr, tries, options.showDialogCallback)
          .then(() => unlinkInt(filePath, stackErr, tries - 1, options));

      if (err.code === 'ENOENT') {
        // don't mind if a file we wanted deleted was already gone
        return PromiseBB.resolve();
      } else if (err.code === 'EPERM') {
        // this could be caused by the path actually pointing to a directory,
        // unlink can only handle files
        return fs.statAsync(filePath)
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
  return simfail(() => fs.renameAsync(sourcePath, destinationPath))
    .catch((err: NodeJS.ErrnoException) => {
      if ((tries > 0) && RETRY_ERRORS.has(err.code)) {
        return PromiseBB.delay((NUM_RETRIES - tries + 1) * RETRY_DELAY_MS)
          .then(() => renameInt(sourcePath, destinationPath, stackErr, tries - 1));
      }
      return (err.code === 'EPERM')
        ? fs.statAsync(destinationPath)
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
  return simfail(() => fs.rmdirAsync(dirPath))
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
  return simfail(() => fs.readlinkAsync(linkPath))
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
          log('warn', 'got unexpected ipc message', JSON.stringify(data));
        })
        .on('end', () => {
          if (!resolved) {
            resolved = true;
            resolve(null);
          }
        })
        .on('error', err => {
          log('error', 'elevated code reported error', err);
          if (!resolved) {
            resolved = true;
            resolve(err);
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
                                       confirm: () => PromiseBB<void>): PromiseBB<void> {
  const stackErr = new Error();
  return fs.ensureDirAsync(dirPath)
    .then(() => {
      const canary = path.join(dirPath, '__vortex_canary');
      return (fs as any).ensureFileAsync(canary)
                    .then(() => fs.removeAsync(canary));
    })
    .catch(err => {
      // weirdly we get EBADF from ensureFile sometimes when the
      // directory isn't writeable instead of EPERM. More weirdly, this seems to happen
      // only on startup.
      if (['EPERM', 'EBADF', 'UNKNOWN'].indexOf(err.code) !== -1) {
        return confirm()
          .then(() => {
            const userId = getUserId();
            return elevated((ipcPath, req: NodeRequireFunction) => {
              // tslint:disable-next-line:no-shadowed-variable
              const fs = req('fs-extra-promise');
              const { allow } = req('permissions');
              return fs.ensureDirAsync(dirPath)
                .then(() => allow(dirPath, userId, 'rwx'));
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
      ? fs.chownAsync(filePath, process.getuid(), stat.gid).catch(err => PromiseBB.reject(err))
      : PromiseBB.resolve()
    : PromiseBB.resolve();
}

export function changeFileAttributes(filePath: string,
                                     wantedAttributes: number,
                                     stat: fs.Stats): PromiseBB<void> {
    return this.changeFileOwnership(filePath, stat)
      .then(() => {
        const finalAttributes = stat.mode | wantedAttributes;
        return fs.chmodAsync(filePath, finalAttributes);
    })
    .catch(ProcessCanceled, () => PromiseBB.resolve())
    .catch(err => PromiseBB.reject(err));
}

export function makeFileWritableAsync(filePath: string): PromiseBB<void> {
  const stackErr = new Error();
  const wantedAttributes = process.platform === 'win32' ? parseInt('0666', 8) : parseInt('0600', 8);
  return fs.statAsync(filePath).then(stat => {
    if (!stat.isFile()) {
      const err: NodeJS.ErrnoException = new Error(`Expected a file, found a directory: "${filePath}"`);
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

function raiseUACDialog<T>(t: I18next.TFunction,
                           err: any,
                           op: () => PromiseBB<T>,
                           filePath: string): PromiseBB<T> {
  let fileToAccess = filePath !== undefined ? filePath : err.path;
  const choice = dialog.showMessageBox(
    remote !== undefined ? remote.getCurrentWindow() : null, {
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
    return fs.statAsync(fileToAccess)
      .catch((statErr) => {
        if (statErr.code === 'ENOENT') {
          fileToAccess = path.dirname(fileToAccess);
        }
        return PromiseBB.resolve();
      })
      .then(() => elevated((ipcPath, req: NodeRequireFunction) => {
        // tslint:disable-next-line:no-shadowed-variable
        const { allow } = req('permissions');
        return allow(fileToAccess, userId, 'rwx');
      }, { fileToAccess, userId })
        .catch(elevatedErr => {
          if (elevatedErr.message.indexOf('The operation was canceled by the user') !== -1) {
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
};

export function forcePerm<T>(t: I18next.TFunction,
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
        return fs.statAsync(fileToAccess)
          .then(stat => this.changeFileAttributes(fileToAccess, wantedAttributes, stat))
          .then(() => op())
          .catch(() => raiseUACDialog(t, err, op, filePath))
          .catch(UserCanceled, () => undefined);
      } else if (RETRY_ERRORS.has(err.code) && maxTries > 0) {
        return PromiseBB.delay(RETRY_DELAY_MS)
          .then(() => forcePerm(t, op, filePath, maxTries - 1));
      } else {
        return PromiseBB.reject(err);
      }
    });
}
