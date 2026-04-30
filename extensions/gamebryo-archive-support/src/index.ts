import PromiseBB from "bluebird";
import * as path from "path";
import { PassThrough } from "stream";
import { fs, types, util } from "vortex-api";

import { BA2Archive, loadBA2 } from "./ba2";
import { BSAArchive, BSAWriter, createBSA, loadBSA } from "./bsa";

// --- BA2 Handler ---

class BA2Handler implements types.IArchiveHandler {
  private mBA2: BA2Archive;
  constructor(ba2: BA2Archive) {
    this.mBA2 = ba2;
  }

  public readDir(archPath: string): PromiseBB<string[]> {
    return new PromiseBB<string[]>((resolve) => {
      let query = archPath.toLowerCase().replace(/\//g, "\\");
      if (!query.endsWith("\\")) {
        query = query + "\\";
      }
      const files: string[] = [];
      const subDirs = new Set<string>();
      this.mBA2.fileList.forEach((fileName) => {
        if (!fileName.toLowerCase().startsWith(query)) {
          return;
        }
        const nextBS = fileName.indexOf("\\", query.length);
        if (nextBS === -1) {
          files.push(fileName.substr(query.length));
        } else {
          subDirs.add(
            fileName.substr(query.length, nextBS - query.length).toLowerCase(),
          );
        }
      });
      resolve([].concat(Array.from(subDirs), files));
    });
  }

  public extractFile(filePath: string, outputPath: string): PromiseBB<void> {
    throw new util.NotSupportedError();
  }

  public extractAll(outputPath: string): PromiseBB<void> {
    return PromiseBB.resolve(this.mBA2.extractAll(outputPath));
  }

  public readFile(filePath: string): NodeJS.ReadableStream {
    throw new util.NotSupportedError();
  }
}

// --- BSA Handler ---

class BSAHandler implements types.IArchiveHandler {
  private mBSA: BSAArchive;
  private mWriter: BSAWriter | undefined;

  constructor(bsa: BSAArchive | BSAWriter) {
    if (bsa instanceof BSAArchive) {
      this.mBSA = bsa;
    } else {
      this.mWriter = bsa;
      // Create a dummy archive for writer mode
      this.mBSA = undefined as any;
    }
  }

  public readDir(archPath: string): PromiseBB<string[]> {
    if (this.mBSA === undefined) {
      return PromiseBB.resolve([]);
    }
    return PromiseBB.resolve(this.readDirImpl(archPath.split(path.sep)));
  }

  public extractFile(filePath: string, outputPath: string): PromiseBB<void> {
    if (this.mBSA === undefined) {
      return PromiseBB.reject(new Error("Archive opened in create mode"));
    }
    const file = this.mBSA.fileList.find(
      (f) =>
        f.fullPath.toLowerCase() ===
        filePath.toLowerCase().replace(/\//g, "\\"),
    );
    if (!file) {
      return PromiseBB.reject(new Error("file not found " + filePath));
    }
    return PromiseBB.resolve(this.mBSA.extractFile(file, outputPath));
  }

  public extractAll(outputPath: string): PromiseBB<void> {
    if (this.mBSA === undefined) {
      return PromiseBB.reject(new Error("Archive opened in create mode"));
    }
    return PromiseBB.resolve(this.mBSA.extractAll(outputPath));
  }

  public readFile(filePath: string): NodeJS.ReadableStream {
    const pass = new PassThrough();

    if (this.mBSA === undefined) {
      pass.emit("error", new Error("Archive opened in create mode"));
      return pass;
    }

    const file = this.mBSA.fileList.find(
      (f) =>
        f.fullPath.toLowerCase() ===
        filePath.toLowerCase().replace(/\//g, "\\"),
    );
    if (!file) {
      pass.emit("error", new Error("file not found " + filePath));
      return pass;
    }

    const tmpDir = require("tmp").dir as (
      cb: (err: any, name: string) => void,
    ) => void;
    tmpDir((tmpErr: any, tmpPath: string) => {
      if (tmpErr !== null) {
        return pass.emit("error", tmpErr);
      }
      this.mBSA
        .extractFile(file, tmpPath)
        .then(() => {
          const fileStream = fs.createReadStream(
            path.join(tmpPath, path.basename(filePath)),
          );
          fileStream.on("data", (data: Buffer) => pass.write(data));
          fileStream.on("end", () => {
            pass.end();
            fs.removeAsync(tmpPath).catch(() => null);
          });
          fileStream.on("error", (err: Error) => pass.emit("error", err));
          fileStream.on("readable", () => pass.emit("readable"));
        })
        .catch((err: Error) => pass.emit("error", err));
    });

    return pass;
  }

  public addFile(filePath: string, sourcePath: string): PromiseBB<void> {
    if (this.mWriter === undefined) {
      return PromiseBB.reject(new Error("Archive not opened in create mode"));
    }
    this.mWriter.addFile(filePath.replace(/\//g, "\\"), sourcePath);
    return PromiseBB.resolve();
  }

  public write(): PromiseBB<void> {
    if (this.mWriter === undefined) {
      return PromiseBB.reject(new Error("Archive not opened in create mode"));
    }
    return PromiseBB.resolve(this.mWriter.write());
  }

  public closeArchive(): PromiseBB<void> {
    return PromiseBB.resolve();
  }

  private readDirImpl(archPath: string[]): string[] {
    let query = archPath.join("\\").toLowerCase();
    if (query && !query.endsWith("\\")) {
      query += "\\";
    }

    const files: string[] = [];
    const subDirs = new Set<string>();

    for (const f of this.mBSA.fileList) {
      const fp = f.fullPath.toLowerCase();
      if (query && !fp.startsWith(query)) continue;

      const rest = query ? fp.substring(query.length) : fp;
      const sep = rest.indexOf("\\");
      if (sep === -1) {
        files.push(f.name);
      } else {
        subDirs.add(rest.substring(0, sep));
      }
    }

    return [...Array.from(subDirs), ...files];
  }
}

// --- Handler Factories ---

function createBA2Handler(
  fileName: string,
  options: types.IArchiveOptions,
): PromiseBB<types.IArchiveHandler> {
  return PromiseBB.resolve(
    loadBA2(fileName).then((archive) => new BA2Handler(archive)),
  );
}

function createBSAHandler(
  fileName: string,
  options: types.IArchiveOptions,
): PromiseBB<types.IArchiveHandler> {
  if (options.create) {
    const version =
      options.version === "0x67" || options.version === "103"
        ? 0x67
        : options.version === "0x69" || options.version === "105"
          ? 0x69
          : 0x68;
    const writer = new BSAWriter(fileName, version as 0x67 | 0x68 | 0x69);
    return PromiseBB.resolve(new BSAHandler(writer));
  }
  return PromiseBB.resolve(
    loadBSA(fileName, options.verify === true).then(
      (archive) => new BSAHandler(archive),
    ),
  );
}

function init(context: types.IExtensionContext) {
  context.registerArchiveType("ba2", createBA2Handler);
  context.registerArchiveType("bsa", createBSAHandler);
  return true;
}

export default init;
