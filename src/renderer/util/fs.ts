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

import type * as permissionT from "permissions";
import type * as vortexRunT from "vortex-run";
import type * as whoLocksT from "wholocks";

import {
  getErrorCode,
  getErrorMessageOrDefault,
  isErrorWithSystemCode,
} from "@vortex/shared";
import PromiseBB from "bluebird";
import { dialog as dialogIn } from "electron";
import * as fs from "fs-extra";
import { decode } from "iconv-lite";
import JsonSocket from "json-socket";
import * as _ from "lodash";
import * as net from "net";
import * as path from "path";
import rimraf from "rimraf";
import { generate as shortid } from "shortid";
import * as tmp from "tmp";

import type { TFunction } from "./i18n";

import {
  ProcessCanceled,
  SelfCopyCheckError,
  UserCanceled,
} from "./CustomErrors";
import { createErrorReport, getVisibleWindow } from "./errorHandling";
import lazyRequire from "./lazyRequire";
import { log } from "./log";
import { decodeSystemError } from "./nativeErrors";
import { restackErr, truthy } from "./util";

const permission: typeof permissionT = lazyRequire(() =>
  require("permissions"),
);
const vortexRun: typeof vortexRunT = lazyRequire(() => require("vortex-run"));
const wholocks: typeof whoLocksT = lazyRequire(() => require("wholocks"));

const showMessageBox = async (
  options: Electron.MessageBoxOptions,
): Promise<Electron.MessageBoxReturnValue> => {
  return window.api.dialog.showMessageBox(options);
};

export { constants, Stats, WriteStream } from "fs";
export type { FSWatcher } from "fs";

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
} from "original-fs";

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
const RETRY_ERRORS = new Set([
  "EPERM",
  "EBUSY",
  "EIO",
  "EBADF",
  "ENOTEMPTY",
  "EMFILE",
  "UNKNOWN",
]);

// Tracks paths where elevated permissions have been successfully granted,
// so we don't show the unlock dialog repeatedly for child paths or
// loop infinitely when permissions don't stick.
// Entries are removed when they prove ineffective (isPathAlreadyUnlocked),
// keeping the set small over time.
const elevatedUnlockPaths = new Set<string>();

function normalizePath(filePath: string): string {
  return path.normalize(filePath).toLowerCase();
}

function isPathAlreadyUnlocked(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  if (elevatedUnlockPaths.has(normalized)) {
    // Remove the entry: if we already unlocked this exact path and the
    // operation still fails, the unlock didn't help. Removing it ensures
    // future EPERM errors on this path will show the dialog again.
    elevatedUnlockPaths.delete(normalized);
    return true;
  }
  return false;
}

function isChildOfUnlockedPath(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  let found = false;
  elevatedUnlockPaths.forEach((unlocked) => {
    if (normalized.startsWith(unlocked + path.sep)) {
      found = true;
    }
  });
  return found;
}

function recordUnlockedPath(filePath: string): void {
  elevatedUnlockPaths.add(normalizePath(filePath));
}

const simfail =
  process.env.SIMULATE_FS_ERRORS === "true"
    ? (func: () => PromiseBB<any>): PromiseBB<any> => {
        if (Math.random() < 0.25) {
          const code =
            Math.random() < 0.33
              ? "EBUSY"
              : Math.random() < 0.5
                ? "EIO"
                : "UNKNOWN";
          const res: any = new Error(`fake error ${code}`);
          if (code === "UNKNOWN") {
            res["nativeCode"] = 21;
          }
          res.code = code;
          res.path = "foobar file";
          return PromiseBB.reject(res);
        } else {
          return func();
        }
      }
    : (func: () => PromiseBB<any>) => func();

function nospcQuery(): PromiseBB<boolean> {
  const options: Electron.MessageBoxOptions = {
    title: "Disk full",
    message:
      `Operation can't continue because the disk is full. ` +
      "Please free up some space and click retry. Cancelling the transfer operation " +
      "at this point will remove any changes and revert back to the previous state.",
    buttons: ["Cancel", "Retry"],
    type: "warning",
    noLink: true,
  };

  return PromiseBB.resolve(showMessageBox(options)).then((result) =>
    result.response === 0
      ? PromiseBB.reject(new UserCanceled())
      : PromiseBB.resolve(true),
  );
}

function ioQuery(): PromiseBB<boolean> {
  const options: Electron.MessageBoxOptions = {
    title: "I/O Error",
    message:
      "Disk access failed repeatedly. " +
      "If this is a removable disk (like a network or external drive), please ensure " +
      "it's connected. Otherwise this may indicate filesystem corruption, you may " +
      "want to run chkdsk or similar software to scan for problems.",
    buttons: ["Cancel", "Retry"],
    type: "warning",
    noLink: true,
  };

  return PromiseBB.resolve(showMessageBox(options)).then((result) =>
    result.response === 0
      ? PromiseBB.reject(new UserCanceled())
      : PromiseBB.resolve(true),
  );
}

function unlockConfirm(filePath: string): PromiseBB<boolean> {
  if (!truthy(filePath)) {
    return PromiseBB.resolve(false);
  }

  let processes = [];
  try {
    processes = wholocks.default(filePath);
  } catch (err) {
    log("warn", "failed to determine list of processes locking file", {
      filePath,
      error: getErrorMessageOrDefault(err),
    });
  }

  const baseMessage =
    processes.length === 0
      ? `Vortex needs to access "${filePath}" but doesn't have permission to.`
      : `Vortex needs to access "${filePath}" but it either has too restrictive ` +
        "permissions or is locked by another process.";

  const buttons = ["Cancel", "Retry"];

  if (processes.length === 0) {
    buttons.push("Give permission");
  }

  const options: Electron.MessageBoxOptions = {
    title: "Access denied",
    message:
      baseMessage +
      " If your account has admin rights Vortex can try to unlock the file for you.",
    detail:
      processes.length === 0
        ? undefined
        : "Please close the following applications and retry:\n" +
          processes.map((proc) => `${proc.appName} (${proc.pid})`).join("\n"),
    buttons,
    type: "warning",
    noLink: true,
  };

  return PromiseBB.resolve(showMessageBox(options)).then((result) =>
    result.response === 0
      ? PromiseBB.reject(new UserCanceled())
      : PromiseBB.resolve(result.response === 2),
  );
}

function elevatedUnlock(
  unlockPath: string,
  filePath: string,
  originalError: NodeJS.ErrnoException,
): PromiseBB<boolean> {
  // Record the path immediately (before the async elevated call) so that
  // concurrent operations on child paths see it and skip the dialog
  recordUnlockedPath(unlockPath);
  const userId = permission.getUserId();
  return elevated(
    (ipcPath, req: NodeJS.Require) => {
      return req("permissions").allow(unlockPath, userId, "rwx", {
        recursive: true,
      });
    },
    { unlockPath, userId },
  )
    .then(() => true)
    .catch((elevatedErr) => {
      if (
        elevatedErr instanceof UserCanceled ||
        elevatedErr.message.indexOf(
          "The operation was canceled by the user",
        ) !== -1
      ) {
        return Promise.reject(new UserCanceled());
      }
      // if elevation failed, return the original error because the one from
      // elevate - while interesting as well - would make error handling too complicated
      log("error", "failed to acquire permission", {
        filePath,
        error: elevatedErr.message,
      });
      return Promise.reject(originalError);
    });
}

function unknownErrorRetry(
  filePath: string,
  err: Error,
  stackErr: Error,
): PromiseBB<boolean> {
  if (filePath === undefined) {
    // unfortunately these error message don't necessarily contain the filename
    filePath = "<filename unknown>";
  }

  const options: Electron.MessageBoxOptions = {
    title: "Unknown error",
    message:
      `The operating system has reported an error without details when accessing "${filePath}" ` +
      "This is usually due the user's environment and not a bug in Vortex.\n" +
      "Please diagnose your environment and then retry",
    type: "warning",
    noLink: true,
  };

  if (![255, 362, 383, 388, 390, 395, 396, 404].includes(err["nativeCode"])) {
    options.detail =
      "Possible error causes:\n" +
      `1. "${filePath}" is a removable, possibly network drive which has been disconnected.\n` +
      "2. An External application has interfered with file operations " +
      "(Anti-virus, Disk Management Utility, Virus)\n";
  }

  const decoded = decodeSystemError(err, filePath);
  if (decoded !== undefined) {
    options.title = decoded.title;
    options.message = tFunction(decoded.message, { replace: { filePath } });
  }

  if (decoded?.rethrowAs === undefined) {
    options.buttons = ["Cancel", "Retry"];
  } else {
    options.message +=
      "\n\nYou can try continuing but you do so at your own risk.";
    options.buttons = ["Cancel", "Ignore", "Retry"];
  }

  return PromiseBB.resolve(showMessageBox(options)).then((result) => {
    const choice = result.response;

    if (options.buttons[choice] === "Cancel and Report") {
      // we're reporting this to collect a list of native errors and provide better error
      // message
      const nat = err["nativeCode"];
      createErrorReport(
        "Unknown error",
        {
          message: `Windows System Error (${nat})`,
          stack: restackErr(err, stackErr).stack,
          path: filePath,
        },
        {},
        ["bug"],
        {},
      );
      return PromiseBB.reject(new UserCanceled());
    }

    switch (options.buttons[choice]) {
      case "Retry":
        return PromiseBB.resolve(true);
      case "Ignore": {
        err["code"] = decoded?.rethrowAs ?? "UNKNOWN";
        err["allowReport"] = false;
        return PromiseBB.reject(err);
      }
    }

    return PromiseBB.reject(new UserCanceled());
  });
}

function busyRetry(filePath: string): PromiseBB<boolean> {
  if (filePath === undefined) {
    filePath = "<filename unknown>";
  }

  let processes = [];
  try {
    processes = wholocks.default(filePath);
  } catch (err) {
    log("warn", "failed to determine list of processes locking file", {
      filePath,
      error: getErrorMessageOrDefault(err),
    });
  }

  const options: Electron.MessageBoxOptions = {
    title: "File busy",
    message:
      `Vortex needs to access "${filePath}" but it's open in another application. ` +
      "Please close the file in all other applications and then retry.",
    detail:
      processes.length > 0
        ? "Please close the following applications and retry:\n" +
          processes.map((proc) => `${proc.appName} (${proc.pid})`).join("\n")
        : undefined,
    buttons: ["Cancel", "Retry"],
    type: "warning",
    noLink: true,
  };

  return PromiseBB.resolve(showMessageBox(options)).then((result) =>
    result.response === 0
      ? PromiseBB.reject(new UserCanceled())
      : PromiseBB.resolve(true),
  );
}

function errorRepeat(
  error: NodeJS.ErrnoException,
  filePath: string,
  retries: number,
  stackErr: Error,
  showDialogCallback?: () => boolean,
  options?: IErrorHandlerOptions,
): PromiseBB<boolean> {
  if (
    retries > 0 &&
    (RETRY_ERRORS.has(error.code) ||
      (options?.extraRetryErrors || []).includes(error.code))
  ) {
    // retry these errors without query for a few times
    return PromiseBB.delay(retries === 1 ? 1000 : 100).then(() =>
      PromiseBB.resolve(true),
    );
  }
  if (showDialogCallback !== undefined && !showDialogCallback()) {
    return PromiseBB.resolve(false);
  }
  // system error code 1224 means there is a user-mapped section open in the file
  if (
    error.code === "EBUSY" ||
    error["nativeCode"] === 1224 ||
    (error.code === "ENOTEMPTY" && options?.enotempty)
  ) {
    return busyRetry(filePath);
  } else if (error.code === "ENOSPC") {
    return nospcQuery();
  } else if (["EBADF", "EIO"].includes(error.code)) {
    return ioQuery();
  } else if (error.code === "EPERM") {
    let unlockPath = filePath;
    return PromiseBB.resolve(fs.stat(unlockPath))
      .catch((statErr) => {
        const code = getErrorCode(statErr);
        if (code === "ENOENT") {
          unlockPath = path.dirname(filePath);
          return PromiseBB.resolve();
        } else {
          return PromiseBB.reject(statErr);
        }
      })
      .then(() => {
        // If we already granted elevated permissions on this exact path and the
        // operation still fails, the permission change didn't help.
        // Stop retrying to avoid an infinite dialog loop.
        if (isPathAlreadyUnlocked(unlockPath)) {
          return PromiseBB.resolve(false);
        }
        // If this path is under a directory where permissions were already
        // granted recursively, auto-grant without showing the dialog again
        if (isChildOfUnlockedPath(unlockPath)) {
          return elevatedUnlock(unlockPath, filePath, error);
        }
        return unlockConfirm(unlockPath).then((doUnlock) => {
          if (doUnlock) {
            return elevatedUnlock(unlockPath, filePath, error);
          } else {
            return PromiseBB.resolve(true);
          }
        });
      });
  } else if (error.code === "UNKNOWN") {
    return unknownErrorRetry(filePath, error, stackErr);
  } else {
    return PromiseBB.resolve(false);
  }
}

interface IErrorHandlerOptions {
  enotempty?: boolean;
  extraRetryErrors?: string[];
}

function augmentError(error: NodeJS.ErrnoException) {
  if (error.message === "dest already exists.") {
    error.code = "EEXIST";
  }
}

function errorHandler(
  error: NodeJS.ErrnoException,
  stackErr: Error,
  tries: number,
  showDialogCallback?: () => boolean,
  options?: IErrorHandlerOptions,
): PromiseBB<void> {
  augmentError(error);
  const repProm = errorRepeat(
    error,
    (error as any).dest || error.path,
    tries,
    stackErr,
    showDialogCallback,
    options,
  );

  // trying to narrow down #6404
  if (repProm === undefined) {
    const err = new Error(
      `Failed to handle filesystem error "${error.code}": ${error.message}.`,
    );
    err.stack = error.stack;
    throw PromiseBB.reject(err);
  }

  return repProm
    .then((repeat) =>
      repeat
        ? PromiseBB.resolve()
        : PromiseBB.reject(restackErr(error, stackErr)),
    )
    .catch((err) => PromiseBB.reject(restackErr(err, stackErr)));
}

export function genFSWrapperAsync<T extends (...args) => any>(func: T) {
  const wrapper = (stackErr: Error, tries: number, ...args) =>
    simfail(() => PromiseBB.resolve(func(...args))).catch((err) =>
      errorHandler(err, stackErr, tries).then(() =>
        wrapper(stackErr, tries - 1, ...args),
      ),
    );

  const res = (...args) => {
    return wrapper(new Error(), NUM_RETRIES, ...args);
  };
  return res;
}

// tslint:disable:max-line-length
const chmodAsync: (path: string, mode: string | number) => PromiseBB<void> =
  genFSWrapperAsync(fs.chmod);
const closeAsync: (fd: number) => PromiseBB<void> = genFSWrapperAsync(fs.close);
const fsyncAsync: (fd: number) => PromiseBB<void> = genFSWrapperAsync(fs.fsync);
const lstatAsync: (path: string) => PromiseBB<fs.Stats> = genFSWrapperAsync(
  fs.lstat,
);
const mkdirAsync: (path: string) => PromiseBB<void> = genFSWrapperAsync(
  fs.mkdir,
);
const mkdirsAsync: (path: string) => PromiseBB<void> = genFSWrapperAsync(
  fs.mkdirs,
);
const moveAsync: (
  src: string,
  dest: string,
  options?: fs.MoveOptions,
) => PromiseBB<void> = genFSWrapperAsync(fs.move);
const openAsync: (
  path: string,
  flags: string | number,
  mode?: number,
) => PromiseBB<number> = genFSWrapperAsync(fs.open);
const readdirAsync: (path: string) => PromiseBB<string[]> = genFSWrapperAsync(
  fs.readdir,
);
const readFileAsync: (...args: any[]) => PromiseBB<any> = genFSWrapperAsync(
  fs.readFile,
);
const statAsync: (path: string) => PromiseBB<fs.Stats> = genFSWrapperAsync(
  fs.stat,
);
const statSilentAsync: (path: string) => PromiseBB<fs.Stats> = (
  statPath: string,
) => PromiseBB.resolve(fs.stat(statPath));
const symlinkAsync: (
  srcpath: string,
  dstpath: string,
  type?: string,
) => PromiseBB<void> = genFSWrapperAsync(fs.symlink);
const utimesAsync: (
  path: string,
  atime: number,
  mtime: number,
) => PromiseBB<void> = genFSWrapperAsync(fs.utimes);
// fs.write and fs.read don't promisify correctly because it has two return values. fs-extra already works around this in their
// promisified api so no reason to reinvent the wheel (also we want the api to be compatible)
const writeAsync: <BufferT>(
  ...args: any[]
) => PromiseBB<{ bytesWritten: number; buffer: BufferT }> = genFSWrapperAsync(
  fs.write,
) as any;
const readAsync: <BufferT>(
  ...args: any[]
) => PromiseBB<{ bytesRead: number; buffer: BufferT }> = genFSWrapperAsync(
  fs.read,
) as any;
const writeFileAsync: (
  file: string,
  data: any,
  options?: fs.WriteFileOptions,
) => PromiseBB<void> = genFSWrapperAsync(fs.writeFile);
const appendFileAsync: (
  file: string,
  data: any,
  options?: fs.WriteFileOptions,
) => PromiseBB<void> = genFSWrapperAsync(fs.appendFile);
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

export function isDirectoryAsync(dirPath: string): PromiseBB<boolean> {
  return PromiseBB.resolve(fs.stat(dirPath)).then((stats) =>
    stats.isDirectory(),
  );
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
  return PromiseBB.resolve(fs.ensureFile(filePath)).catch((err) => {
    throw restackErr(err, stackErr);
  });
}

export function ensureDirAsync(
  dirPath: string,
  onDirCreatedCB?: (created: string) => PromiseBB<void>,
): PromiseBB<void> {
  const stackErr = new Error();
  // If a onDirCreated callback is provided, we can't use fs-extra's
  //  implementation directly as there's no way for us to reliably determine
  //  whether the parent folder was empty. We're going to create the
  //  directories ourselves.
  return onDirCreatedCB
    ? ensureDir(dirPath, onDirCreatedCB)
    : ensureDirInt(dirPath, stackErr, NUM_RETRIES);
}

function ensureDirInt(
  dirPath: string,
  stackErr: Error,
  tries: number,
): PromiseBB<void> {
  return PromiseBB.resolve(fs.ensureDir(dirPath)).catch((err) => {
    // ensureDir isn't supposed to cause EEXIST errors as far as I understood
    // it but on windows, when targeting a OneDrive path (and similar?)
    // it apparently still does
    if (err.code === "EEXIST") {
      return PromiseBB.resolve();
    }
    return simfail(() => errorHandler(err, stackErr, tries, undefined)).then(
      () => ensureDirInt(dirPath, stackErr, tries - 1),
    );
  });
}

function ensureDir(
  targetDir: string,
  onDirCreatedCB: (created: string) => PromiseBB<void>,
) {
  // Please note, onDirCreatedCB will be called for _each_ directory
  //  we create.
  const created: string[] = [];
  const mkdirRecursive = (dir: string) =>
    PromiseBB.resolve(fs.mkdir(dir))
      .then(() => {
        created.push(dir);
        return onDirCreatedCB(dir);
      })
      .catch((err) => {
        const code = getErrorCode(err);
        if (code === "EEXIST") {
          return PromiseBB.resolve();
        } else {
          return ["ENOENT"].indexOf(code) !== -1
            ? mkdirRecursive(path.dirname(dir))
                .then(() => PromiseBB.resolve(fs.mkdir(dir)))
                .then(() => {
                  created.push(dir);
                  return onDirCreatedCB(dir);
                })
                .catch((err2) => {
                  const code2 = getErrorCode(err2);
                  return code2 === "EEXIST"
                    ? PromiseBB.resolve()
                    : PromiseBB.reject(err2);
                })
            : PromiseBB.reject(err);
        }
      });

  return mkdirRecursive(targetDir).then(() =>
    created.indexOf(targetDir) !== -1
      ? PromiseBB.resolve(targetDir)
      : PromiseBB.resolve(null),
  );
}

function selfCopyCheck(src: string, dest: string) {
  return PromiseBB.all([
    (fs.stat as any)(src, { bigint: true }),
    (fs.stat as any)(dest, { bigint: true }).catch((err) =>
      getErrorCode(err) === "ENOENT"
        ? Promise.resolve({})
        : Promise.reject(err),
    ),
  ]).then((stats: fs.BigIntStats[]) =>
    stats[0].ino === stats[1].ino
      ? PromiseBB.reject(new SelfCopyCheckError(src, dest, stats[0].ino))
      : PromiseBB.resolve(),
  );
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
export function moveRenameAsync(src: string, dest: string): PromiseBB<string> {
  return moveAsync(src, dest, { overwrite: false })
    .then(() => dest)
    .catch({ code: "EEXIST" }, () => moveRenameAsync(src, nextName(dest)));
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
export function copyAsync(
  src: string,
  dest: string,
  options?: fs.CopyOptions & {
    noSelfCopy?: boolean;
    showDialogCallback?: () => boolean;
  },
): PromiseBB<void> {
  const stackErr = new Error();
  // fs.copy in fs-extra has a bug where it doesn't correctly avoid copying files onto themselves
  const check = options?.noSelfCopy
    ? PromiseBB.resolve()
    : selfCopyCheck(src, dest);
  return check
    .then(() => copyInt(src, dest, options || undefined, stackErr, NUM_RETRIES))
    .catch((err) => PromiseBB.reject(restackErr(err, stackErr)));
}

type CopyOptionsEx = fs.CopyOptions & {
  noSelfCopy?: boolean;
  showDialogCallback?: () => boolean;
};

function copyInt(
  src: string,
  dest: string,
  options: CopyOptionsEx,
  stackErr: Error,
  tries: number,
) {
  return simfail(() => PromiseBB.resolve(fs.copy(src, dest, options))).catch(
    (err: NodeJS.ErrnoException) =>
      errorHandler(err, stackErr, tries, options?.showDialogCallback, {
        extraRetryErrors: ["EEXIST"],
      }).then(() => copyInt(src, dest, options, stackErr, tries - 1)),
  );
}

export function linkAsync(
  src: string,
  dest: string,
  options?: ILinkFileOptions,
): PromiseBB<void> {
  const stackErr = new Error();
  return linkInt(src, dest, stackErr, NUM_RETRIES, options).catch((err) =>
    PromiseBB.reject(restackErr(err, stackErr)),
  );
}

function linkInt(
  src: string,
  dest: string,
  stackErr: Error,
  tries: number,
  options?: ILinkFileOptions,
): PromiseBB<void> {
  return simfail(() => PromiseBB.resolve(fs.link(src, dest))).catch(
    (err: NodeJS.ErrnoException) =>
      errorHandler(
        err,
        stackErr,
        tries,
        options !== undefined ? options.showDialogCallback : undefined,
      ).then(() => linkInt(src, dest, stackErr, tries - 1, options)),
  );
}

export function removeSync(dirPath: string) {
  fs.removeSync(dirPath);
}

export function unlinkAsync(
  filePath: string,
  options?: IRemoveFileOptions,
): PromiseBB<void> {
  return unlinkInt(filePath, new Error(), NUM_RETRIES, options || {});
}

function unlinkInt(
  filePath: string,
  stackErr: Error,
  tries: number,
  options: IRemoveFileOptions,
): PromiseBB<void> {
  return simfail(() => PromiseBB.resolve(fs.unlink(filePath))).catch(
    (err: NodeJS.ErrnoException) => {
      const handle = () =>
        errorHandler(err, stackErr, tries, options.showDialogCallback).then(
          () => unlinkInt(filePath, stackErr, tries - 1, options),
        );

      if (err.code === "ENOENT") {
        // don't mind if a file we wanted deleted was already gone
        return PromiseBB.resolve();
      } else if (err.code === "EPERM") {
        // this could be caused by the path actually pointing to a directory,
        // unlink can only handle files
        return PromiseBB.resolve(fs.stat(filePath))
          .then((stats) => {
            if (stats.isDirectory()) {
              err.code = "EISDIR";
            }
            return handle();
          })
          .catch((errInner) =>
            errInner instanceof UserCanceled
              ? Promise.reject(errInner)
              : handle(),
          );
      } else {
        return handle();
      }
    },
  );
}

export function renameAsync(
  sourcePath: string,
  destinationPath: string,
): PromiseBB<void> {
  return renameInt(sourcePath, destinationPath, new Error(), NUM_RETRIES);
}

function renameInt(
  sourcePath: string,
  destinationPath: string,
  stackErr: Error,
  tries: number,
): PromiseBB<void> {
  return simfail(() =>
    PromiseBB.resolve(fs.rename(sourcePath, destinationPath)),
  ).catch((err: NodeJS.ErrnoException) => {
    if (tries > 0 && RETRY_ERRORS.has(err.code)) {
      return PromiseBB.delay((NUM_RETRIES - tries + 1) * RETRY_DELAY_MS).then(
        () => renameInt(sourcePath, destinationPath, stackErr, tries - 1),
      );
    }
    return err.code === "EPERM"
      ? PromiseBB.resolve(fs.stat(destinationPath))
          .then((stat) =>
            stat.isDirectory()
              ? PromiseBB.reject(restackErr(err, stackErr))
              : errorHandler(err, stackErr, tries).then(() =>
                  renameInt(sourcePath, destinationPath, stackErr, tries - 1),
                ),
          )
          .catch((newErr) => PromiseBB.reject(restackErr(newErr, stackErr)))
      : errorHandler(err, stackErr, tries).then(() =>
          renameInt(sourcePath, destinationPath, stackErr, tries - 1),
        );
  });
}

export function rmdirAsync(dirPath: string): PromiseBB<void> {
  return rmdirInt(dirPath, new Error(), NUM_RETRIES);
}

function rmdirInt(
  dirPath: string,
  stackErr: Error,
  tries: number,
): PromiseBB<void> {
  return simfail(() => PromiseBB.resolve(fs.rmdir(dirPath))).catch(
    (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        // don't mind if a file we wanted deleted was already gone
        return PromiseBB.resolve();
      } else if (RETRY_ERRORS.has(err.code) && tries > 0) {
        return PromiseBB.delay(RETRY_DELAY_MS).then(() =>
          rmdirInt(dirPath, stackErr, tries - 1),
        );
      }
      throw restackErr(err, stackErr);
    },
  );
}

export function removeAsync(
  remPath: string,
  options?: IRemoveFileOptions,
): PromiseBB<void> {
  const stackErr = new Error();
  return removeInt(remPath, stackErr, NUM_RETRIES, options || {});
}

function removeInt(
  remPath: string,
  stackErr: Error,
  tries: number,
  options: IRemoveFileOptions,
): PromiseBB<void> {
  return simfail(() => rimrafAsync(remPath)).catch((err) =>
    errorHandler(err, stackErr, tries, options.showDialogCallback, {
      enotempty: true,
    }).then(() => removeInt(remPath, stackErr, tries - 1, options)),
  );
}

function rimrafAsync(remPath: string): PromiseBB<void> {
  return new PromiseBB((resolve, reject) => {
    // don't use the rimraf implementation of busy retries because it's f*cked:
    // https://github.com/isaacs/rimraf/issues/187
    rimraf(
      remPath,
      {
        maxBusyTries: 0,
      },
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      },
    );
  });
}

export function readlinkAsync(linkPath: string): PromiseBB<string> {
  const stackErr = new Error();
  return readlinkInt(linkPath, stackErr, NUM_RETRIES);
}

function readlinkInt(
  linkPath: string,
  stackErr: Error,
  tries: number,
): PromiseBB<string> {
  return simfail(() => PromiseBB.resolve(fs.readlink(linkPath))).catch(
    (err) => {
      if (err.code === "UNKNOWN" && process.platform === "win32") {
        // on windows this return UNKNOWN if the file is not a link.
        // of course there could be a thousand other things returning UNKNOWN but we'll never
        // know, will we? libuv? will we?
        const newErr: any = new Error("Not a link");
        newErr.code = "EINVAL";
        newErr.syscall = "readlink";
        newErr.path = linkPath;
        return Promise.reject(newErr);
      } else if (err.code === "EINVAL") {
        return Promise.reject(err);
      } else {
        return errorHandler(err, stackErr, tries).then(() =>
          readlinkInt(linkPath, stackErr, tries - 1),
        );
      }
    },
  );
}

function elevated(
  func: (ipc, req: NodeRequireFunction) => Promise<void>,
  parameters: any,
): PromiseBB<void> {
  let server: net.Server;
  return new PromiseBB<void>((resolve, reject) => {
    const id = shortid();
    let resolved = false;

    const ipcPath = `__fs_elevated_${id}`;

    server = net
      .createServer((connRaw) => {
        const conn = new JsonSocket(connRaw);

        conn
          .on("message", (data) => {
            if (data.error !== undefined) {
              if (data.error.startsWith("InvalidScriptError")) {
                reject(new Error(data.error));
              } else {
                log("error", "elevated process failed", data.error);
              }
            } else {
              log("warn", "got unexpected ipc message", JSON.stringify(data));
            }
          })
          .on("end", () => {
            if (!resolved) {
              resolved = true;
              resolve();
            }
          })
          .on("error", (err) => {
            log("error", "elevated code reported error", err);
            if (!resolved) {
              resolved = true;
              reject(err);
            }
          });
      })
      .listen(path.join("\\\\?\\pipe", ipcPath));
    vortexRun.runElevated(ipcPath, func, parameters).catch((err) => {
      if (
        err.code === 5 ||
        (process.platform === "win32" && err.systemCode === 1223)
      ) {
        // this code is returned when the user rejected the UAC dialog. Not currently
        // aware of another case
        reject(new UserCanceled());
      } else {
        reject(new Error(`OS error ${err.message} (${err.code})`));
      }
    });
  }).finally(() => {
    if (server !== undefined) {
      server.close();
    }
  });
}

export function ensureDirWritableAsync(
  dirPath: string,
  confirm?: () => PromiseLike<void>,
): PromiseBB<void> {
  if (confirm === undefined) {
    confirm = () => PromiseBB.resolve();
  }
  const stackErr = new Error();
  return PromiseBB.resolve(fs.ensureDir(dirPath))
    .then(() => {
      const canary = path.join(dirPath, "__vortex_canary");
      return ensureFileAsync(canary).then(() => removeAsync(canary));
    })
    .catch((err) => {
      // weirdly we get EBADF from ensureFile sometimes when the
      // directory isn't writeable instead of EPERM. More weirdly, this seems to happen
      // only on startup.
      // Additionally, users may occasionally get EEXIST (OneDrive specific?)
      //  as far as I understand fs-extra that is not supposed to happen! but I suppose
      //  it doesn't hurt to add some code to handle that use case.
      //  https://github.com/Nexus-Mods/Vortex/issues/6856
      if (["EPERM", "EBADF", "UNKNOWN", "EEXIST"].indexOf(err.code) !== -1) {
        return PromiseBB.resolve(confirm()).then(() => {
          const userId = permission.getUserId();
          return (
            elevated(
              (ipcPath, req: NodeRequire) => {
                // tslint:disable-next-line:no-shadowed-variable
                const fs = req("fs-extra");
                // tslint:disable-next-line:no-shadowed-variable
                const path = req("path");
                const { allow } = req("permissions");
                const allowDir = (targetPath) => {
                  try {
                    allow(targetPath, userId, "rwx");
                    return Promise.resolve();
                  } catch (err) {
                    return Promise.reject(err);
                  }
                };
                // recurse upwards in the directory tree if necessary
                const ensureAndAllow = (targetPath, allowRecurse) => {
                  return fs
                    .ensureDir(targetPath)
                    .catch((elevatedErr) => {
                      const parentPath = path.dirname(targetPath);
                      if (
                        ["EPERM", "ENOENT"].includes(elevatedErr.code) &&
                        parentPath !== targetPath &&
                        allowRecurse
                      ) {
                        return ensureAndAllow(parentPath, true).then(() =>
                          ensureAndAllow(targetPath, false),
                        );
                      } else if (elevatedErr.code === "EEXIST") {
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
              },
              { dirPath, userId },
            )
              // if elevation fails, rethrow the original error, not the failure to elevate
              .catch((elevatedErr) => {
                if (
                  elevatedErr.message.indexOf(
                    "The operation was canceled by the user",
                  ) !== -1
                ) {
                  return Promise.reject(new UserCanceled());
                }
                // if elevation failed, return the original error because the one from
                // elevate, while interesting as well, would make error handling too complicated
                log(
                  "error",
                  "failed to acquire permission",
                  elevatedErr.message,
                );

                return PromiseBB.reject(restackErr(err, stackErr));
              })
          );
        });
      } else {
        return PromiseBB.reject(restackErr(err, stackErr));
      }
    });
}

export function changeFileOwnership(
  filePath: string,
  stat: fs.Stats,
): PromiseBB<void> {
  if (process.platform === "win32") {
    // This is a *nix only function.
    return PromiseBB.resolve();
  }

  const readAndWriteOther = parseInt("0006", 8);
  if ((stat.mode & readAndWriteOther) === readAndWriteOther) {
    return PromiseBB.reject(
      new ProcessCanceled("Ownership change not required"),
    );
  }

  const readAndWriteGroup = parseInt("0060", 8);
  const hasGroupPermissions =
    (stat.mode & readAndWriteGroup) === readAndWriteGroup;

  // (Writing this down as it can get confusing) Cases where we need to change ownership are:
  //  <BaseOwnerCheck> - If the process real ID is different than the file's real ID.
  //
  //  1. If <BaseOwnerCheck> is true and the file does NOT have the group read/write bits set.
  //  2. If <BaseOwnerCheck> is true and the file DOES have the group read/write bits set but
  //   the process group id differs from the file's group id.
  //
  // Ask for forgiveness, not permission.
  return stat.uid !== process.getuid()
    ? !hasGroupPermissions ||
      (hasGroupPermissions && stat.gid !== process.getgid())
      ? PromiseBB.resolve(fs.chown(filePath, process.getuid(), stat.gid)).catch(
          (err) => PromiseBB.reject(err),
        )
      : PromiseBB.resolve()
    : PromiseBB.resolve();
}

export function changeFileAttributes(
  filePath: string,
  wantedAttributes: number,
  stat: fs.Stats,
): PromiseBB<void> {
  return changeFileOwnership(filePath, stat)
    .then(() => {
      const finalAttributes = stat.mode | wantedAttributes;
      return PromiseBB.resolve(fs.chmod(filePath, finalAttributes));
    })
    .catch(ProcessCanceled, () => PromiseBB.resolve())
    .catch((err) => PromiseBB.reject(err));
}

export function makeFileWritableAsync(filePath: string): PromiseBB<void> {
  const stackErr = new Error();
  const wantedAttributes =
    process.platform === "win32" ? parseInt("0666", 8) : parseInt("0600", 8);
  return PromiseBB.resolve(fs.stat(filePath)).then((stat) => {
    if (!stat.isFile()) {
      const err: NodeJS.ErrnoException = new Error(
        `Expected a file, found a directory: "${filePath}"`,
      );
      err.code = "EISDIR";
      err.path = filePath;
      err.syscall = "stat";
      err.stack = stackErr.stack;
      return PromiseBB.reject(err);
    }

    return (stat.mode & wantedAttributes) !== wantedAttributes
      ? changeFileAttributes(filePath, wantedAttributes, stat)
      : PromiseBB.resolve();
  });
}

function raiseUACDialog<T>(
  t: TFunction,
  err: any,
  op: () => PromiseBB<T>,
  filePath: string,
): PromiseBB<T> {
  let fileToAccess = filePath !== undefined ? filePath : err.path;
  const options: Electron.MessageBoxOptions = {
    title: "Access denied (2)",
    message: t(
      'Vortex needs to access "{{ fileName }}" but doesn\'t have permission to.\n' +
        "If your account has admin rights Vortex can unlock the file for you. " +
        "Windows will show an UAC dialog.",
      { replace: { fileName: fileToAccess } },
    ),
    buttons: ["Cancel", "Retry", "Give permission"],
    noLink: true,
    type: "warning",
  };

  return PromiseBB.resolve(showMessageBox(options)).then((result) => {
    const choice = result.response;
    if (choice === 1) {
      // Retry
      return forcePerm(t, op, filePath);
    } else if (choice === 2) {
      // Give Permission
      const userId = permission.getUserId();
      return PromiseBB.resolve(fs.stat(fileToAccess))
        .catch((statErr) => {
          if (statErr.code === "ENOENT") {
            fileToAccess = path.dirname(fileToAccess);
          }
          return PromiseBB.resolve();
        })
        .then(() =>
          elevated(
            (ipcPath, req: NodeRequire) => {
              // tslint:disable-next-line:no-shadowed-variable
              const { allow } = req("permissions");
              return allow(fileToAccess, userId, "rwx");
            },
            { fileToAccess, userId },
          ).catch((elevatedErr) => {
            if (
              elevatedErr instanceof UserCanceled ||
              elevatedErr.message.indexOf(
                "The operation was canceled by the user",
              ) !== -1
            ) {
              return Promise.reject(new UserCanceled());
            }
            // if elevation failed, return the original error because the one from
            // elevate, while interesting as well, would make error handling too complicated
            log("error", "failed to acquire permission", elevatedErr.message);
            return Promise.reject(err);
          }),
        )
        .then(() => forcePerm(t, op, filePath));
    } else {
      return PromiseBB.reject(new UserCanceled());
    }
  });
}

export function forcePerm<T>(
  t: TFunction,
  op: () => PromiseBB<T>,
  filePath?: string,
  maxTries: number = 3,
): PromiseBB<T> {
  return op().catch((err) => {
    const fileToAccess = filePath !== undefined ? filePath : err.path;
    if (
      ["EPERM", "EACCES"].indexOf(err.code) !== -1 ||
      (isErrorWithSystemCode(err) && err.systemCode === 5)
    ) {
      const wantedAttributes =
        process.platform === "win32"
          ? parseInt("0666", 8)
          : parseInt("0600", 8);
      return fs
        .stat(fileToAccess)
        .then((stat) =>
          changeFileAttributes(fileToAccess, wantedAttributes, stat),
        )
        .then(() => op())
        .catch((innerErr) => {
          if (innerErr instanceof UserCanceled) {
            return Promise.resolve(undefined);
          }
          return raiseUACDialog(t, err, op, filePath);
        });
    } else if (RETRY_ERRORS.has(err.code) && maxTries > 0) {
      return PromiseBB.delay(RETRY_DELAY_MS).then(() =>
        forcePerm(t, op, filePath, maxTries - 1),
      );
    } else {
      return PromiseBB.reject(err);
    }
  });
}

export function withTmpDirImpl<T>(
  cb: (tmpPath: string) => PromiseBB<T>,
): PromiseBB<T> {
  return new PromiseBB<T>((resolve, reject) => {
    tmp.dir({ unsafeCleanup: true }, (err, tmpPath, cleanup) => {
      if (err !== null) {
        return reject(err);
      } else {
        cb(tmpPath)
          .then((out: T) => {
            resolve(out);
          })
          .catch((tmpErr) => {
            reject(tmpErr);
          })
          .finally(() => {
            try {
              cleanup();
            } catch (err) {
              // cleanup failed
              log("warn", "Failed to clean up temporary directory", {
                tmpPath,
              });
            }
          });
      }
    });
  });
}

export interface ITmpOptions {
  cleanup?: boolean;
}

function withTmpFileImpl<T>(
  cb: (fd: number, name: string) => PromiseBB<T>,
  options?: ITmpOptions & tmp.FileOptions,
): PromiseBB<T> {
  return new PromiseBB<T>((resolve, reject) => {
    tmp.file(_.omit(options ?? {}, ["cleanup"]), (err, name, fd, cleanup) => {
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
                log("warn", "Failed to clean up temporary file", { name });
              }
            }
          });
      }
    });
  });
}

const withTmpDir = genFSWrapperAsync(withTmpDirImpl);
const withTmpFile = genFSWrapperAsync(withTmpFileImpl);

export { withTmpDir, withTmpFile };

const KNOWN_BOMS: Array<{ bom: Buffer; enc: string }> = [
  { bom: Buffer.from([0xef, 0xbb, 0xbf]), enc: "utf8" },
  { bom: Buffer.from([0x00, 0x00, 0xfe, 0xff]), enc: "utf32-be" },
  { bom: Buffer.from([0xff, 0xfe, 0x00, 0x00]), enc: "utf32-le" },
  { bom: Buffer.from([0xfe, 0xff]), enc: "utf16be" },
  { bom: Buffer.from([0xff, 0xfe]), enc: "utf16le" },
];

export function encodingFromBOM(buf: Buffer): {
  encoding: string;
  length: number;
} {
  const bom = KNOWN_BOMS.find(
    (b) =>
      b.bom.length < buf.length && b.bom.compare(buf, 0, b.bom.length) === 0,
  );

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
export function readFileBOM(
  filePath: string,
  fallbackEncoding: string,
): Promise<string> {
  return Promise.resolve(readFileAsync(filePath)).then((buffer: Buffer) => {
    // iconv-lite has its own BOM handling but it's weird because you apparently
    // still have to specify utf-8/utf-16/utf-32 - it just detects the endianness
    const detectedEnc = encodingFromBOM(buffer);
    if (detectedEnc === undefined) {
      // no bom
      return decode(buffer, fallbackEncoding ?? "utf8");
    } else {
      return decode(
        buffer.slice(detectedEnc.length),
        detectedEnc?.encoding ?? fallbackEncoding,
      );
    }
  });
}
