import { IArchiveHandler } from '../types/IExtensionContext';

import * as Promise from 'bluebird';

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
  public get readDir(): (archivePath: string) => Promise<string[]> {
    return (this.mHandler.readDir !== undefined)
      ? (archivePath: string) => this.mHandler.readDir(archivePath)
      : undefined;
  }

  /**
   * read a file at the specified path via a stream
   */
  public get readFile(): (filePath: string) => NodeJS.ReadableStream {
    return (this.mHandler.readFile !== undefined)
      ? (filePath: string) => this.mHandler.readFile(filePath)
      : undefined;
  }

  /**
   * extract a single file
   */
  public get extractFile(): (filePath: string, outputPath: string) => Promise<void> {
    return (this.mHandler.extractFile !== undefined)
      ? (filePath: string, outputPath: string) => this.mHandler.extractFile(filePath, outputPath)
      : undefined;
  }

  /**
   * extract the entire archive
   */
  public get extractAll(): (outputPath: string) => Promise<void> {
    return (this.mHandler.extractAll !== undefined)
      ? (outputPath: string) => this.mHandler.extractAll(outputPath)
      : undefined;
  }

  /**
   * create this archive from the files in sourcePath
   */
  public get create(): (sourcePath: string) => Promise<void> {
    return (this.mHandler.create !== undefined)
      ? (sourcePath: string) => this.mHandler.create(sourcePath)
      : undefined;
  }
}
