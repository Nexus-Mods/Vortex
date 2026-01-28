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
    const name = `nmm_import-${now.getTime()}`;
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
        return fs.copyAsync(
          path.join(importPath, "VirtualInstall", "VirtualModConfig.xml"),
          path.join(this.mPath, "VirtualModConfig.xml"),
        );
      })
      .catch((err) =>
        err.code === "ENOENT"
          ? // No virtual mod config.. We know this tends to happen on some
            //  configurations - resolve and keep going.
            //  (oh the hacks we need to put in to support that PoS manager)
            Promise.resolve()
          : Promise.reject(err),
      );
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
      fullMessage +=
        " (" + inspect(extra, { depth: null }).replace("\n", os.EOL) + ")";
    }
    this.mLogFile.write(fullMessage + os.EOL);
  }

  public writeFile(name: string, content: string): Promise<void> {
    return fs.writeFileAsync(path.join(this.mPath, name), content);
  }
}

export default TraceImport;
