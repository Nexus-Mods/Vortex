import { ProcessCanceled, UserCanceled } from '../../util/CustomErrors';
import * as fs from '../../util/fs';
import { log } from '../../util/log';

import * as Promise from 'bluebird';
import { dialog as dialogIn, remote } from 'electron';
import * as fsFast from 'fs-extra-promise';
import * as path from 'path';

const dialog = remote !== undefined ? remote.dialog : dialogIn;

/**
 * assembles a file received in chunks.
 *
 * @class FileAssembler
 */
class FileAssembler {
  // flush at least every few megabytes
  private static MIN_FLUSH_SIZE = 16 * 1024 * 1024;
  // flush at least once every few seconds
  private static MIN_FLUSH_TIME = 5 * 1000;

  private mFD: number;
  private mFileName: string;
  private mTotalSize: number;
  private mWork: Promise<any> = Promise.resolve();
  private mWritten: number = 0;
  private mLastFlushedTime: number = 0;
  private mLastFlushedSize: number = 0;

  constructor(fileName: string) {
    let exists = false;
    // TODO: currently sync file operations because otherwise
    //   the download manager becomes considerably more complicated
    //   and it's already complicated enough
    try {
      const stats = fs.statSync(fileName);
      if (stats.isDirectory()) {
        throw new Error(`Download target is a directory`);
      }
      this.mTotalSize = stats.size;
      exists = true;
    } catch (err) {
      this.mTotalSize = 0;
    }
    fs.ensureDirSync(path.dirname(fileName));
    this.mFileName = fileName;
    this.mFD = fs.openSync(fileName, exists ? 'r+' : 'w');
  }

  public setTotalSize(size: number) {
    this.mWork = this.mWork.then(() => {
      this.mTotalSize = size;
    });
  }

  public isClosed() {
    return this.mFD === undefined;
  }

  public rename(newName: string | Promise<string>) {
    let resolved: string;
    this.mWork = this.mWork.then(() => Promise.resolve(newName))
    .then(nameResolved => {
      resolved = nameResolved;
      fs.closeAsync(this.mFD);
    })
    .then(() => fs.renameAsync(this.mFileName, resolved))
    .then(() => {
      this.mFileName = resolved;
      return fs.openAsync(resolved, 'r+');
    })
    .then(fd => {
      this.mFD = fd;
    });
  }

  public addChunk(offset: number, data: Buffer): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      let synced = false;
      this.mWork = this.mWork
        .then(() => (this.mFD === undefined)
            // file already closed, can't use new data
            ? Promise.reject(new ProcessCanceled('file already closed'))
            // writing at an offset beyond the file limit
            // works on windows and linux.
            // I'll assume it means it will work on MacOS too...
            : fsFast.writeAsync(this.mFD, data, 0, data.length, offset))
        .then((bytesWritten: any) => {
          this.mWritten += bytesWritten;
          const now = Date.now();
          if ((this.mWritten - this.mLastFlushedSize > FileAssembler.MIN_FLUSH_SIZE)
              || (now - this.mLastFlushedTime > FileAssembler.MIN_FLUSH_TIME)) {
            this.mLastFlushedSize = this.mWritten;
            this.mLastFlushedTime = now;
            synced = true;
            return fs.fsyncAsync(this.mFD).then(() => bytesWritten);
          } else {
            return Promise.resolve(bytesWritten);
          }
        })
        .then((bytesWritten: number) => (bytesWritten !== data.length)
            ? reject(new Error(`incomplete write ${bytesWritten}/${data.length}`))
            : resolve(synced))
        .catch({ code: 'ENOSPC' }, () => {
          let win = remote !== undefined ? remote.getCurrentWindow() : null;
          (dialog.showMessageBox(win, {
            type: 'warning',
            title: 'Disk is full',
            message: 'Download can\'t continue because disk is full, please free some some space and retry.',
            buttons: ['Cancel', 'Retry'],
            defaultId: 1,
            noLink: true,
          }) === 1)
            ? resolve(this.addChunk(offset, data))
            : reject(new UserCanceled())
        })
        .catch(err => reject(err));
      });
  }

  public close(): Promise<void> {
    this.mWork =  this.mWork
    .then(() => {
      if (this.mFD !== undefined) {
        const fd = this.mFD;
        this.mFD = undefined;
        return fs.fsyncAsync(fd).then(() => fs.closeAsync(fd));
      } else {
        return Promise.resolve();
      }
    });
    return this.mWork;
  }
}

export default FileAssembler;
