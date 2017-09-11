import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import { inspect } from 'util';

class TraceImport {
  private mPath: string;
  private mLogFile: fs.WriteStream;

  constructor() {
    const now = new Date();
    const name = `migration-${now.getTime()}`;
    this.mPath = path.join(remote.app.getPath('userData'), name);
  }

  public get logFilePath(): string {
    return path.join(this.mPath, 'migration.log');
  }

  public initDirectory(importPath: string): Promise<void> {
    return fs.mkdirAsync(this.mPath)
      .then(() => fs.createWriteStream(path.join(this.mPath, 'migration.log')))
      .then(stream => {
        this.mLogFile = stream;
        return fs.copyAsync(
          path.join(importPath, 'ModOrganizer.ini'),
          path.join(this.mPath, 'ModOrganizer.ini'));
      });
  }

  public finish() {
    this.mLogFile.end();
    this.mLogFile = undefined;
  }

  public log(level: 'info' | 'warn' | 'error', message: string, extra?: any): void {
    let fullMessage = message;
    if (extra !== undefined) {
      fullMessage += ' (' + inspect(extra, { depth: null }) + ')';
    }
    this.mLogFile.write(fullMessage + '\n');
  }

  public writeFile(name: string, content: string): Promise<void> {
    return fs.writeFileAsync(path.join(this.mPath, name), content);
  }
}

export default TraceImport;
