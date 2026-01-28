import Promise from "bluebird";
import * as os from "os";
import * as path from "path";
import { inspect } from "util";
import { fs, util } from "vortex-api";

class TraceImport {
  private mPath: string;
  private mLogFile: fs.WriteStream;

  constructor() {
    const now = new Date();
    const name = `mo_import-${now.getTime()}`;
    this.mPath = path.join(util.getVortexPath("userData"), name);
  }

  public get logFilePath(): string {
    return path.join(this.mPath, "migration.log");
  }

  public initDirectory(importPath: string): Promise<void> {
    return fs
      .ensureDirAsync(this.mPath)
      .then(() => fs.createWriteStream(this.logFilePath))
      .then((stream) => {
        this.mLogFile = stream;
        return fs
          .copyAsync(
            path.join(importPath, "ModOrganizer.ini"),
            path.join(this.mPath, "ModOrganizer.ini"),
          )
          .catch((err) => {
            // Failed to copy over the ini file but that shouldn't stop us from
            //  attempting to transfer the mods. Can't be 'ENOENT' as we wouldn't
            //  have reached this point if it were.
            this.log("warn", "Failed to copy ModOrganizer.ini file", err);
            return Promise.resolve();
          });
      });
  }

  public finish() {
    this.mLogFile.end();
    this.mLogFile = undefined;
  }

  public log(
    level: "info" | "warn" | "error",
    message: string,
    extra?: any,
  ): void {
    let fullMessage = message;
    if (extra !== undefined) {
      fullMessage += " (" + inspect(extra, { depth: null }) + ")";
    }
    this.mLogFile.write(fullMessage + os.EOL);
  }

  public writeFile(name: string, content: string): Promise<void> {
    return fs.writeFileAsync(path.join(this.mPath, name), content);
  }
}

export default TraceImport;
