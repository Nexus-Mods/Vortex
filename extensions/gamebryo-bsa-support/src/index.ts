import PromiseBB from "bluebird";
import { BSAFile, BSAFolder, BSArchive, createBSA, loadBSA } from "bsatk";
import * as path from "path";
import { PassThrough } from "stream";
import { dir as tmpDir } from "tmp";
import { fs, types, util } from "vortex-api";

class BSAHandler implements types.IArchiveHandler {
  private mBSA: BSArchive;
  constructor(bsa: BSArchive) {
    this.mBSA = bsa;
  }

  public readDir(archPath: string): PromiseBB<string[]> {
    return PromiseBB.resolve(
      this.readDirImpl(this.mBSA.root, archPath.split(path.sep), 0),
    );
  }

  public extractFile(filePath: string, outputPath: string): PromiseBB<void> {
    const file: BSAFile = this.getFileImpl(
      this.mBSA.root,
      filePath.split(path.sep),
      0,
    );
    if (file === undefined) {
      return PromiseBB.reject(new Error("file not found " + filePath));
    }

    return new PromiseBB<void>((resolve, reject) => {
      this.mBSA.extractFile(file, outputPath, (readErr) => {
        if (readErr !== null) {
          reject(readErr);
        }
        resolve();
      });
    });
  }

  public extractAll(outputPath: string): PromiseBB<void> {
    return new PromiseBB<void>((resolve, reject) => {
      this.mBSA.extractAll(outputPath, (readErr) => {
        if (readErr !== null) {
          reject(readErr);
        }
        resolve();
      });
    });
  }

  public readFile(filePath: string): NodeJS.ReadableStream {
    // using a pass-through stream because reading the file from bsa
    // is itself an asynchronous operation. Of course we could have implemented
    // readFile to return a Promise<ReadableStream> but combining two async mechanisms
    // this way felt like overkill.
    const pass = new PassThrough();

    const file: BSAFile = this.getFileImpl(
      this.mBSA.root,
      filePath.split(path.sep),
      0,
    );
    if (file === undefined) {
      pass.emit("error", new Error("file not found " + filePath));
      return pass;
    }

    tmpDir((tmpErr: any, tmpPath: string, cleanup: () => void) => {
      if (tmpErr !== null) {
        return pass.emit("error", tmpErr);
      }
      this.mBSA.extractFile(file, tmpPath, (readErr) => {
        if (readErr !== null) {
          return pass.emit("error", readErr);
        }

        const fileStream = fs.createReadStream(
          path.join(tmpPath, path.basename(filePath)),
        );
        fileStream.on("data", (data) => pass.write(data));
        fileStream.on("end", () => {
          pass.end();
          fs.removeAsync(tmpPath).catch(() => null);
        });
        fileStream.on("error", (err) => pass.emit("error", err));
        fileStream.on("readable", () => pass.emit("readable"));
      });
    });

    return pass;
  }

  public addFile(filePath: string, sourcePath: string): PromiseBB<void> {
    const segments = filePath.split(path.sep);
    let current = this.mBSA.root;
    segments.forEach((segment, idx) => {
      if (idx === segments.length - 1) {
        current.addFile(this.mBSA.createFile(segment, sourcePath, false));
      } else {
        current = this.getSubfolder(current, segment);
      }
    });
    return PromiseBB.resolve();
  }

  public write(): PromiseBB<void> {
    this.mBSA.write();
    return PromiseBB.resolve();
  }

  public closeArchive(): PromiseBB<void> {
    this.mBSA.closeArchive();
    return PromiseBB.resolve();
  }

  private getSubfolder(base: BSAFolder, name: string): BSAFolder {
    for (let i = 0; i < base.numSubFolders; ++i) {
      if (base.getSubFolder(i).name.toLowerCase() === name.toLowerCase()) {
        return base.getSubFolder(i);
      }
    }
    return base.addFolder(name);
  }

  private getFileImpl(
    folder: BSAFolder,
    filePath: string[],
    offset: number,
  ): BSAFile {
    if (offset === filePath.length - 1) {
      return this.getFiles(folder).find(
        (file) => file.name === filePath[offset],
      );
    }

    const res = this.findSubFolders(folder, filePath[offset]).map(
      (subFolder: BSAFolder) =>
        this.getFileImpl(subFolder, filePath, offset + 1),
    );
    return res.find((item) => item !== undefined);
  }

  private readDirImpl(
    folder: BSAFolder,
    archPath: string[],
    offset: number,
  ): string[] {
    if (offset === archPath.length) {
      return this.getFileAndFolderNames(folder);
    }

    const res = this.findSubFolders(folder, archPath[offset]).map(
      (subFolder: BSAFolder) =>
        this.readDirImpl(subFolder, archPath, offset + 1),
    );
    return [].concat.apply([], res);
  }

  // find subfolders with the specified name (bsa seems to support multiple
  // occurences of the same folder name)
  private findSubFolders(folder: BSAFolder, name: string): BSAFolder[] {
    const res: BSAFolder[] = [];
    for (let idx = 0; idx < folder.numSubFolders; ++idx) {
      const iter = folder.getSubFolder(idx);
      if (iter.name === name) {
        res.push(iter);
      }
    }
    return res;
  }

  private getFileAndFolderNames(folder: BSAFolder): string[] {
    return [].concat(
      this.getFolders(folder).map((item) => item.name),
      this.getFiles(folder).map((item) => item.name),
    );
  }

  private getFolders(parent: BSAFolder): BSAFolder[] {
    const res: BSAFolder[] = [];
    for (let idx = 0; idx < parent.numSubFolders; ++idx) {
      res.push(parent.getSubFolder(idx));
    }
    return res;
  }

  private getFiles(parent: BSAFolder): BSAFile[] {
    const res: BSAFile[] = [];
    for (let idx = 0; idx < parent.numFiles; ++idx) {
      res.push(parent.getFile(idx));
    }
    return res;
  }
}

function createBSAHandler(
  fileName: string,
  options: types.IArchiveOptions,
): PromiseBB<types.IArchiveHandler> {
  return PromiseBB.resolve(
    (async () =>
      options.create
        ? util.toPromise((cb) => createBSA(fileName, cb))
        : util.toPromise((cb) =>
            loadBSA(fileName, options.verify === true, cb),
          ))(),
  ).then((arc: BSArchive) => Promise.resolve(new BSAHandler(arc)));
}

function init(context: types.IExtensionContext) {
  context.registerArchiveType("bsa", createBSAHandler);
  return true;
}

export default init;
