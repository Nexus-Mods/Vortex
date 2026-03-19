import { getErrorCode, unknownToError } from "@vortex/shared";
import { checksum } from "./checksum";
import * as fs from "./fs";
import { log } from "./log";

import PromiseBB from "bluebird";
import { createHash } from "crypto";
import { file } from "tmp";

export function writeFileAtomic(filePath: string, input: string | Buffer) {
  return writeFileAtomicImpl(filePath, input, 3);
}

function writeFileAtomicImpl(
  filePath: string,
  input: string | Buffer,
  attempts: number,
): PromiseBB<void> {
  const stackErr = new Error();
  let cleanup: (() => void) | undefined;
  let tmpPath: string;
  const buf: Buffer = input instanceof Buffer ? input : Buffer.from(input);

  const callCleanup = () => {
    if (cleanup !== undefined) {
      try {
        cleanup();
      } catch (err) {
        log("error", "failed to clean up temporary file", err);
      }

      cleanup = undefined;
    }
  };

  const hash = checksum(buf);
  let fd = -1;
  return fs
    .withTmpFile(
      (fdIn: number, pathIn: string) => {
        fd = fdIn;
        tmpPath = pathIn;
        return fs
          .writeAsync(fd, buf, 0, buf.byteLength, 0)
          .then(() => fs.fsyncAsync(fd).catch(() => PromiseBB.resolve()))
          .then(() => fs.closeAsync(fd).catch(() => PromiseBB.resolve()));
      },
      {
        cleanup: false,
        template: `${filePath}.XXXXXX.tmp`,
      },
    )
    .then(() => fs.readFileAsync(tmpPath))
    .catch({ code: "EBADF" }, () => {
      log("warn", "failed to access temporary file", {
        filePath,
        fd,
      });
      return PromiseBB.resolve(undefined);
    })
    .then((data) => {
      if (data === undefined || checksum(data) !== hash) {
        callCleanup();
        return attempts > 0
          ? // retry
            writeFileAtomicImpl(filePath, input, attempts - 1)
          : PromiseBB.reject(new Error("Write failed, checksums differ"));
      } else {
        return fs.renameAsync(tmpPath, filePath).catch({ code: "EEXIST" }, () =>
          // renameAsync is supposed to overwrite so this is likely to fail as well
          fs
            .removeAsync(filePath)
            .then(() => fs.renameAsync(tmpPath, filePath)),
        );
      }
    })
    .catch((unknownErr) => {
      const err = unknownToError(unknownErr);
      err.stack = err.stack + "\n" + stackErr.stack;
      return PromiseBB.reject(err);
    })
    .finally(() => {
      callCleanup();
    });
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
 * @returns {PromiseBB<void>}
 */
export function copyFileAtomic(
  srcPath: string,
  destPath: string,
): PromiseBB<void> {
  let cleanup: () => void;
  let tmpPath: string;
  return new PromiseBB((resolve, reject) => {
    file(
      { template: `${destPath}.XXXXXX.tmp` },
      (err: any, genPath: string, fd: number, cleanupCB: () => void) => {
        if (err) {
          return reject(err);
        }
        cleanup = cleanupCB;
        tmpPath = genPath;
        resolve(fd);
      },
    );
  })
    .then((fd: number) => fs.closeAsync(fd))
    .then(() => fs.copyAsync(srcPath, tmpPath))
    .then(() =>
      fs.unlinkAsync(destPath).catch((err) => {
        const code = getErrorCode(err);
        if (code === "EPERM") {
          // if the file is currently in use, try a second time
          // 100ms later
          log("debug", "file locked, retrying delete", destPath);
          return PromiseBB.delay(100).then(() => fs.unlinkAsync(destPath));
        } else if (code === "ENOENT") {
          // file doesn't exist anyway? no problem
          return PromiseBB.resolve();
        } else {
          return PromiseBB.reject(err);
        }
      }),
    )
    .catch((err) =>
      getErrorCode(err) === "ENOENT"
        ? PromiseBB.resolve()
        : PromiseBB.reject(err),
    )
    .then(() =>
      tmpPath !== undefined
        ? fs.renameAsync(tmpPath, destPath)
        : PromiseBB.resolve(),
    )
    .catch((unknownErr) => {
      const err = unknownToError(unknownErr);
      log("info", "failed to copy", { srcPath, destPath, err: err.stack });
      if (cleanup !== undefined) {
        try {
          cleanup();
        } catch (cleanupErr) {
          log("error", "failed to clean up temporary file", cleanupErr);
        }
      }
      return PromiseBB.reject(err);
    });
}
