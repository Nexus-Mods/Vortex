import { ProcessCanceled, UserCanceled } from "../../util/CustomErrors";
import { getVisibleWindow } from "../../util/errorHandling";
import * as fs from "../../util/fs";
import { log } from "../../util/log";
import { makeQueue } from "../../util/util";

import PromiseBB from "bluebird";
import { dialog as dialogIn } from "electron";
import * as fsFast from "fs-extra";
import * as path from "path";

const dialog =
  process.type === "renderer"
    ? // tslint:disable-next-line:no-var-requires
      require("@electron/remote").dialog
    : dialogIn;

/**
 * assembles a file received in chunks.
 *
 * @class FileAssembler
 */
class FileAssembler {
  public static create(fileName: string): PromiseBB<FileAssembler> {
    let exists = false;
    let size = 0;
    return fs
      .ensureDirAsync(path.dirname(fileName))
      .then(() => fs.statAsync(fileName))
      .then((stats) => {
        if (stats.isDirectory()) {
          return PromiseBB.reject(new Error("Download target is a directory"));
        }
        size = stats.size;
        exists = true;
        return PromiseBB.resolve();
      })
      .catch(() => null)
      .then(() => fs.openAsync(fileName, exists ? "r+" : "w"))
      .then((fd) => new FileAssembler(fileName, size, fd));
  }

  // flush at least every few megabytes
  private static MIN_FLUSH_SIZE = 16 * 1024 * 1024;
  // flush at least once every few seconds
  private static MIN_FLUSH_TIME = 5 * 1000;

  private mFD: number;
  private mFileName: string;
  private mTotalSize: number;
  private mQueue: (
    cb: () => PromiseBB<any>,
    tryOnly: boolean,
  ) => PromiseBB<any>;
  private mWritten: number = 0;
  private mLastFlushedTime: number = 0;
  private mLastFlushedSize: number = 0;

  constructor(fileName: string, size: number, fd: number) {
    this.mFileName = fileName;
    this.mTotalSize = size;
    this.mFD = fd;
    this.mQueue = makeQueue<void>();
  }

  public setTotalSize(size: number) {
    this.mQueue(() => {
      this.mTotalSize = size;
      return PromiseBB.resolve();
    }, false);
  }

  public isClosed() {
    return this.mFD === undefined;
  }

  public rename(newName: string | PromiseBB<string>) {
    const closeFD = () =>
      this.isClosed()
        ? PromiseBB.reject(new ProcessCanceled("File is closed"))
        : fs.closeAsync(this.mFD);

    let resolved: string;
    // to rename the file we have to close the file descriptor, rename,
    // then open it again
    return this.mQueue(
      () =>
        closeFD()
          .catch({ code: "EBADF" }, () => null)
          .then(() =>
            PromiseBB.resolve(newName).then(
              (nameResolved) => (resolved = nameResolved),
            ),
          )
          .then(() => fs.renameAsync(this.mFileName, resolved))
          .then(() => fs.openAsync(resolved, "r+"))
          .then((fd) => {
            this.mFD = fd;
            this.mFileName = resolved;
            return PromiseBB.resolve();
          })
          .catch((err) => {
            if (err instanceof ProcessCanceled) {
              // This would only happen if we have closed the
              //  file in one of the queue's previous iterations.
              log("warn", "attempt to rename closed file", this.mFileName);
              return PromiseBB.reject(err);
            }

            // in case of error, re-open the original file name so we can continue writing,
            // only  then rethrow the exception
            return fs
              .openAsync(this.mFileName, "r+")
              .then((fd) => {
                this.mFD = fd;
              })
              .then(() => PromiseBB.reject(err));
          }),
      false,
    );
  }

  public addChunk(offset: number, data: Buffer): PromiseBB<boolean> {
    let synced = false;
    return this.mQueue(
      () =>
        (this.mFD === undefined
          ? PromiseBB.reject(new ProcessCanceled("file already closed"))
          : this.writeAsync(data, offset)
        )
          .then(({ bytesWritten, buffer }) => {
            this.mWritten += bytesWritten;
            const now = Date.now();
            if (
              this.mWritten - this.mLastFlushedSize >
                FileAssembler.MIN_FLUSH_SIZE ||
              now - this.mLastFlushedTime > FileAssembler.MIN_FLUSH_TIME
            ) {
              this.mLastFlushedSize = this.mWritten;
              this.mLastFlushedTime = now;
              synced = true;
              return fs
                .fsyncAsync(this.mFD)
                .catch({ code: "EBADF" }, () => {
                  // if we log this we may be generating thousands of log messages
                })
                .then(() => bytesWritten);
            } else {
              return PromiseBB.resolve(bytesWritten);
            }
          })
          .then((bytesWritten: number) =>
            bytesWritten !== data.length
              ? PromiseBB.reject(
                  new Error(`incomplete write ${bytesWritten}/${data.length}`),
                )
              : PromiseBB.resolve(synced),
          )
          .catch({ code: "ENOSPC" }, () => {
            dialog.showMessageBoxSync(getVisibleWindow(), {
              type: "warning",
              title: "Disk is full",
              message:
                "Download can't continue because disk is full, " +
                "please free some some space and retry.",
              buttons: ["Cancel", "Retry"],
              defaultId: 1,
              noLink: true,
            }) === 1
              ? this.addChunk(offset, data)
              : PromiseBB.reject(new UserCanceled());
          }),
      false,
    );
  }

  public close(): PromiseBB<void> {
    return this.mQueue(() => {
      if (this.mFD !== undefined) {
        const fd = this.mFD;
        this.mFD = undefined;
        return fs
          .fsyncAsync(fd)
          .then(() => fs.closeAsync(fd))
          .catch({ code: "EBADF" }, () => {
            log("warn", "failed to sync or close file", this.mFileName);
            return PromiseBB.resolve();
          })
          .catch({ code: "ENOENT" }, () => PromiseBB.resolve());
      } else {
        return PromiseBB.resolve();
      }
    }, false);
  }

  private writeAsync(data: Buffer, offset: number) {
    return fs
      .writeAsync(this.mFD, data, 0, data.length, offset)
      .catch((err) => {
        if (err.code === "EBADF") {
          err.message += ` (fd: ${this.mFD ?? "closed"})`;
        }
        return PromiseBB.reject(err);
      });
  }
}

export default FileAssembler;
