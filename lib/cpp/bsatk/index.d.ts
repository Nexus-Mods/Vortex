declare module 'bsatk' {
  export class BSArchive {
    type: number;
    root: BSAFolder;
  }

  export class BSAFile {
    name: string;
    filePath: string;
    fileSize: number;
  }

  export class BSAFolder {
    name: string;
    fullPath: string;
    numSubFolders: number;
    numFiles: number;
    countFiles(): number;
    getSubFolder(idx: number): BSAFolder;
    getFile(idx: number): BSAFile;
    addFile(file: BSAFile): void;
    addFolder(name: string): BSAFolder;
  }

  function loadBSA(fileName: string, testHashes: boolean, callback: (err: Error, archive: BSArchive) => void);

  export default loadBSA;
}
