declare module "turbowalk" {
  export interface IEntry {
    filePath: string;
    isDirectory: boolean;
    size: number;
    mtime: number;
    isTerminator?: boolean;
    id?: number;
    linkCount?: number;
  }

  export interface IWalkOptions {
    terminators?: boolean;
    details?: boolean;
    threshold?: number;
    recurse?: boolean;
  }

  function turbowalk(basePath: string, progress: (entries: IEntry[]) => void,
                     options?: IWalkOptions): Bluebird<void>;

  export default turbowalk;
}
