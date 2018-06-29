import { ProcessCanceled } from '../../util/CustomErrors';
import * as fs from '../../util/fs';
import { log } from '../../util/log';

import * as Promise from 'bluebird';
import * as fsFast from 'fs-extra-promise';
import * as path from 'path';

/**
 * assembles a file received in chunks.
 *
 * @class FileAssembler
 */
class FileAssembler {

  private mFD: number;
  private mTotalSize: number;
  private mWork: Promise<any> = Promise.resolve();
  private mWritten: number = 0;
  private mLastLogged: number = 0;

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
    this.mFD = fs.openSync(fileName, exists ? 'r+' : 'w');
  }

  public setTotalSize(size: number) {
    this.mWork = this.mWork.then(() => {
      this.mTotalSize = size;
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
          if (this.mWritten - this.mLastLogged > 16 * 1024 * 1024) {
            this.mLastLogged = this.mWritten;
            synced = true;
            return fs.fsyncAsync(this.mFD).then(() => bytesWritten);
          } else {
            return Promise.resolve(bytesWritten);
          }
        })
        .then((bytesWritten: number) =>
          (bytesWritten !== data.length)
            ? reject(new Error(`incomplete write ${bytesWritten}/${data.length}`))
            : resolve(synced))
        .catch(ProcessCanceled, () => {
          resolve(false);
        })
        .catch(err => reject(err));
      });
  }

  public close(): Promise<void> {
    return this.mWork
    .then(() => {
      if (this.mFD !== undefined) {
        const fd = this.mFD;
        this.mFD = undefined;
        return fs.closeAsync(fd);
      } else {
        return Promise.resolve();
      }
    });
  }
}

export default FileAssembler;
