import type { IArchiveHandler } from "../types/IExtensionContext";

import type PromiseBB from "bluebird";

/**
 * wrapper around an format-specific archive handler
 *
 * @export
 * @class Archive
 */
export class Archive {
  private mHandler: IArchiveHandler;

  constructor(handler: IArchiveHandler) {
    this.mHandler = handler;
  }

  /**
   * list files at the specified path
   */
  public get readDir():
    | ((archivePath: string) => PromiseBB<string[]>)
    | undefined {
    return this.mHandler.readDir
      ? (archivePath: string) => this.mHandler.readDir(archivePath)
      : undefined;
  }

  /**
   * read a file at the specified path via a stream
   */
  public get readFile():
    | ((filePath: string) => NodeJS.ReadableStream)
    | undefined {
    return this.mHandler.readFile
      ? (filePath: string) => this.mHandler.readFile!(filePath)
      : undefined;
  }

  /**
   * extract a single file
   */
  public get extractFile():
    | ((filePath: string, outputPath: string) => PromiseBB<void>)
    | undefined {
    return this.mHandler.extractFile
      ? (filePath: string, outputPath: string) =>
          this.mHandler.extractFile!(filePath, outputPath)
      : undefined;
  }

  /**
   * extract the entire archive
   */
  public get extractAll():
    | ((outputPath: string) => PromiseBB<void>)
    | undefined {
    return this.mHandler.extractAll
      ? (outputPath: string) => this.mHandler.extractAll(outputPath)
      : undefined;
  }

  /**
   * create this archive from the files in sourcePath
   */
  public get create(): ((sourcePath: string) => PromiseBB<void>) | undefined {
    return this.mHandler.create
      ? (sourcePath: string) => this.mHandler.create!(sourcePath)
      : undefined;
  }

  /**
   * add a single file to the archive
   */
  public get addFile():
    | ((filePath: string, sourcePath: string) => PromiseBB<void>)
    | undefined {
    return this.mHandler.addFile
      ? (filePath: string, sourcePath: string) =>
          this.mHandler.addFile!(filePath, sourcePath)
      : undefined;
  }

  public get write(): (() => PromiseBB<void>) | undefined {
    return this.mHandler.write ? () => this.mHandler.write!() : undefined;
  }
}
