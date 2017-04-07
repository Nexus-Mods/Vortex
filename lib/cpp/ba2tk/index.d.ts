declare module 'ba2tk' {
  export class BA2Archive {
    type: number;
    fileList: string[];
    extractAll: (outputDirectory: string, callback: (err: Error) => void) => void;
  }

  function loadBA2(fileName: string, callback: (err: Error, archive: BSArchive) => void);

  export default loadBA2;
}
