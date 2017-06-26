import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';

/**
 * assembles a file received in chunks.
 *
 * @class FileAssembler
 */
class FileAssembler {

  private mFD: number;
  private mTotalSize: number = 0;
  private mWork: Promise<any>;

  constructor(fileName: string) {
    this.mWork = fs.statAsync(fileName).reflect()
    .then((stat: Promise.Inspection<fs.Stats>) => {
      if (stat.isFulfilled()) {
        // file exists already so we're probably resuming a dl
        this.mTotalSize = stat.value().size;
      }
      return fs.openAsync(fileName, stat.isFulfilled() ? 'r+' : 'w');
    })
    .then((fd: number) => {
      this.mFD = fd;
    });
  }

  public setTotalSize(size: number) {
    this.mWork = this.mWork.then(() => {
      this.mTotalSize = size;
    });
  }

  public addChunk(offset: number, data: Buffer) {
    this.mWork = this.mWork.then(() =>
      // writing at an offset beyond the file limit works on windows and linux.
      // I'll assume it means it will work on MacOS too...
      fs.writeAsync(this.mFD, Buffer.from(data), 0, data.length, offset));
  }

  public close(): Promise<void> {
    return this.mWork
    .then(() => {
      if (this.mFD !== undefined) {
        return fs.closeAsync(this.mFD);
      } else {
        return Promise.resolve();
      }
    });
  }
}

export default FileAssembler;
