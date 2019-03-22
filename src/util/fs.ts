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

import { DataInvalid, ProcessCanceled, UserCanceled } from './CustomErrors';
import { log } from './log';

import * as PromiseBB from 'bluebird';
import { dialog as dialogIn, remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as I18next from 'i18next';
import * as ipc from 'node-ipc';
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

const NUM_RETRIES = 3;
const RETRY_DELAY_MS = 100;
const RETRY_ERRORS = new Set(['EPERM', 'EBUSY', 'UNKNOWN']);

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
  if (dialog === undefined) {
    return PromiseBB.resolve(false);
  }

  const processes = wholocks(filePath);

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

function busyRetry(filePath: string): PromiseBB<boolean> {
  if (dialog === undefined) {
    return PromiseBB.resolve(false);
  }

  const processes = wholocks(filePath);
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

function errorRepeat(error: NodeJS.ErrnoException, filePath: string): PromiseBB<boolean> {
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

function errorHandler(error: NodeJS.ErrnoException, stackErr: Error): PromiseBB<void> {
  return errorRepeat(error, (error as any).dest || error.path)
    .then(repeat => repeat
      ? PromiseBB.resolve()
      : PromiseBB.reject(restackErr(error, stackErr)))
    .catch(err => PromiseBB.reject(restackErr(err, stackErr)));
}

function genWrapperAsync<T extends (...args) => any>(func: T): T {
  const wrapper = (stackErr: Error, ...args) =>
    func(...args)
      .catch(err => errorHandler(err, stackErr)
        .then(() => wrapper(stackErr, ...args)));

  const res = (...args) => wrapper(new Error(), ...args);
  return res as T;
}

const chmodAsync = genWrapperAsync(fs.chmodAsync);
const closeAsync = genWrapperAsync(fs.closeAsync);
const fsyncAsync = genWrapperAsync(fs.fsyncAsync);
const linkAsync = genWrapperAsync(fs.linkAsync);
const lstatAsync = genWrapperAsync(fs.lstatAsync);
const mkdirAsync = genWrapperAsync(fs.mkdirAsync);
const mkdirsAsync = genWrapperAsync(fs.mkdirsAsync);
const moveAsync = genWrapperAsync(fs.moveAsync);
const openAsync = genWrapperAsync(fs.openAsync);
const readdirAsync = genWrapperAsync(fs.readdirAsync);
const readFileAsync = genWrapperAsync(fs.readFileAsync);
const readlinkAsync = genWrapperAsync(fs.readlinkAsync);
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
  linkAsync,
  lstatAsync,
  mkdirAsync,
  mkdirsAsync,
  moveAsync,
  openAsync,
  readlinkAsync,
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
  return (fs as any).ensureFileAsync(filePath);
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
                          options?: fs.CopyOptions & { noSelfCopy?: boolean }): PromiseBB<void> {
  const stackErr = new Error();
  // fs.copy in fs-extra has a bug where it doesn't correctly avoid copying files onto themselves
  const check = (options !== undefined) && options.noSelfCopy
    ? PromiseBB.resolve()
    : selfCopyCheck(src, dest);
  return check
    .then(() => copyInt(src, dest, options || undefined, stackErr))
    .catch(err => PromiseBB.reject(restackErr(err, stackErr)));
}

function copyInt(
    src: string, dest: string,
    options: fs.CopyOptions,
    stackErr: Error) {
  return fs.copyAsync(src, dest, options)
    .catch((err: NodeJS.ErrnoException) =>
      errorHandler(err, stackErr).then(() => copyInt(src, dest, options, stackErr)));
}

export function removeSync(dirPath: string) {
  fs.removeSync(dirPath);
}

export function unlinkAsync(dirPath: string): PromiseBB<void> {
  return unlinkInt(dirPath, new Error());
}

function unlinkInt(dirPath: string, stackErr: Error): PromiseBB<void> {
  return fs.unlinkAsync(dirPath)
    .catch((err: NodeJS.ErrnoException) => (err.code === 'ENOENT')
        // don't mind if a file we wanted deleted was already gone
        ? PromiseBB.resolve()
        : errorHandler(err, stackErr)
          .then(() => unlinkInt(dirPath, stackErr)));
}

export function renameAsync(sourcePath: string, destinationPath: string): PromiseBB<void> {
  return renameInt(sourcePath, destinationPath, new Error(), NUM_RETRIES);
}

function renameInt(sourcePath: string, destinationPath: string,
                   stackErr: Error, tries: number): PromiseBB<void> {
  return fs.renameAsync(sourcePath, destinationPath)
    .catch((err: NodeJS.ErrnoException) => {
      if ((tries > 0) && RETRY_ERRORS.has(err.code)) {
        return PromiseBB.delay(RETRY_DELAY_MS)
          .then(() => renameInt(sourcePath, destinationPath, stackErr, tries - 1));
      }
      return (err.code === 'EPERM')
        ? fs.statAsync(destinationPath)
          .then(stat => stat.isDirectory()
            ? PromiseBB.reject(restackErr(err, stackErr))
            : errorHandler(err, stackErr)
              .then(() => renameInt(sourcePath, destinationPath, stackErr, tries)))
          .catch(newErr => PromiseBB.reject(restackErr(newErr, stackErr)))
        : errorHandler(err, stackErr)
          .then(() => renameInt(sourcePath, destinationPath, stackErr, tries));
    });
}

export function rmdirAsync(dirPath: string): PromiseBB<void> {
  return rmdirInt(dirPath, new Error(), NUM_RETRIES);
}

function rmdirInt(dirPath: string, stackErr: Error, tries: number): PromiseBB<void> {
  return fs.rmdirAsync(dirPath)
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

export function removeAsync(remPath: string): PromiseBB<void> {
  const stackErr = new Error();
  return removeInt(remPath, stackErr);
}

function removeInt(remPath: string, stackErr: Error): PromiseBB<void> {
  return rimrafAsync(remPath)
    .catch(err => errorHandler(err, stackErr)
      .then(() => removeInt(remPath, stackErr)));
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

function elevated(func: (ipc, req: NodeRequireFunction) => Promise<void>,
                  parameters: any): PromiseBB<void> {
  return new PromiseBB<void>((resolve, reject) => {
    const ipcInst = new ipc.IPC();
    const id = shortid();
    let resolved = false;
    ipcInst.serve(`__fs_elevated_${id}`, () => {
      runElevated(`__fs_elevated_${id}`, func, parameters)
        .catch(err => {
          if ((err.code === 5)
              || ((process.platform === 'win32') && (err.errno === 1223))) {
            // this code is returned when the user rejected the UAC dialog. Not currently
            // aware of another case
            reject(new UserCanceled());
          } else {
            reject(new Error(`OS error ${err.message} (${err.code})`));
          }
        })
        .catch(err => {
          if (!resolved) {
            resolved = true;
            reject(err);
          }
        });
    });
    ipcInst.server.on('socket.disconnected', () => {
      ipcInst.server.stop();
      if (!resolved) {
        resolved = true;
        resolve();
      }
    });
    ipcInst.server.on('error', ipcErr => {
      if (!resolved) {
        resolved = true;
        reject(new Error(ipcErr));
      }
    });
    ipcInst.server.on('disconnect', () => {
      ipcInst.server.stop();
      if (!resolved) {
        resolved = true;
        resolve();
      }
    });
    ipcInst.server.start();
  });
}

export function ensureDirWritableAsync(dirPath: string,
                                       confirm: () => PromiseBB<void>): PromiseBB<void> {
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
            return elevated((ipcPath, req: NodeRequireFunction) => {
              // tslint:disable-next-line:no-shadowed-variable
              const fs = req('fs-extra-promise');
              const { allow } = req('permissions');
              return fs.ensureDirAsync(dirPath)
                .then(() => allow(dirPath, userId, 'rwx'));
            }, { dirPath, userId });
          });
      } else {
        return PromiseBB.reject(err);
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

export function ensureFileWritableAsync(filePath: string): PromiseBB<void> {
  const wantedAttributes = process.platform === 'win32' ? parseInt('0666', 8) : parseInt('0600', 8);
  return fs.statAsync(filePath).then(stat => {
    if (!stat.isFile()) {
      return PromiseBB.reject(new DataInvalid(`${filePath} - is not a file!`));
    }

    return ((stat.mode & wantedAttributes) !== wantedAttributes)
      ? this.changeFileAttributes(filePath, wantedAttributes, stat)
      : PromiseBB.resolve();
  });
}

export function forcePerm<T>(t: I18next.TranslationFunction,
                             op: () => PromiseBB<T>,
                             filePath?: string): PromiseBB<T> {
  const raiseUACDialog = (err): PromiseBB<T> => {
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
      return forcePerm(t, op);
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
        .then(() => forcePerm(t, op));
    } else {
      return PromiseBB.reject(new UserCanceled());
    }
  };

  return op()
    .catch(err => {
      const fileToAccess = filePath !== undefined ? filePath : err.path;
      if ((err.code === 'EPERM') || (err.errno === 5)) {
        const wantedAttributes = process.platform === 'win32'
          ? parseInt('0666', 8)
          : parseInt('0600', 8);
        return fs.statAsync(fileToAccess)
          .then(stat => this.changeFileAttributes(fileToAccess, wantedAttributes, stat))
          .then(() => op())
          .catch(() => raiseUACDialog(err))
          .catch(UserCanceled, () => undefined);
      } else {
        return PromiseBB.reject(err);
      }
    });
}
