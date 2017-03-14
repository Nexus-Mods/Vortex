import * as Promise from 'bluebird';
import loadBSA, {BSAFile, BSAFolder, BSArchive} from 'bsatk';
import { types } from 'nmm-api';
import * as path from 'path';

const loadBSAasync = Promise.promisify(loadBSA);

class BSAHandler implements types.IArchiveHandler {
  private mBSA: BSArchive;
  constructor(bsa: BSArchive) {
    this.mBSA = bsa;
  }

  public readDir(archPath: string): Promise<string[]> {
    return this.readDirImpl(this.mBSA.root, archPath.split(path.sep), 0);
  }

  private readDirImpl(folder: BSAFolder, archPath: string[], offset: number): Promise<string[]> {
    if (offset === archPath.length) {
      return Promise.resolve(this.getFileAndFolderNames(folder));
    }
    return Promise.map(this.findSubFolders(folder, archPath[offset]),
      (subFolder: BSAFolder) => this.readDirImpl(subFolder, archPath, offset + 1)
    )
    .then((res: string[][]) => [].concat.apply([], res));
  }

  // find subfolders with the specified name (bsa seems to support multiple
  // occurences of the same folder name)
  private findSubFolders(folder: BSAFolder, name: string): BSAFolder[] {
    let res: BSAFolder[] = [];
    for (let idx = 0; idx < folder.numSubFolders; ++idx) {
      let iter = folder.getSubFolder(idx);
      if (iter.name === name) {
        res.push(iter);
      }
    }
    return res;
  }

  private getFileAndFolderNames(folder: BSAFolder): string[] {
    return [].concat(
      this.getFolders(folder).map(item => item.name),
      this.getFiles(folder).map(item => item.name),
    );
  }

  private getFolders(parent: BSAFolder): BSAFolder[] {
    let res: BSAFolder[] = [];
    for (let idx = 0; idx < parent.numSubFolders; ++idx) {
      res.push(parent.getSubFolder(idx));
    }
    return res;
  }

  private getFiles(parent: BSAFolder): BSAFile[] {
    let res: BSAFile[] = [];
    for (let idx = 0; idx < parent.numFiles; ++idx) {
      res.push(parent.getFile(idx));
    }
    return res;
  }
}

function createBSAHandler(fileName: string,
                          options: types.IArchiveOptions): Promise<types.IArchiveHandler> {
  return loadBSAasync(fileName, options.verify === true)
  .then((archive: BSArchive) => new BSAHandler(archive));
}

function init(context: types.IExtensionContext) {
  context.registerArchiveType('bsa', createBSAHandler);
  return true;
}

export default init;
