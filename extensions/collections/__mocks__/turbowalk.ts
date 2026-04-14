export interface IEntry {
  filePath: string;
  isDirectory: boolean;
  size: number;
  mtime: number;
  isTerminator: boolean;
}

export interface IWalkOptions {
  skipLinks?: boolean;
  skipHidden?: boolean;
  skipInaccessible?: boolean;
}

export default async function turbowalk(
  _dirPath: string,
  _callback: (entries: IEntry[]) => Promise<void>,
  _options?: IWalkOptions,
): Promise<void> {}
